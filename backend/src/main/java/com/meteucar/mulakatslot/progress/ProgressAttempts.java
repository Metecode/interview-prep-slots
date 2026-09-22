package com.meteucar.mulakatslot.progress;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Deneme geçmişinin birleştirilmesi.
 *
 * <p>box ve lastSeenAt için "yeni kazanır" kuralı işliyor, ama attempts için
 * işlemez: kullanıcının yazdığı cevaplar burada ve iki cihazda farklı
 * denemeler varsa hiçbiri fazlalık değil. Eski bir kayıt gelse bile geçmişi
 * birleştiriyoruz; kaybedilen cevap geri gelmez.
 */
final class ProgressAttempts {

    /** Son N deneme tutulur; frontend'de de aynı sınır var (progress.ts). */
    static final int MAX_ATTEMPTS = 10;

    /** Denemeyi tekilleştiren ve sıralayan alan. */
    private static final String TIMESTAMP_FIELD = "at";

    private ProgressAttempts() {
    }

    /**
     * İki listeyi birleştirir: aynı {@code at} tek deneme sayılır, sonuç
     * zamana göre sıralanır ve en yeni {@link #MAX_ATTEMPTS} tanesi kalır.
     */
    static List<Map<String, Object>> merge(
            List<Map<String, Object>> stored, List<Map<String, Object>> incoming) {

        Map<String, Map<String, Object>> byTimestamp = new LinkedHashMap<>();
        collectInto(byTimestamp, stored);
        // Gelen aynı at'i taşıyorsa üstüne yazar; ikisi de aynı denemeyi
        // anlatıyor, hangisinin kaldığı sonucu değiştirmiyor.
        collectInto(byTimestamp, incoming);

        List<Map<String, Object>> merged = new ArrayList<>(byTimestamp.values());
        // at, Date#toISOString() ile yazılıyor: UTC ve sabit biçim. Bu
        // biçimde sözlük sırası zaman sırasının aynısı, ayrıştırmaya gerek yok.
        merged.sort(Comparator.comparing(attempt -> (String) attempt.get(TIMESTAMP_FIELD)));

        if (merged.size() <= MAX_ATTEMPTS) {
            return merged;
        }
        // Sınır aşıldığında en eskiler düşer.
        return new ArrayList<>(merged.subList(merged.size() - MAX_ATTEMPTS, merged.size()));
    }

    private static void collectInto(Map<String, Map<String, Object>> byTimestamp,
            List<Map<String, Object>> attempts) {
        if (attempts == null) {
            return;
        }
        for (Map<String, Object> attempt : attempts) {
            if (attempt == null) {
                continue;
            }
            // at yoksa hangi deneme olduğunu bilemeyiz; tekilleştirme de
            // sıralama da buna dayanıyor. Sessizce atlanır.
            if (attempt.get(TIMESTAMP_FIELD) instanceof String timestamp && !timestamp.isBlank()) {
                byTimestamp.put(timestamp, attempt);
            }
        }
    }
}
