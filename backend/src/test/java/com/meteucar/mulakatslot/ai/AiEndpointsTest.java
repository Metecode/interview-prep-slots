package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasLength;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.auth.AccessTokenService;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

/**
 * /api/ai uçlarının uçtan uca davranışı sahte sağlayıcıyla: kimlik, kota,
 * iade, önbellek, hız sınırı ve doğrulama. Soru, seeder'ın yazdığı taban
 * içerikten (baseline-question: concept-a/b/c) gelir.
 */
@Import({TestcontainersConfiguration.class, FakeAiEvaluator.Config.class})
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AiEndpointsTest {

    private static final String QUESTION_ID = "baseline-question";
    private static final int LIMIT = 20;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private AccessTokenService accessTokenService;

    @Autowired
    private FakeAiEvaluator fakeEvaluator;

    @Autowired
    private AiEvaluationCache cache;

    @Autowired
    private AiQuotaService quotaService;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private Clock clock;

    private AppUser user;
    private String token;

    @BeforeEach
    void setUp() {
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-ai", "metecode"));
        token = accessTokenService.issue(user.getId());
        fakeEvaluator.reset();
        cache.clear();
    }

    @Test
    void endpointsRequireAToken() throws Exception {
        mockMvc.perform(get("/api/ai/status")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/ai/evaluate").contentType(MediaType.APPLICATION_JSON)
                        .content(body(QUESTION_ID, "cevap")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void statusReportsEnabledAndFullWeek() throws Exception {
        mockMvc.perform(authed(get("/api/ai/status")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.remaining").value(LIMIT))
                .andExpect(jsonPath("$.weekResetsAt", matchesPattern("\\d{4}-\\d{2}-\\d{2}T00:00:00Z")));
    }

    @Test
    void evaluationIsValidatedAndConsumesOne(CapturedOutput output) throws Exception {
        fakeEvaluator.answerWith(new AiEvaluation(
                List.of("concept-a", "uydurma-kavram"), List.of(), "ç".repeat(EvaluationPrompt.FEEDBACK_MAX_CHARS + 200), "Devam sorusu?"));

        evaluate("benim gizli cevabım")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hits", contains("concept-a")))
                .andExpect(jsonPath("$.missing", contains("concept-b", "concept-c")))
                .andExpect(jsonPath("$.feedback", hasLength(EvaluationPrompt.FEEDBACK_MAX_CHARS)))
                .andExpect(jsonPath("$.followUp").value("Devam sorusu?"))
                .andExpect(jsonPath("$.remaining").value(LIMIT - 1))
                .andExpect(jsonPath("$.cached").value(false));

        assertThat(used()).isEqualTo(1);
        // Cevap metni hiçbir log satırına girmez.
        assertThat(output.getAll()).doesNotContain("benim gizli cevabım");
    }

    /** Rubrik istemciden alınmaz: sağlayıcıya giden soru veritabanındaki. */
    @Test
    void rubricComesFromTheDatabaseNotTheClient() throws Exception {
        String payload = jsonMapper.writeValueAsString(Map.of(
                "questionId", QUESTION_ID,
                "answer", "cevap",
                "keyConcepts", List.of(Map.of("id", "sahte", "label", "Sahte"))));

        mockMvc.perform(authed(post("/api/ai/evaluate")).contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.missing", contains("concept-b", "concept-c")));

        assertThat(Rubric.of(fakeEvaluator.lastQuestion()).conceptIds())
                .containsExactly("concept-a", "concept-b", "concept-c");
    }

    @Test
    void sameAnswerAgainComesFromCacheWithoutConsuming() throws Exception {
        evaluate("aynı cevap").andExpect(status().isOk());

        // Büyük/küçük harf ve boşluk farkı aynı anahtara düşer.
        evaluate("  AYNI   cevap ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true))
                .andExpect(jsonPath("$.remaining").value(LIMIT - 1));

        assertThat(fakeEvaluator.calls()).isEqualTo(1);
        assertThat(used()).isEqualTo(1);
    }

    @Test
    void exhaustedQuotaIs429AndProviderIsNotCalled() throws Exception {
        setUsed(LIMIT);

        evaluate("cevap")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("quota_exceeded"));

        assertThat(fakeEvaluator.calls()).isZero();
        assertThat(used()).isEqualTo(LIMIT);
    }

    @Test
    void providerUnavailableIs503AndQuotaIsRefunded(CapturedOutput output) throws Exception {
        fakeEvaluator.failWith(new AiUnavailableException("Gemini HTTP 429"));

        evaluate("yoğun anda gizli cevap")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("ai_unavailable"));

        assertThat(used()).isZero();
        assertThat(output.getAll()).doesNotContain("yoğun anda gizli cevap");
    }

    @Test
    void unreadableProviderResponseIs502AndQuotaIsRefunded() throws Exception {
        fakeEvaluator.failWith(new AiResponseException("model çıktısı ayrıştırılamadı"));

        evaluate("cevap")
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("ai_bad_response"));

        assertThat(used()).isZero();
    }

    @Test
    void failedCallIsNotCached() throws Exception {
        fakeEvaluator.failWith(new AiUnavailableException("zaman aşımı"));
        evaluate("cevap").andExpect(status().isServiceUnavailable());

        fakeEvaluator.reset();
        evaluate("cevap").andExpect(status().isOk()).andExpect(jsonPath("$.cached").value(false));
    }

    @Test
    void moreThanFiveRequestsAMinuteAreRateLimited() throws Exception {
        for (int i = 0; i < AiRateLimiter.LIMIT; i++) {
            evaluate("cevap " + i).andExpect(status().isOk());
        }

        evaluate("cevap 6")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("rate_limited"));
        assertThat(used()).isEqualTo(AiRateLimiter.LIMIT);
    }

    @Test
    void unknownQuestionIs404() throws Exception {
        mockMvc.perform(authed(post("/api/ai/evaluate")).contentType(MediaType.APPLICATION_JSON)
                        .content(body("boyle-bir-soru-yok", "cevap")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("question_not_found"));
        assertThat(used()).isZero();
    }

    @Test
    void blankOrOversizedAnswerIs400() throws Exception {
        evaluate("   ").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("invalid_request"));
        evaluate("x".repeat(AiService.MAX_ANSWER_CHARS + 1)).andExpect(status().isBadRequest());
        assertThat(fakeEvaluator.calls()).isZero();
    }

    /* -------------------------------------------------------------- */
    /* Yardımcılar                                                     */
    /* -------------------------------------------------------------- */

    private ResultActions evaluate(String answer) throws Exception {
        return mockMvc.perform(authed(post("/api/ai/evaluate"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(QUESTION_ID, answer)));
    }

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder request) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private String body(String questionId, String answer) {
        return jsonMapper.writeValueAsString(Map.of("questionId", questionId, "answer", answer));
    }

    private int used() {
        return quotaService.used(user.getId(), AiWeek.containing(clock.instant()));
    }

    private void setUsed(int count) {
        jdbcClient.sql("INSERT INTO ai_usage (user_id, week_start, count) VALUES (:userId, :weekStart, :count)")
                .param("userId", user.getId())
                .param("weekStart", AiWeek.containing(clock.instant()).start())
                .param("count", count)
                .update();
    }
}
