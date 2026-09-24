package com.meteucar.mulakatslot.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DatabindException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Denemenin JSON sözleşmesi. Spring bağlamı yok: mapper, Spring Boot'un
 * yaptığı gibi FAIL_ON_UNKNOWN_PROPERTIES kapalı kuruluyor — katılığın global
 * ayara değil DTO'nun kendisine bağlı olduğunu göstermek için. Gerçek
 * mapper'la uçtan uca davranış ProgressSyncTest'te.
 */
class ProgressAttemptTest {

    private static final String SECRET = "GIZLI-CEVAP-METNI";

    private final JsonMapper lenientMapper = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    @Test
    void knownFieldsAreRead() {
        ProgressAttempt attempt = lenientMapper.readValue("""
                { "at": "2026-01-01T10:00:00.000Z", "answer": "cevap", "hitCount": 1,
                  "totalConcepts": 3, "selfRating": 2, "passed": false }
                """, ProgressAttempt.class);

        assertThat(attempt).isEqualTo(new ProgressAttempt("2026-01-01T10:00:00.000Z", "cevap", 1, 3, 2, false));
    }

    @Test
    void unknownFieldIsRejectedEvenWhenTheMapperIsLenient() {
        String json = """
                { "at": "2026-01-01T10:00:00.000Z", "answer": "cevap", "hitCount": 1,
                  "totalConcepts": 3, "selfRating": 2, "passed": false, "extra": "%s" }
                """.formatted(SECRET);

        assertThatThrownBy(() -> lenientMapper.readValue(json, ProgressAttempt.class))
                .isInstanceOf(DatabindException.class)
                // Spring bu hatayı WARN ile logluyor; bilinmeyen alanın değeri
                // kullanıcının metni olabilir, mesaja girmemeli.
                .satisfies(error -> assertThat(error.getMessage()).doesNotContain(SECRET));
    }

    /** Liste içinde de aynı: ProgressRecord.attempts bu yoldan okunuyor. */
    @Test
    void unknownFieldInsideAListIsRejected() {
        String json = """
                [{ "at": "2026-01-01T10:00:00.000Z", "answer": "cevap", "hitCount": 1,
                   "totalConcepts": 3, "selfRating": 2, "passed": false, "extra": 1 }]
                """;

        assertThatThrownBy(() -> lenientMapper.readValue(json, new TypeReference<List<ProgressAttempt>>() {
        })).isInstanceOf(DatabindException.class);
    }

    /** Eksik alan şekil ihlali değil, değer ihlali: null kalır, doğrulayıcı eler. */
    @Test
    void missingFieldStaysNull() {
        ProgressAttempt attempt = lenientMapper.readValue("{ \"at\": \"2026-01-01T10:00:00.000Z\" }",
                ProgressAttempt.class);

        assertThat(attempt.answer()).isNull();
        assertThat(attempt.passed()).isNull();
    }

    @Test
    void serializedFormHasExactlyTheSixFields() {
        String json = lenientMapper.writeValueAsString(
                new ProgressAttempt("2026-01-01T10:00:00.000Z", "cevap", 1, 3, 2, false));

        Map<String, Object> fields = lenientMapper.readValue(json, new TypeReference<Map<String, Object>>() {
        });
        assertThat(fields).containsOnlyKeys("at", "answer", "hitCount", "totalConcepts", "selfRating", "passed");
    }

    @Test
    void storedFormHasExactlyTheSixFields() {
        Map<String, Object> stored = new ProgressAttempt("2026-01-01T10:00:00.000Z", "cevap", 1, 3, 2, false)
                .toStored();

        assertThat(stored).containsExactly(
                Map.entry("at", "2026-01-01T10:00:00.000Z"),
                Map.entry("answer", "cevap"),
                Map.entry("hitCount", 1),
                Map.entry("totalConcepts", 3),
                Map.entry("selfRating", 2),
                Map.entry("passed", false));
    }

    /** Eski bir satır okunurken hata yok; tanınmayan anahtar yanıta taşınmaz. */
    @Test
    void readingAStoredAttemptIsTolerant() {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("at", "2026-01-01T10:00:00.000Z");
        legacy.put("answer", "cevap");
        legacy.put("hitCount", "bir");
        legacy.put("selfRating", 1);
        legacy.put("eskiAlan", true);

        ProgressAttempt attempt = ProgressAttempt.fromStored(legacy);

        assertThat(attempt).isEqualTo(new ProgressAttempt("2026-01-01T10:00:00.000Z", "cevap", null, null, 1, null));
    }

    /** Saklanan biçimden okunup tekrar yazılan deneme aynı kalır. */
    @Test
    void storedRoundTripIsLossless() {
        ProgressAttempt attempt = new ProgressAttempt("2026-01-01T10:00:00.000Z", "cevap", 0, 1, 0, true);

        assertThat(ProgressAttempt.fromStored(attempt.toStored())).isEqualTo(attempt);
    }
}
