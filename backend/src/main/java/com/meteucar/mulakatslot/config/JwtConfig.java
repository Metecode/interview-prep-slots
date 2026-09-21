package com.meteucar.mulakatslot.config;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * Access token'ı üreten ve doğrulayan HS256 bileşenleri. Simetrik anahtar
 * olduğu için encoder ve decoder aynı gizli değeri paylaşır.
 */
@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class JwtConfig {

    /** JWT'nin iss alanı; decoder aynı değeri şart koşar. */
    public static final String ISSUER = "mulakat-slot";

    /** HS256 için anahtar, hash çıktısı kadar (32 bayt) olmalı. */
    private static final int MINIMUM_SECRET_BYTES = 32;

    @Bean
    SecretKey accessTokenKey(AuthProperties properties) {
        byte[] secret = properties.jwtSecret() == null
                ? new byte[0]
                : properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
        // Kısa anahtar HS256'yı sessizce zayıflatır; uygulamayı burada
        // durdurup sorunu ilk açılışta görünür kılıyoruz.
        if (secret.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET en az %d bayt olmalı, şu an %d bayt".formatted(MINIMUM_SECRET_BYTES, secret.length));
        }
        return new SecretKeySpec(secret, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey accessTokenKey) {
        return NimbusJwtEncoder.withSecretKey(accessTokenKey).algorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey accessTokenKey) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(accessTokenKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        // Varsayılan doğrulamalara (exp, nbf) iss kontrolünü de ekliyoruz:
        // başka bir servisin aynı anahtarla ürettiği token kabul edilmesin.
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
        return decoder;
    }
}
