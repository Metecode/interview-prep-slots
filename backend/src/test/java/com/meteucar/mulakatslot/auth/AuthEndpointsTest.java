package com.meteucar.mulakatslot.auth;

import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.config.JwtConfig;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Hangi ucun token istediğini, istemeyen ucun hesapsız da çalıştığını ve
 * 401'in yönlendirme değil JSON döndüğünü doğrular.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthEndpointsTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private AccessTokenService accessTokenService;

    @Autowired
    private SecretKey accessTokenKey;

    private AppUser user;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-endpoints", "metecode"));
    }

    @Test
    void publicEndpointsWorkWithoutToken() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("up"));

        mockMvc.perform(get("/api/questions"))
                .andExpect(status().isOk());
    }

    @Test
    void meWithoutTokenReturnsJsonNotRedirect() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    @Test
    void meWithValidTokenReturnsUser() throws Exception {
        String accessToken = accessTokenService.issue(user.getId());

        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.username").value("metecode"));
    }

    @Test
    void meWithBrokenTokenReturnsJson() throws Exception {
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer bu-bir-jwt-degil"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    /**
     * Aynı anahtarı kullanan başka bir servisin ürettiği token kabul
     * edilmemeli: imza doğru olsa bile iss bizim değil.
     */
    @Test
    void tokenSignedWithAnotherIssuerIsRejected() throws Exception {
        String foreignToken = tokenWithIssuer("baska-servis");

        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + foreignToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));

        // Aynı üretim yolu doğru iss ile çalışıyor: reddin tek sebebi iss.
        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenWithIssuer(JwtConfig.ISSUER)))
                .andExpect(status().isOk());
    }

    /**
     * Bir uç hata verdiğinde konteyner isteği /error'a iletir. Orası kapalı
     * olsaydı her hata 401'e dönüşür ve gerçek sebep kaybolurdu.
     */
    @Test
    void errorDispatchIsNotMaskedAsUnauthorized() throws Exception {
        mockMvc.perform(get("/error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error", not("unauthorized")));
    }

    /**
     * Varsayılan kapalı: sayılmayan bir yol token'sız 401 döner, 404 değil.
     * Bu bilinçli — hangi uçların var olduğunu kimliği doğrulanmamış
     * isteklere sızdırmıyoruz. 404'ü görmek için token gerekir.
     */
    @Test
    void unknownPathRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/yok"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));

        mockMvc.perform(get("/api/yok")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessTokenService.issue(user.getId())))
                .andExpect(status().isNotFound());
    }

    /**
     * Süresi dolmuş bir Bearer başlığı, ucun herkese açık olması fark
     * etmeksizin 401 döndürür: token varsa doğrulama filtresi onu denemek
     * zorunda ve başarısızlık yetkilendirme kurallarından önce gelir.
     * Frontend bunu 401 olarak görüp yenileyip isteği tekrarlamalı.
     */
    @Test
    void expiredTokenFailsEvenOnPublicEndpoint() throws Exception {
        Instant now = Instant.now();
        // JwtTimestampValidator'ın 60 saniyelik saat toleransının dışında kalsın.
        String expired = tokenWithIssuer(
                JwtConfig.ISSUER, now.minus(Duration.ofMinutes(20)), now.minus(Duration.ofMinutes(5)));

        mockMvc.perform(get("/api/questions").header(HttpHeaders.AUTHORIZATION, "Bearer " + expired))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));

        // Başlık hiç yoksa aynı uç açık.
        mockMvc.perform(get("/api/questions"))
                .andExpect(status().isOk());
    }

    private String tokenWithIssuer(String issuer) {
        Instant now = Instant.now();
        return tokenWithIssuer(issuer, now, now.plus(Duration.ofMinutes(15)));
    }

    /** Uygulamanın kendi anahtarıyla, istenen iss ve geçerlilik aralığıyla token üretir. */
    private String tokenWithIssuer(String issuer, Instant issuedAt, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(user.getId().toString())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        return NimbusJwtEncoder.withSecretKey(accessTokenKey).algorithm(MacAlgorithm.HS256).build()
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }
}
