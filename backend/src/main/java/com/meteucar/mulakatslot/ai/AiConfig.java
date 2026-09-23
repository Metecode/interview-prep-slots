package com.meteucar.mulakatslot.ai;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sağlayıcı seçimi. AI_PROVIDER hangi uygulamanın kurulacağını söyler;
 * anahtar yoksa hiçbir {@link AiEvaluator} bean'i kurulmaz ve özellik
 * kapalı sayılır — uygulama açılmaya devam eder, {@code /api/ai/status}
 * {@code enabled: false} döner. Local-first kararının karşılığı: AI hiçbir
 * zaman zorunlu yol değil.
 *
 * <p>Yeni bir sağlayıcı eklemek: {@link AiEvaluator}'ı uygula, burada kendi
 * koşuluyla bir bean tanımla. Geri kalan her şey (kota, önbellek,
 * doğrulama) sağlayıcıdan bağımsız.
 */
@Configuration
@EnableConfigurationProperties(AiProperties.class)
public class AiConfig {

    static final String PROVIDER_GEMINI = "gemini";

    @Bean
    @Conditional(GeminiConfigured.class)
    AiEvaluator geminiEvaluator(AiProperties properties, JsonMapper jsonMapper) {
        return GeminiEvaluator.create(properties.gemini(), jsonMapper);
    }

    /**
     * Ortamı doğrudan okur: koşul, bean'ler kurulmadan değerlendiriliyor.
     * SpEL ifadesi yerine sınıf, çünkü anahtarın değerini bir ifade
     * metnine gömmek istemiyoruz.
     */
    static class GeminiConfigured implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("app.ai.provider", "");
            String apiKey = context.getEnvironment().getProperty("app.ai.gemini.api-key", "");
            return PROVIDER_GEMINI.equalsIgnoreCase(provider.strip()) && !apiKey.isBlank();
        }
    }
}
