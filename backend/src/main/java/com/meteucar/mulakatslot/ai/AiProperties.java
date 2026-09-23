package com.meteucar.mulakatslot.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Yapay zekâ ayarları. Değerler application.yml üzerinden ortam
 * değişkenlerinden gelir (AI_PROVIDER, AI_WEEKLY_LIMIT, GEMINI_API_KEY,
 * GEMINI_MODEL); anahtar kaynak koda gömülmez.
 *
 * @param provider    hangi sağlayıcının kullanılacağı ("gemini"); boşsa
 *                    özellik kapalı
 * @param weeklyLimit kullanıcı başına haftalık değerlendirme hakkı
 * @param gemini      Gemini'ye özgü ayarlar
 */
@ConfigurationProperties(prefix = "app.ai")
public record AiProperties(
        String provider,
        @DefaultValue("20") int weeklyLimit,
        @DefaultValue Gemini gemini) {

    /**
     * @param apiKey Gemini API anahtarı; boşsa sağlayıcı kurulmaz
     * @param model  model kodu, örn. gemini-3.5-flash
     */
    public record Gemini(String apiKey, @DefaultValue(DEFAULT_MODEL) String model) {

        public static final String DEFAULT_MODEL = "gemini-3.5-flash";

        /**
         * .env'de boş bırakılmış GEMINI_MODEL= satırı varsayılana düşmez,
         * boş metin olarak gelir; model adı boş istek 400 alırdı.
         */
        public Gemini {
            if (model == null || model.isBlank()) {
                model = DEFAULT_MODEL;
            }
        }
    }
}
