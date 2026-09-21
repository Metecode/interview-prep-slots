package com.meteucar.mulakatslot.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class RefreshTokenCleanupJobTest {

    @Autowired
    private RefreshTokenCleanupJob cleanupJob;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    private AppUser user;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-cleanup", "metecode"));
    }

    @Test
    void deletesLongExpiredTokensAndKeepsTheRest() {
        OffsetDateTime now = OffsetDateTime.now();
        save("cok-eski", now.minusDays(30));
        // Süresi dolmuş ama yeni: tespit kaydı olarak duruyor, silinmiyor.
        save("yeni-dolmus", now.minusDays(3));
        save("gecerli", now.plusDays(30));

        assertThat(cleanupJob.deleteExpiredTokens()).isEqualTo(1);

        assertThat(refreshTokenRepository.findByUserId(user.getId()))
                .extracting(RefreshToken::getTokenHash)
                .containsExactlyInAnyOrder("yeni-dolmus", "gecerli");
    }

    @Test
    void deletesNothingWhenEverythingIsRecent() {
        save("gecerli", OffsetDateTime.now().plusDays(30));

        assertThat(cleanupJob.deleteExpiredTokens()).isZero();
        assertThat(refreshTokenRepository.findByUserId(user.getId())).hasSize(1);
    }

    /** Özet değeri doğrudan yazıyoruz: burada önemli olan yalnızca expires_at. */
    private void save(String tokenHash, OffsetDateTime expiresAt) {
        refreshTokenRepository.save(new RefreshToken(user, tokenHash, expiresAt));
    }
}
