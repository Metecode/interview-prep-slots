package com.meteucar.mulakatslot.auth;

import com.meteucar.mulakatslot.config.JwtConfig;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Kısa ömürlü access token üretir. Token yalnızca yanıt gövdesinde döner;
 * cookie'ye yazılmaz, böylece tarayıcı onu isteklere kendiliğinden eklemez
 * ve CSRF yüzeyi oluşmaz.
 */
@Service
public class AccessTokenService {

    /**
     * 15 dakika: çalınan bir token'ın işe yarayacağı pencereyi dar tutar,
     * kullanıcıyı da dakikada bir yenilemeye zorlamaz.
     */
    public static final Duration TOKEN_TTL = Duration.ofMinutes(15);

    private final JwtEncoder jwtEncoder;

    public AccessTokenService(JwtEncoder jwtEncoder) {
        this.jwtEncoder = jwtEncoder;
    }

    public String issue(UUID userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtConfig.ISSUER)
                // sub kullanıcının UUID'si: kullanıcı adı GitHub'da
                // değişebilir, kimliğin kendisi değişmez.
                .subject(userId.toString())
                .issuedAt(now)
                .expiresAt(now.plus(TOKEN_TTL))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
