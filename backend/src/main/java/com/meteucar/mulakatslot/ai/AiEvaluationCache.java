package com.meteucar.mulakatslot.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Aynı soruya aynı cevap tekrar gelirse sağlayıcı yeniden çağrılmaz ve
 * kota düşmez. Bellek içi, 7 gün TTL; yeniden başlatmada boşalması sorun
 * değil, yalnızca bir sonraki istek sağlayıcıya gider.
 *
 * <p>Anahtar SHA-256(questionId, normalize edilmiş cevap, PROMPT_VERSION).
 * Cevap metni anahtarda düz durmaz, bellekte yalnızca özeti ve sonuç var.
 * Kullanıcı anahtara girmez: aynı cevabı yazan iki kişi aynı
 * değerlendirmeyi alır, sonuç kimseye özel değil.
 */
@Component
public class AiEvaluationCache {

    static final Duration TTL = Duration.ofDays(7);

    /** Üst sınır; aşılınca yeni sonuç önbelleğe yazılmaz, bellek taşmasın. */
    static final int MAX_ENTRIES = 10_000;

    private static final Locale TURKISH = Locale.forLanguageTag("tr");

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public AiEvaluationCache(Clock clock) {
        this.clock = clock;
    }

    public Optional<AiEvaluation> get(String key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.isExpired(clock.instant())) {
            entries.remove(key, entry);
            return Optional.empty();
        }
        return Optional.of(entry.evaluation());
    }

    public void put(String key, AiEvaluation evaluation) {
        if (entries.size() >= MAX_ENTRIES) {
            evictExpired();
            if (entries.size() >= MAX_ENTRIES) {
                return;
            }
        }
        entries.put(key, new Entry(evaluation, clock.instant().plus(TTL)));
    }

    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.HOURS)
    void evictExpired() {
        Instant now = clock.instant();
        entries.values().removeIf(entry -> entry.isExpired(now));
    }

    /** Testler arasında temiz başlangıç için. */
    void clear() {
        entries.clear();
    }

    public static String keyOf(String questionId, String answer) {
        String material = questionId + '\u0000' + normalize(answer) + '\u0000' + EvaluationPrompt.PROMPT_VERSION;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(material.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 her JVM'de bulunmak zorunda.
            throw new IllegalStateException(e);
        }
    }

    /**
     * Anlamı değiştirmeyen farklar aynı anahtara düşsün: Unicode biçimi
     * (NFC), baştaki/sondaki boşluk, art arda boşluk ve satır sonları,
     * büyük/küçük harf. Küçültme Türkçe kurallarıyla: "I" → "ı".
     */
    static String normalize(String answer) {
        String composed = Normalizer.normalize(answer, Normalizer.Form.NFC);
        return composed.strip().replaceAll("\\s+", " ").toLowerCase(TURKISH);
    }

    private record Entry(AiEvaluation evaluation, Instant expiresAt) {

        boolean isExpired(Instant now) {
            return !now.isBefore(expiresAt);
        }
    }
}
