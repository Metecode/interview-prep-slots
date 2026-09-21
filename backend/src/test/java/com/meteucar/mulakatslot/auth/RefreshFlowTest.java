package com.meteucar.mulakatslot.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Rotasyon, yeniden kullanım tespiti ve çıkış. Tek bir refresh token'ın
 * yalnızca bir kez işe yaradığını doğrular.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class RefreshFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    private AppUser user;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-refresh", "metecode"));
    }

    @Test
    void storesOnlyTheHashNotThePlainValue() {
        String value = refreshTokenService.issue(user);

        List<RefreshToken> stored = refreshTokenRepository.findByUserId(user.getId());
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getTokenHash()).isEqualTo(sha256Hex(value)).isNotEqualTo(value);
    }

    @Test
    void rotationInvalidatesTheUsedToken() throws Exception {
        String first = refreshTokenService.issue(user);

        MvcResult result = mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(first)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.user.username").value("metecode"))
                .andReturn();

        Cookie rotated = result.getResponse().getCookie(RefreshTokenCookie.NAME);
        assertThat(rotated).isNotNull();
        assertThat(rotated.getValue()).isNotEqualTo(first);
        assertThat(rotated.isHttpOnly()).isTrue();
        assertThat(rotated.getPath()).isEqualTo("/api/auth");

        // Yeni token çalışmaya devam eder.
        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(rotated.getValue())))
                .andExpect(status().isOk());

        // Kullanılmış token ikinci kez kabul edilmez. (Rotasyondan hemen
        // sonra geldiği için eşzamanlı istek sayılır, toplu iptal olmaz;
        // tolerans penceresi RefreshTokenRaceTest'te.)
        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(first)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    /**
     * Çıkışla iptal edilmiş bir token'ın geri gelmesi her zaman yeniden
     * kullanımdır; rotasyonun tersine tolerans penceresi yok, o yüzden bu
     * senaryo gerçek saatle beklemeden çalışıyor. Rotasyon tarafındaki
     * pencere davranışı RefreshTokenRaceTest'te, sabit saatle.
     */
    @Test
    void reuseOfRevokedTokenRevokesEveryTokenOfTheUser() throws Exception {
        String stolen = refreshTokenService.issue(user);
        String otherDevice = refreshTokenService.issue(user);

        mockMvc.perform(post("/api/auth/logout").cookie(refreshCookie(stolen)))
                .andExpect(status().isNoContent());

        // Saldırgan çıkıştan önce kopyaladığı değeri kullanmayı dener.
        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(stolen)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));

        assertThat(refreshTokenRepository.findByUserId(user.getId()))
                .isNotEmpty()
                .allMatch(RefreshToken::isRevoked);

        // Meşru oturum da düşer: hangisinin saldırganda olduğunu bilmiyoruz.
        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(otherDevice)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        String value = "suresi-dolmus-token-degeri";
        refreshTokenRepository.save(
                new RefreshToken(user, sha256Hex(value), OffsetDateTime.now().minusDays(1)));

        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(value)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    @Test
    void missingCookieIsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    @Test
    void logoutRevokesTheTokenAndClearsTheCookie() throws Exception {
        String value = refreshTokenService.issue(user);

        MvcResult result = mockMvc.perform(post("/api/auth/logout").cookie(refreshCookie(value)))
                .andExpect(status().isNoContent())
                .andReturn();

        Cookie cleared = result.getResponse().getCookie(RefreshTokenCookie.NAME);
        assertThat(cleared).isNotNull();
        assertThat(cleared.getMaxAge()).isZero();
        assertThat(cleared.getValue()).isEmpty();

        assertThat(refreshTokenRepository.findByTokenHash(sha256Hex(value)))
                .get()
                .matches(RefreshToken::isRevoked);

        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie(value)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithoutCookieStillSucceeds() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent());
    }

    private Cookie refreshCookie(String value) {
        return new Cookie(RefreshTokenCookie.NAME, value);
    }

    /** Servisin sakladığı biçim; testin beklentisi açıkça yazılı olsun diye burada da hesaplanıyor. */
    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
