package com.meteucar.mulakatslot.progress;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Birleştirme kuralları. Testcontainers yok: ProgressMerger veritabanı
 * bilmiyor, kuralları doğrulamak için Postgres ayağa kaldırmak gereksiz.
 * Uçların ve eşzamanlılığın testleri ProgressSyncTest ile
 * ProgressSyncRaceTest'te kalıyor.
 */
class ProgressMergerTest {

    private static final String QUESTION_A = "soru-a";
    private static final String QUESTION_B = "soru-b";
    private static final Set<String> KNOWN = Set.of(QUESTION_A, QUESTION_B);

    private static final String T1 = "2026-01-01T10:00:00Z";
    private static final String T2 = "2026-02-01T10:00:00Z";
    private static final String T3 = "2026-03-01T10:00:00Z";

    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-04-01T10:00:00Z");

    /** Cevap metnine konan işaret; hiçbir atlama nedeninde görünmemeli. */
    private static final String SECRET = "GIZLI-CEVAP-METNI";

    /* -------------------------------------------------------------- */
    /* Kutu ve lastSeenAt — yeni kazanır                               */
    /* -------------------------------------------------------------- */

    @Test
    void newQuestionIsApplied() {
        ProgressMerger.MergePlan plan = merge(stored(), incoming(record(QUESTION_A, 3, T2)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 0));
        assertThat(plan.changes()).singleElement()
                .returns(QUESTION_A, ProgressState::questionId)
                .returns((short) 3, ProgressState::box);
    }

    @Test
    void newerRecordWins() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 1, T1)),
                incoming(record(QUESTION_A, 4, T2)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 0));
        assertThat(plan.changes()).singleElement()
                .returns((short) 4, ProgressState::box)
                .returns(OffsetDateTime.parse(T2), ProgressState::lastSeenAt);
    }

    @Test
    void staleRecordDoesNotOverwriteBox() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 4, T2)),
                incoming(record(QUESTION_A, 1, T1)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(0, 0, 1));
        assertThat(plan.changes()).isEmpty();
    }

    /** Aynı veri ikinci kez gelirse hiçbir şey değişmez; uç idempotent. */
    @Test
    void identicalRecordIsIgnored() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 2, T1)),
                incoming(record(QUESTION_A, 2, T1)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(0, 0, 1));
        assertThat(plan.changes()).isEmpty();
    }

    /** Aynı istekte tekrar eden id, kendinden öncekinin sonucuyla karşılaşır. */
    @Test
    void repeatedQuestionIdWithinOneRequestIsIgnoredTheSecondTime() {
        ProgressMerger.MergePlan plan = merge(
                stored(),
                incoming(record(QUESTION_A, 2, T2), record(QUESTION_A, 5, T1)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 1));
    }

    /* -------------------------------------------------------------- */
    /* Deneme geçmişi — kutunun aksine hep birleşir                    */
    /* -------------------------------------------------------------- */

    /**
     * En değerli veri attempts: kullanıcının yazdığı cevaplar orada. İki
     * cihazda farklı denemeler varsa biri "eski kayıt" diye silinemez.
     */
    @Test
    void staleRecordStillMergesItsAttempts() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 4, T2, T2)),
                incoming(record(QUESTION_A, 1, T1, T1)));

        // Kutuya dokunulmadı ama geçmiş birleşti: applied değil merged.
        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(0, 1, 0));
        ProgressState change = plan.changes().getFirst();
        assertThat(change.box()).isEqualTo((short) 4);
        assertThat(change.lastSeenAt()).isEqualTo(OffsetDateTime.parse(T2));
        assertThat(timesOf(change)).containsExactly(T1, T2);
    }

    @Test
    void newerRecordMergesAttemptsInsteadOfReplacingThem() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 1, T1, T1)),
                incoming(record(QUESTION_A, 3, T2, T2)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 0));
        assertThat(timesOf(plan.changes().getFirst())).containsExactly(T1, T2);
    }

    /** Aynı at aynı deneme demek; iki taraf da taşıyorsa tek kayıt kalır. */
    @Test
    void attemptsWithTheSameTimestampAreNotDuplicated() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 2, T1, T1)),
                incoming(record(QUESTION_A, 2, T1, T1)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(0, 0, 1));
        assertThat(plan.changes()).isEmpty();
    }

    /** Sınır aşıldığında en eskiler düşer, en yeniler kalır. */
    @Test
    void mergedAttemptsAreTrimmedToTheNewest() {
        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 2, T1, days(1, 8))),
                incoming(record(QUESTION_A, 2, T1, days(7, 12))));

        // Birleşim 12 farklı deneme; sınır 10, en eski ikisi düşer.
        assertThat(timesOf(plan.changes().getFirst()))
                .hasSize(ProgressAttempts.MAX_ATTEMPTS)
                .containsExactly(days(3, 12));
    }

    /**
     * Saklanan eski bir denemede at yoksa hangi deneme olduğu bilinemez:
     * tekilleştirme de sıralama da ona dayanıyor, birleştirmede düşer.
     * (Gelen denemede at eksikse kayıt doğrulamada atlanıyor, aşağıda.)
     */
    @Test
    void storedAttemptWithoutTimestampIsDropped() {
        Map<String, Object> legacy = new LinkedHashMap<>(attempt(T1).toStored());
        legacy.remove("at");
        ProgressState storedState = new ProgressState(QUESTION_A, (short) 2, OffsetDateTime.parse(T1),
                List.of(legacy, attempt(T1).toStored()));

        ProgressMerger.MergePlan plan = merge(stored(storedState), incoming(record(QUESTION_A, 2, T2, T2)));

        assertThat(timesOf(plan.changes().getFirst())).containsExactly(T1, T2);
    }

    /* -------------------------------------------------------------- */
    /* Eleme — tek bozuk kayıt senkronu düşürmesin                     */
    /* -------------------------------------------------------------- */

    @Test
    void unknownQuestionIdIsSkipped() {
        ProgressMerger.MergePlan plan = merge(
                stored(),
                incoming(record("boyle-bir-soru-yok", 2, T1), record(QUESTION_A, 2, T1)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 1));
        assertThat(plan.unknownQuestions()).isEqualTo(1);
    }

    /** İstemci saati yanlışsa sunucudaki doğru veriyi sonsuza kadar ezmesin. */
    @Test
    void futureTimestampIsIgnored() {
        String farFuture = NOW.plusDays(3).toInstant().toString();

        ProgressMerger.MergePlan plan = merge(
                stored(state(QUESTION_A, 2, T1)),
                incoming(record(QUESTION_A, 5, farFuture)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(0, 0, 1));
        assertThat(plan.changes()).isEmpty();
    }

    /** Bir günlük pencerenin içindeki ileri tarih kabul edilir: saatler tam uymuyor. */
    @Test
    void slightlyFutureTimestampIsAccepted() {
        String soon = NOW.plusHours(2).toInstant().toString();

        ProgressMerger.MergePlan plan = merge(stored(), incoming(record(QUESTION_A, 2, soon)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 0));
    }

    @Test
    void invalidRecordsAreSkippedOneByOne() {
        ProgressRecord badBox = record(QUESTION_A, 9, T1);
        ProgressRecord badDate = new ProgressRecord(QUESTION_B, 2, "dun", List.of());
        ProgressRecord tooManyAttempts = new ProgressRecord(QUESTION_B, 2, T1,
                Collections.nCopies(ProgressAttempts.MAX_ATTEMPTS + 1, attempt(T1)));
        ProgressRecord missingId = new ProgressRecord(null, 2, T1, List.of());
        ProgressRecord good = record(QUESTION_A, 2, T3);

        ProgressMerger.MergePlan plan = merge(
                stored(), incoming(badBox, badDate, tooManyAttempts, missingId, good));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 4));
        assertThat(plan.changes()).singleElement().returns(QUESTION_A, ProgressState::questionId);
        // Atlanan her kayıt nedeniyle birlikte döner; loglamayı servis yapar.
        assertThat(plan.rejections()).extracting(ProgressValidator.Rejected::questionId)
                .containsExactly(QUESTION_A, QUESTION_B, QUESTION_B, null);
    }

    /**
     * Denemedeki her değer ihlali yalnızca o kaydı atlatır; aynı istekteki
     * geçerli kayıt yine yazılır. Neden sabit metin: cevap ne kadar uzun ya
     * da bozuk olursa olsun nedene (dolayısıyla loga) girmez.
     */
    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidAttempts")
    void attemptWithAnInvalidValueSkipsItsRecord(String reasonFragment, ProgressAttempt invalid) {
        ProgressRecord bad = new ProgressRecord(QUESTION_B, 2, T1, Arrays.asList(attempt(T1), invalid));

        ProgressMerger.MergePlan plan = merge(stored(), incoming(bad, record(QUESTION_A, 2, T1, T1)));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 1));
        assertThat(plan.changes()).singleElement().returns(QUESTION_A, ProgressState::questionId);
        assertThat(plan.rejections()).singleElement().satisfies(rejected -> {
            assertThat(rejected.questionId()).isEqualTo(QUESTION_B);
            assertThat(rejected.reason()).contains(reasonFragment).doesNotContain(SECRET);
        });
    }

    static Stream<Arguments> invalidAttempts() {
        String tooLong = SECRET + "a".repeat(ProgressValidator.MAX_ANSWER_LENGTH);
        return Stream.of(
                Arguments.of("deneme boş", null),
                Arguments.of("(at)", new ProgressAttempt(null, "cevap", 1, 3, 1, false)),
                Arguments.of("(at)", new ProgressAttempt("dun", "cevap", 1, 3, 1, false)),
                Arguments.of("(answer)", new ProgressAttempt(T2, null, 1, 3, 1, false)),
                Arguments.of("5000", new ProgressAttempt(T2, tooLong, 1, 3, 1, false)),
                Arguments.of("NUL", new ProgressAttempt(T2, SECRET + "\u0000", 1, 3, 1, false)),
                Arguments.of("surrogate", new ProgressAttempt(T2, SECRET + "\uD83D", 1, 3, 1, false)),
                Arguments.of("surrogate", new ProgressAttempt(T2, "\uDE00" + SECRET, 1, 3, 1, false)),
                Arguments.of("hitCount", new ProgressAttempt(T2, "cevap", null, 3, 1, false)),
                Arguments.of("hitCount", new ProgressAttempt(T2, "cevap", -1, 3, 1, false)),
                Arguments.of("totalConcepts", new ProgressAttempt(T2, "cevap", 1, null, 1, false)),
                Arguments.of("totalConcepts", new ProgressAttempt(T2, "cevap", 1, 0, 1, false)),
                Arguments.of("selfRating", new ProgressAttempt(T2, "cevap", 1, 3, null, false)),
                Arguments.of("selfRating", new ProgressAttempt(T2, "cevap", 1, 3, 3, false)),
                Arguments.of("selfRating", new ProgressAttempt(T2, "cevap", 1, 3, -1, false)),
                Arguments.of("passed", new ProgressAttempt(T2, "cevap", 1, 3, 1, null)));
    }

    /** Sınırın kendisi ve geçerli bir surrogate çifti (emoji) kabul edilir. */
    @Test
    void answerAtTheLimitAndValidSurrogatePairsAreAccepted() {
        ProgressAttempt atLimit = new ProgressAttempt(T1, "a".repeat(ProgressValidator.MAX_ANSWER_LENGTH), 0, 1, 0,
                true);
        ProgressAttempt emoji = new ProgressAttempt(T2, "doğru 😀", 2, 3, 2, false);

        ProgressMerger.MergePlan plan = merge(stored(),
                incoming(new ProgressRecord(QUESTION_A, 2, T2, List.of(atLimit, emoji))));

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(1, 0, 0));
        assertThat(plan.rejections()).isEmpty();
    }

    /** Saklanan deneme tam olarak altı anahtar taşır; istemcinin başka bir alanı yok. */
    @Test
    void storedAttemptsCarryExactlyTheSchemaFields() {
        ProgressMerger.MergePlan plan = merge(stored(), incoming(record(QUESTION_A, 2, T1, T1)));

        assertThat(plan.changes().getFirst().attempts()).singleElement()
                .satisfies(stored -> assertThat(stored).containsOnlyKeys(
                        "at", "answer", "hitCount", "totalConcepts", "selfRating", "passed"));
    }

    @Test
    void emptyRequestChangesNothing() {
        ProgressMerger.MergePlan plan = merge(stored(state(QUESTION_A, 3, T1)), incoming());

        assertThat(plan.counters()).isEqualTo(new ProgressApplyResult(0, 0, 0));
        assertThat(plan.changes()).isEmpty();
    }

    /** Saklanan harita değiştirilmemeli: çağıran onu entity'lerden türetiyor. */
    @Test
    void storedSnapshotIsNotMutated() {
        Map<String, ProgressState> stored = stored(state(QUESTION_A, 1, T1));

        merge(stored, incoming(record(QUESTION_A, 4, T2), record(QUESTION_B, 1, T1)));

        assertThat(stored).containsOnlyKeys(QUESTION_A);
        assertThat(stored.get(QUESTION_A).box()).isEqualTo((short) 1);
    }

    /* -------------------------------------------------------------- */
    /* Yardımcılar                                                     */
    /* -------------------------------------------------------------- */

    private ProgressMerger.MergePlan merge(Map<String, ProgressState> stored, List<ProgressRecord> incoming) {
        return ProgressMerger.merge(stored, incoming, KNOWN, NOW);
    }

    private Map<String, ProgressState> stored(ProgressState... states) {
        Map<String, ProgressState> map = new LinkedHashMap<>();
        for (ProgressState state : states) {
            map.put(state.questionId(), state);
        }
        return map;
    }

    private List<ProgressRecord> incoming(ProgressRecord... records) {
        return List.of(records);
    }

    /** Saklanan denemeler, gelenlerle aynı biçimde: aynı at aynı deneme sayılsın. */
    private ProgressState state(String questionId, int box, String lastSeenAt, String... attemptTimes) {
        List<Map<String, Object>> stored = Arrays.stream(attemptTimes)
                .map(at -> attempt(at).toStored())
                .toList();
        return new ProgressState(questionId, (short) box, OffsetDateTime.parse(lastSeenAt), stored);
    }

    private ProgressRecord record(String questionId, int box, String lastSeenAt, String... attemptTimes) {
        return new ProgressRecord(questionId, box, lastSeenAt,
                Arrays.stream(attemptTimes).map(this::attempt).toList());
    }

    /** Her alanı geçerli bir deneme; cevap zaman damgasından türetiliyor. */
    private ProgressAttempt attempt(String at) {
        return new ProgressAttempt(at, "cevap " + at, 1, 3, 1, false);
    }

    private List<String> timesOf(ProgressState state) {
        return state.attempts().stream().map(attempt -> (String) attempt.get("at")).toList();
    }

    /** 2026-01-firstDay .. 2026-01-lastDay arası, her gün için bir zaman damgası. */
    private String[] days(int firstDay, int lastDay) {
        return IntStream.rangeClosed(firstDay, lastDay)
                .mapToObj("2026-01-%02dT10:00:00Z"::formatted)
                .toArray(String[]::new);
    }
}
