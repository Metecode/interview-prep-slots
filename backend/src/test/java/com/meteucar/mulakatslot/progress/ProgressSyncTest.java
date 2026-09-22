package com.meteucar.mulakatslot.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.auth.AccessTokenService;
import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.question.QuestionRepository;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

/**
 * Senkron uçlarının uçtan uca davranışı: kimlik, kullanıcı ayrımı, JSON
 * sözleşmesi ve JSONB gidiş dönüşü.
 *
 * <p>Birleştirme kurallarının kendisi burada değil — onlar veritabanı
 * bilmiyor ve {@link ProgressMergerTest}'te Testcontainers'sız çalışıyor.
 * Burada kalanlar gerçekten bir veritabanı ve HTTP katmanı gerektirenler.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ProgressSyncTest {

    private static final String QUESTION_A = "progress-test-a";
    private static final String QUESTION_B = "progress-test-b";
    private static final String QUESTION_C = "progress-test-c";

    private static final String T1 = "2026-01-01T10:00:00Z";
    private static final String T2 = "2026-02-01T10:00:00Z";
    private static final String T3 = "2026-03-01T10:00:00Z";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionProgressRepository questionProgressRepository;

    @Autowired
    private AccessTokenService accessTokenService;

    private AppUser user;
    private AppUser otherUser;

    @BeforeEach
    void setUp() {
        questionProgressRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-progress", "metecode"));
        otherUser = appUserRepository.save(new AppUser("gh-progress-other", "baskasi"));

        // Seeder açılışta yalnızca taban içeriği yazıyor; birleştirmeyi iki
        // yönde denemek için birkaç soru daha gerekiyor.
        ensureQuestion(QUESTION_A);
        ensureQuestion(QUESTION_B);
        ensureQuestion(QUESTION_C);
    }

    @Test
    void mergeReturnsTheCombinedResultOfBothSides() throws Exception {
        // Sunucuda A ve B var; istemci B'nin daha yenisini ve hiç bilmediğimiz C'yi yolluyor.
        saveServerProgress(user, QUESTION_A, 4, T2);
        saveServerProgress(user, QUESTION_B, 2, T1);

        mockMvc.perform(authed(post("/api/progress/merge"), user)
                        .content(body(progressRecord(QUESTION_B, 5, T3), progressRecord(QUESTION_C, 1, T1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));

        // Sunucuda kalan A istemciye geçti, istemcinin yenisi B'yi ezdi, C eklendi.
        assertThat(boxOf(user, QUESTION_A)).contains((short) 4);
        assertThat(boxOf(user, QUESTION_B)).contains((short) 5);
        assertThat(boxOf(user, QUESTION_C)).contains((short) 1);
    }

    /** PUT yanıtının üç sayacı da tele çıkıyor mu. */
    @Test
    void putReportsAppliedMergedAndIgnored() throws Exception {
        saveServerProgress(user, QUESTION_A, 4, T2, T2);
        saveServerProgress(user, QUESTION_B, 1, T1);

        mockMvc.perform(authed(put("/api/progress"), user).content(body(
                        // Eski kayıt, ama yeni bir deneme taşıyor: merged.
                        progressRecord(QUESTION_A, 1, T1, T1),
                        // Daha yeni: applied.
                        progressRecord(QUESTION_B, 3, T2),
                        // Bilinmeyen soru: ignored.
                        progressRecord("boyle-bir-soru-yok", 2, T1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1))
                .andExpect(jsonPath("$.merged").value(1))
                .andExpect(jsonPath("$.ignored").value(1));

        assertThat(boxOf(user, QUESTION_A)).contains((short) 4);
        assertThat(boxOf(user, QUESTION_B)).contains((short) 3);
        assertThat(attemptTimesOf(user, QUESTION_A)).containsExactly(T1, T2);
        assertThat(boxOf(user, "boyle-bir-soru-yok")).isEmpty();
    }

    /**
     * Tek bozuk kayıt tüm senkronu düşürmesin. Bu uçta duruyor çünkü
     * ayrıştırılamayan bir tarihin Jackson'da 400'e dönüşmemesi, gövde
     * şeklinin (lastSeenAt'in String olması) sonucu.
     */
    @Test
    void malformedRecordIsSkippedNotRejected() throws Exception {
        String payload = """
                [
                  { "questionId": "%s", "box": 2, "lastSeenAt": "dun", "attempts": [] },
                  { "questionId": "%s", "box": 2, "lastSeenAt": "%s", "attempts": [] }
                ]
                """.formatted(QUESTION_A, QUESTION_B, T1);

        mockMvc.perform(authed(put("/api/progress"), user).content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1))
                .andExpect(jsonPath("$.ignored").value(1));

        assertThat(boxOf(user, QUESTION_A)).isEmpty();
        assertThat(boxOf(user, QUESTION_B)).contains((short) 2);
    }

    /** attempts JSONB'ye olduğu gibi gidip geliyor mu. */
    @Test
    void attemptsSurviveRoundTrip() throws Exception {
        String payload = """
                [{ "questionId": "%s", "box": 2, "lastSeenAt": "%s",
                   "attempts": [{ "at": "%s", "answer": "cevabım", "hitCount": 1,
                                  "totalConcepts": 3, "selfRating": 1, "passed": false }] }]
                """.formatted(QUESTION_A, T1, T1);

        mockMvc.perform(authed(put("/api/progress"), user).content(payload))
                .andExpect(status().isOk());

        mockMvc.perform(authed(get("/api/progress"), user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].questionId").value(QUESTION_A))
                .andExpect(jsonPath("$[0].box").value(2))
                // Zod .datetime() UTC bekliyor; yanıt sürücünün yerel offset'ini taşımamalı.
                .andExpect(jsonPath("$[0].lastSeenAt").value(T1))
                .andExpect(jsonPath("$[0].attempts", hasSize(1)))
                .andExpect(jsonPath("$[0].attempts[0].answer").value("cevabım"));
    }

    @Test
    void otherUsersProgressIsNotVisibleOrWritable() throws Exception {
        saveServerProgress(user, QUESTION_A, 4, T2);

        mockMvc.perform(authed(get("/api/progress"), otherUser))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        // Diğer kullanıcının yazdığı kayıt yalnızca kendi satırına gider.
        mockMvc.perform(authed(put("/api/progress"), otherUser).content(body(progressRecord(QUESTION_A, 1, T3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));

        assertThat(boxOf(user, QUESTION_A)).contains((short) 4);
        assertThat(boxOf(otherUser, QUESTION_A)).contains((short) 1);
    }

    @Test
    void progressEndpointsRequireToken() throws Exception {
        mockMvc.perform(get("/api/progress"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));

        mockMvc.perform(put("/api/progress")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(progressRecord(QUESTION_A, 1, T1))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/progress/merge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isUnauthorized());
    }

    /* -------------------------------------------------------------- */
    /* Yardımcılar                                                     */
    /* -------------------------------------------------------------- */

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder builder, AppUser as) {
        return builder
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessTokenService.issue(as.getId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    /** attemptTimes verilmezse deneme geçmişi boş; verilen her zaman bir deneme. */
    private ProgressRecord progressRecord(String questionId, int box, String lastSeenAt, String... attemptTimes) {
        return new ProgressRecord(questionId, box, lastSeenAt, attempts(attemptTimes));
    }

    private List<Map<String, Object>> attempts(String... attemptTimes) {
        return Arrays.stream(attemptTimes)
                .map(at -> Map.<String, Object>of("at", at, "answer", "cevap " + at))
                .toList();
    }

    private String body(ProgressRecord... records) {
        return jsonMapper.writeValueAsString(List.of(records));
    }

    private void ensureQuestion(String id) {
        if (questionRepository.existsById(id)) {
            return;
        }
        questionRepository.save(new Question(id, "misc", "Senkron", (short) 1, "definition",
                Map.of("prompt", "Senkron testi sorusu", "keyConcepts", List.of())));
    }

    private void saveServerProgress(AppUser owner, String questionId, int box, String lastSeenAt,
            String... attemptTimes) {
        Question question = questionRepository.findById(questionId).orElseThrow();
        QuestionProgress row = new QuestionProgress(owner, question, (short) box, OffsetDateTime.parse(lastSeenAt));
        row.setAttempts(attempts(attemptTimes));
        questionProgressRepository.save(row);
    }

    private Optional<Short> boxOf(AppUser owner, String questionId) {
        return questionProgressRepository.findById(new QuestionProgressId(owner.getId(), questionId))
                .map(QuestionProgress::getBox);
    }

    /** Saklanan denemelerin at alanları, sırasıyla. */
    private List<String> attemptTimesOf(AppUser owner, String questionId) {
        return questionProgressRepository.findById(new QuestionProgressId(owner.getId(), questionId))
                .orElseThrow()
                .getAttempts().stream()
                .map(attempt -> (String) attempt.get("at"))
                .toList();
    }
}
