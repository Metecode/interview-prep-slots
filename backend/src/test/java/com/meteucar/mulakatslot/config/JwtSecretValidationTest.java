package com.meteucar.mulakatslot.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

/**
 * Kısa bir JWT_SECRET sessizce kabul edilirse imza zayıflar ve bu üretimde
 * fark edilmez. Bu yüzden uygulama açılışta durmalı. Tam uygulama bağlamı
 * yerine yalnızca JwtConfig çalıştırılıyor: kontrol veritabanına bağlı değil.
 */
class JwtSecretValidationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(JwtConfig.class)
            .withPropertyValues(
                    "app.auth.app-base-url=http://localhost:5173",
                    "app.auth.cookie-secure=true");

    @Test
    void contextFailsWhenSecretIsShorterThan32Bytes() {
        contextRunner.withPropertyValues("app.auth.jwt-secret=cok-kisa-bir-anahtar")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure()
                        .rootCause()
                        .hasMessageContaining("JWT_SECRET en az 32 bayt olmalı"));
    }

    @Test
    void contextFailsWhenSecretIsMissing() {
        contextRunner.run(context -> assertThat(context).hasFailed()
                .getFailure()
                .rootCause()
                .hasMessageContaining("JWT_SECRET en az 32 bayt olmalı"));
    }

    @Test
    void contextStartsWithLongEnoughSecret() {
        contextRunner.withPropertyValues("app.auth.jwt-secret=tam-otuz-iki-bayttan-uzun-bir-anahtar")
                .run(context -> assertThat(context).hasNotFailed()
                        .hasSingleBean(JwtEncoder.class)
                        .hasSingleBean(JwtDecoder.class));
    }
}
