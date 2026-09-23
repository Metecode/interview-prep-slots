package com.meteucar.mulakatslot.ai;

import java.util.Locale;
import java.util.Set;

/**
 * Modelin desteklediği EN DÜŞÜK düşünme seviyesi. Rubriğe göre kavram
 * işaretlemek derin akıl yürütme istemiyor; Gemini'nin Flash modelleri ise
 * varsayılan olarak "medium" düşünüyor ve bu, cevaptan önce saniyeler
 * ekliyor.
 *
 * <p>Kaynak: ai.google.dev/gemini-api/docs/thinking, "Levels Supported"
 * tablosu (Eylül 2026). Parametre {@code generation_config.thinking_level}.
 * Hiçbir seviye düşünmeyi tamamen kapatmıyor.
 * <pre>
 * gemini-3.8-flash       low, medium, high            (varsayılan medium)
 * gemini-3.7-flash       low, medium, high
 * gemini-3.6-flash       minimal, low, medium, high
 * gemini-3.5-flash       minimal, low, medium, high   (varsayılan medium)
 * gemini-3.5-flash-lite  minimal, low, medium, high   (varsayılan minimal)
 * gemini-3-flash-preview minimal, low, medium, high
 * </pre>
 * Desteklenmeyen seviye göndermek isteği reddettirir; bu yüzden "minimal"
 * yalnızca tabloda onu desteklediği yazan modellere gider, geri kalan her
 * model (tabloda olmayan yeni modeller dahil) "low" alır — tablodaki
 * modellerin neredeyse tamamında desteklenen en düşük ortak seviye.
 *
 * <p>Not: {@code max_output_tokens} düşünme token'larını da sayıyor; sınıra
 * takılan istek {@code status: incomplete} ile boş/yarım döner. Bu yüzden
 * {@code max_output_tokens} hiç gönderilmiyor.
 */
final class GeminiThinking {

    static final String MINIMAL = "minimal";
    static final String LOW = "low";

    private static final Set<String> MINIMAL_SUPPORTED = Set.of(
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3-flash-preview");

    private GeminiThinking() {
    }

    static String lowestLevel(String model) {
        String normalized = model == null ? "" : model.strip().toLowerCase(Locale.ROOT);
        return MINIMAL_SUPPORTED.contains(normalized) ? MINIMAL : LOW;
    }
}
