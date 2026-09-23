package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.auth.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Bellek içi parçalar: hız sınırı, önbellek ve hafta hesabı. Veritabanı yok. */
class AiInMemoryGuardsTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-23T12:00:00Z"), ZoneId.of("UTC"));

    @Nested
    class RateLimiter {

        private final AiRateLimiter limiter = new AiRateLimiter(clock);
        private final UUID user = UUID.randomUUID();

        @Test
        void allowsFivePerMinuteThenRefuses() {
            for (int i = 0; i < AiRateLimiter.LIMIT; i++) {
                assertThat(limiter.tryAcquire(user)).as("istek %d", i + 1).isTrue();
            }
            assertThat(limiter.tryAcquire(user)).isFalse();
        }

        @Test
        void windowSlides() {
            for (int i = 0; i < AiRateLimiter.LIMIT; i++) {
                limiter.tryAcquire(user);
            }
            clock.advance(AiRateLimiter.WINDOW);

            assertThat(limiter.tryAcquire(user)).isTrue();
        }

        @Test
        void usersAreCountedSeparately() {
            for (int i = 0; i < AiRateLimiter.LIMIT; i++) {
                limiter.tryAcquire(user);
            }

            assertThat(limiter.tryAcquire(UUID.randomUUID())).isTrue();
        }
    }

    @Nested
    class Cache {

        private final AiEvaluationCache cache = new AiEvaluationCache(clock);
        private final AiEvaluation evaluation = new AiEvaluation(List.of("a"), List.of("b"), "f", "q");

        @Test
        void returnsStoredEvaluationUntilTtl() {
            String key = AiEvaluationCache.keyOf("q1", "cevap");
            cache.put(key, evaluation);

            clock.advance(AiEvaluationCache.TTL.minusSeconds(1));
            assertThat(cache.get(key)).contains(evaluation);

            clock.advance(Duration.ofSeconds(1));
            assertThat(cache.get(key)).isEmpty();
        }

        @Test
        void keyIgnoresCaseAndWhitespaceDifferences() {
            assertThat(AiEvaluationCache.keyOf("q1", "  İndeks  ve\n\nIŞIK "))
                    .isEqualTo(AiEvaluationCache.keyOf("q1", "indeks ve ışık"));
        }

        @Test
        void keyDependsOnQuestionAndAnswer() {
            String key = AiEvaluationCache.keyOf("q1", "cevap");

            assertThat(AiEvaluationCache.keyOf("q2", "cevap")).isNotEqualTo(key);
            assertThat(AiEvaluationCache.keyOf("q1", "başka cevap")).isNotEqualTo(key);
        }

        @Test
        void keyIsAHashNotTheAnswer() {
            assertThat(AiEvaluationCache.keyOf("q1", "gizli cevap")).hasSize(64).doesNotContain("gizli");
        }
    }

    @Nested
    class Week {

        @Test
        void startsOnMondayUtc() {
            // 2026-09-23 çarşamba
            AiWeek week = AiWeek.containing(Instant.parse("2026-09-23T12:00:00Z"));

            assertThat(week.start()).isEqualTo(LocalDate.parse("2026-09-21"));
            assertThat(week.resetsAt()).isEqualTo(Instant.parse("2026-09-28T00:00:00Z"));
        }

        @Test
        void sundayNightStillBelongsToTheSameWeek() {
            assertThat(AiWeek.containing(Instant.parse("2026-09-27T23:59:59Z")).start())
                    .isEqualTo(LocalDate.parse("2026-09-21"));
            assertThat(AiWeek.containing(Instant.parse("2026-09-28T00:00:00Z")).start())
                    .isEqualTo(LocalDate.parse("2026-09-28"));
        }
    }
}
