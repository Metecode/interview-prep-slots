package com.meteucar.mulakatslot.progress;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.question.QuestionRepository;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Aynı kullanıcının iki sekmesi aynı soruyu aynı anda gönderirse.
 *
 * <p>Kilitsiz kurguda iki istek de satırı eski haliyle okuyup üstüne
 * yazıyor: son commit kazanıyor, yani ESKİ kayıt yeniyi ezebiliyor ve
 * kaybeden isteğin denemeleri sessizce gidiyor. Satır henüz hiç yoksa
 * daha kötüsü oluyor — ikisi de INSERT ediyor, biri birincil anahtar
 * çakışmasıyla düşüyor. Serileştirme {@code AppUserRepository
 * #findForUpdateById} kilidinde; bu testler o kilidi kaldırınca düşer.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ProgressSyncRaceTest {

    private static final String QUESTION_ID = "race-test-question";

    private static final String OLDER = "2026-01-01T10:00:00Z";
    private static final String NEWER = "2026-03-01T10:00:00Z";

    @Autowired
    private ProgressSyncService progressSyncService;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionProgressRepository questionProgressRepository;

    private AppUser user;

    @BeforeEach
    void setUp() {
        questionProgressRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-progress-race", "metecode"));

        if (!questionRepository.existsById(QUESTION_ID)) {
            questionRepository.save(new Question(QUESTION_ID, "misc", "Senkron", (short) 1, "definition",
                    Map.of("prompt", "Yarış testi sorusu", "keyConcepts", List.of())));
        }
    }

    /** Satır henüz yokken: kilitsiz kurguda ikisi de INSERT eder. */
    @Test
    void concurrentFirstWritesDoNotCollide() throws Exception {
        runBothAtOnce();

        assertThat(storedBox()).isEqualTo((short) 5);
        assertThat(storedLastSeenAt()).isEqualTo(OffsetDateTime.parse(NEWER));
        assertThat(storedAttemptTimes()).containsExactly(OLDER, NEWER);
    }

    /** Satır varken: kilitsiz kurguda eski kayıt yeniyi ezebilir. */
    @Test
    void concurrentUpdatesKeepTheNewerRecordAndBothAttempts() throws Exception {
        Question question = questionRepository.findById(QUESTION_ID).orElseThrow();
        questionProgressRepository.save(
                new QuestionProgress(user, question, (short) 1, OffsetDateTime.parse("2025-01-01T10:00:00Z")));

        runBothAtOnce();

        assertThat(storedBox()).isEqualTo((short) 5);
        assertThat(storedLastSeenAt()).isEqualTo(OffsetDateTime.parse(NEWER));
        assertThat(storedAttemptTimes()).containsExactly(OLDER, NEWER);
    }

    /* -------------------------------------------------------------- */
    /* Yardımcılar                                                     */
    /* -------------------------------------------------------------- */

    /**
     * İki senkronu aynı anda başlatır. Hangisinin önce girdiği önemli değil:
     * sonuç iki sırada da aynı olmalı — kutu yeniden gelir, geçmiş ikisini
     * de barındırır.
     */
    private void runBothAtOnce() throws Exception {
        CountDownLatch startSignal = new CountDownLatch(1);
        Callable<ProgressApplyResult> older = syncOf(1, OLDER);
        Callable<ProgressApplyResult> newer = syncOf(5, NEWER);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<ProgressApplyResult>> calls = List.of(
                    pool.submit(gatedBy(startSignal, older)),
                    pool.submit(gatedBy(startSignal, newer)));
            startSignal.countDown();

            // get, işçi thread'deki hatayı ExecutionException olarak buraya
            // taşır; ikisi de sorunsuz bitmeli.
            for (Future<ProgressApplyResult> call : calls) {
                assertThat(call.get(10, TimeUnit.SECONDS)).isNotNull();
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private Callable<ProgressApplyResult> syncOf(int box, String timestamp) {
        List<Map<String, Object>> attempts = List.of(Map.of("at", timestamp, "answer", "cevap " + timestamp));
        ProgressRecord record = new ProgressRecord(QUESTION_ID, box, timestamp, attempts);
        return () -> progressSyncService.apply(user.getId(), List.of(record));
    }

    private <T> Callable<T> gatedBy(CountDownLatch startSignal, Callable<T> call) {
        return () -> {
            startSignal.await(5, TimeUnit.SECONDS);
            return call.call();
        };
    }

    private QuestionProgress storedRow() {
        return questionProgressRepository.findById(new QuestionProgressId(user.getId(), QUESTION_ID))
                .orElseThrow(() -> new AssertionError("ilerleme satırı yazılmamış"));
    }

    private short storedBox() {
        return storedRow().getBox();
    }

    private OffsetDateTime storedLastSeenAt() {
        return storedRow().getLastSeenAt();
    }

    private List<String> storedAttemptTimes() {
        return storedRow().getAttempts().stream().map(attempt -> (String) attempt.get("at")).toList();
    }
}
