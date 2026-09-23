package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Eşzamanlı istekler limiti aşmamalı. Oku-kontrol et-yaz kurgusunda iki
 * istek de "bir hak kaldı" görüp ikisi de artırırdı; koşullu upsert bunu
 * tek ifadede çözüyor. Bu testler o ifade düz bir UPSERT'e dönerse düşer.
 *
 * <p>Import seti {@link AiEndpointsTest} ile aynı: context ve Postgres
 * konteyneri paylaşılır.
 */
@Import({TestcontainersConfiguration.class, FakeAiEvaluator.Config.class})
@SpringBootTest
class AiQuotaRaceTest {

    private static final AiWeek WEEK = AiWeek.containing(Instant.parse("2026-09-23T12:00:00Z"));

    @Autowired
    private AiQuotaService quotaService;

    @Autowired
    private AppUserRepository appUserRepository;

    private AppUser user;

    @BeforeEach
    void setUp() {
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-ai-race", "metecode"));
    }

    /** Son hak için iki istek: biri alır, diğeri reddedilir. */
    @Test
    void twoConcurrentRequestsForTheLastSlot() throws Exception {
        int limit = 3;
        quotaService.tryConsume(user.getId(), WEEK, limit);
        quotaService.tryConsume(user.getId(), WEEK, limit);

        List<OptionalInt> results = consumeConcurrently(2, limit);

        assertThat(results.stream().filter(OptionalInt::isPresent).count()).isEqualTo(1);
        assertThat(quotaService.used(user.getId(), WEEK)).isEqualTo(limit);
    }

    /** Satır henüz yokken: iki INSERT yarışır, biri çakışıp UPDATE dalına düşer. */
    @Test
    void twoConcurrentFirstRequestsWithLimitOne() throws Exception {
        List<OptionalInt> results = consumeConcurrently(2, 1);

        assertThat(results.stream().filter(OptionalInt::isPresent).count()).isEqualTo(1);
        assertThat(quotaService.used(user.getId(), WEEK)).isEqualTo(1);
    }

    @Test
    void manyConcurrentRequestsStopExactlyAtTheLimit() throws Exception {
        int limit = 5;

        List<OptionalInt> results = consumeConcurrently(12, limit);

        assertThat(results.stream().filter(OptionalInt::isPresent).count()).isEqualTo(limit);
        assertThat(quotaService.used(user.getId(), WEEK)).isEqualTo(limit);
    }

    @Test
    void refundNeverGoesBelowZero() {
        quotaService.tryConsume(user.getId(), WEEK, 5);

        quotaService.refund(user.getId(), WEEK);
        quotaService.refund(user.getId(), WEEK);

        assertThat(quotaService.used(user.getId(), WEEK)).isZero();
    }

    @Test
    void zeroLimitNeverConsumes() {
        assertThat(quotaService.tryConsume(user.getId(), WEEK, 0)).isEmpty();
        assertThat(quotaService.used(user.getId(), WEEK)).isZero();
    }

    private List<OptionalInt> consumeConcurrently(int requests, int limit) throws Exception {
        CountDownLatch startSignal = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        try {
            List<Future<OptionalInt>> calls = new ArrayList<>();
            for (int i = 0; i < requests; i++) {
                calls.add(pool.submit(() -> {
                    startSignal.await(5, TimeUnit.SECONDS);
                    return quotaService.tryConsume(user.getId(), WEEK, limit);
                }));
            }
            startSignal.countDown();

            List<OptionalInt> results = new ArrayList<>();
            for (Future<OptionalInt> call : calls) {
                results.add(call.get(10, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
