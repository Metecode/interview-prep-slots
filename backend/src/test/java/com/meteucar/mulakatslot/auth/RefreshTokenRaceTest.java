package com.meteucar.mulakatslot.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

/**
 * Eşzamanlı yenilemenin meşru kullanıcıyı dışarı atmadığını doğrular:
 * aynı cookie'yi taşıyan iki sekme ya da React StrictMode'un çift efekti.
 */
@Import({TestcontainersConfiguration.class, RefreshTokenRaceTest.MutableClockConfiguration.class})
@SpringBootTest
class RefreshTokenRaceTest {

    @TestConfiguration
    static class MutableClockConfiguration {

        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(Instant.parse("2026-09-21T12:00:00Z"), ZoneId.of("UTC"));
        }
    }

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private MutableClock clock;

    @Autowired
    private Clock injectedClock;

    private AppUser user;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-race", "metecode"));
    }

    @Test
    void servicesUseTheTestClock() {
        // Diğer testlerin anlamı buna bağlı: gerçek saat enjekte edilseydi
        // "10 saniye sonra" senaryosu sessizce yanlış şeyi ölçerdi.
        assertThat(injectedClock).isSameAs(clock);
    }

    @Test
    void twoSimultaneousRotationsProduceExactlyOneNewToken() throws Exception {
        String shared = refreshTokenService.issue(user);
        String otherDevice = refreshTokenService.issue(user);

        CountDownLatch startSignal = new CountDownLatch(1);
        Callable<String> rotate = () -> {
            startSignal.await(5, TimeUnit.SECONDS);
            return refreshTokenService.rotate(shared).value();
        };

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> attempts = List.of(pool.submit(rotate), pool.submit(rotate));
            startSignal.countDown();

            int succeeded = 0;
            int rejected = 0;
            for (Future<String> attempt : attempts) {
                try {
                    assertThat(attempt.get(10, TimeUnit.SECONDS)).isNotBlank();
                    succeeded++;
                } catch (java.util.concurrent.ExecutionException e) {
                    assertThat(e.getCause()).isInstanceOf(InvalidRefreshTokenException.class);
                    rejected++;
                }
            }

            assertThat(succeeded).isEqualTo(1);
            assertThat(rejected).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        // İki değil tek yeni token: eski + diğer cihaz + yeni = 3.
        assertThat(refreshTokenRepository.findByUserId(user.getId())).hasSize(3);

        // En önemlisi: diğer sekmenin isteği toplu iptali tetiklemedi.
        assertThat(tokenFor(otherDevice).isRevoked()).isFalse();
        assertThat(refreshTokenRepository.findByUserId(user.getId()))
                .filteredOn(RefreshToken::isRevoked)
                .singleElement()
                .extracting(RefreshToken::getRevokedReason)
                .isEqualTo(RevocationReason.ROTATED);
    }

    @Test
    void rotatedTokenWithinGraceWindowDoesNotRevokeOtherSessions() {
        String shared = refreshTokenService.issue(user);
        String otherDevice = refreshTokenService.issue(user);
        String rotated = refreshTokenService.rotate(shared).value();

        clock.advance(Duration.ofSeconds(3));

        assertThatThrownBy(() -> refreshTokenService.rotate(shared))
                .isInstanceOf(InvalidRefreshTokenException.class);

        assertThat(tokenFor(otherDevice).isRevoked()).isFalse();
        assertThat(tokenFor(rotated).isRevoked()).isFalse();
    }

    @Test
    void rotatedTokenAfterGraceWindowRevokesEverything() {
        String shared = refreshTokenService.issue(user);
        String otherDevice = refreshTokenService.issue(user);
        String rotated = refreshTokenService.rotate(shared).value();

        clock.advance(Duration.ofSeconds(11));

        assertThatThrownBy(() -> refreshTokenService.rotate(shared))
                .isInstanceOf(InvalidRefreshTokenException.class);

        assertThat(tokenFor(otherDevice).getRevokedReason()).isEqualTo(RevocationReason.REUSE_DETECTED);
        assertThat(tokenFor(rotated).getRevokedReason()).isEqualTo(RevocationReason.REUSE_DETECTED);
    }

    @Test
    void logoutRevokedTokenIsAlwaysTreatedAsReuse() {
        String loggedOut = refreshTokenService.issue(user);
        String otherDevice = refreshTokenService.issue(user);
        refreshTokenService.revoke(loggedOut);

        // Tolerans penceresi beklemeden, aynı anda: çıkış rotasyon değil.
        assertThatThrownBy(() -> refreshTokenService.rotate(loggedOut))
                .isInstanceOf(InvalidRefreshTokenException.class);

        assertThat(tokenFor(loggedOut).getRevokedReason()).isEqualTo(RevocationReason.LOGOUT);
        assertThat(tokenFor(otherDevice).getRevokedReason()).isEqualTo(RevocationReason.REUSE_DETECTED);
    }

    /**
     * Düz değerden satırı bulur. Saklanan biçimin doğruluğunu RefreshFlowTest
     * bağımsız olarak doğruluyor; burada amaç yalnızca satıra ulaşmak.
     */
    private RefreshToken tokenFor(String value) {
        return refreshTokenRepository.findByUserId(user.getId()).stream()
                .filter(token -> token.getTokenHash().equals(RefreshTokenHashes.of(value)))
                .findFirst()
                .orElseThrow(() -> new AssertionError("token bulunamadı"));
    }
}
