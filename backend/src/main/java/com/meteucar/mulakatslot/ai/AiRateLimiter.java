package com.meteucar.mulakatslot.ai;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Kullanıcı başına kayan pencere: dakikada en fazla {@link #LIMIT} istek.
 * Bellek içi, çünkü tek instance var; ikinci instance geldiğinde bu sınıf
 * paylaşılan bir depoya (Postgres ya da Redis) taşınmalı.
 *
 * <p>Kotadan ayrı bir şey korur: kota haftalık bütçe, bu ise kısa sürede
 * art arda gelen isteklerin (çift tıklama, döngüye girmiş istemci)
 * sağlayıcının ücretsiz katman sınırını tüketmesini önler. Önbellekten
 * dönen istekler de sayılır; bu kontrol ucuz ve her şeyden önce çalışır.
 */
@Component
public class AiRateLimiter {

    static final int LIMIT = 5;
    static final Duration WINDOW = Duration.ofMinutes(1);

    private final Map<UUID, Deque<Instant>> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public AiRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** İzin verildiyse isteği pencereye yazar ve true döner. */
    public boolean tryAcquire(UUID userId) {
        Instant now = clock.instant();
        AtomicBoolean allowed = new AtomicBoolean(false);
        // compute anahtar başına atomik: aynı kullanıcının iki isteği
        // pencereyi aynı anda okuyup ikisi de "yer var" diyemez.
        windows.compute(userId, (id, times) -> {
            Deque<Instant> window = times == null ? new ArrayDeque<>() : times;
            dropExpired(window, now);
            if (window.size() < LIMIT) {
                window.addLast(now);
                allowed.set(true);
            }
            return window;
        });
        return allowed.get();
    }

    /** Boşalan pencereler silinir; harita kullanıcı sayısıyla sınırsız büyümesin. */
    @Scheduled(fixedDelay = 10, timeUnit = TimeUnit.MINUTES)
    void evictIdle() {
        Instant now = clock.instant();
        for (UUID userId : windows.keySet()) {
            windows.computeIfPresent(userId, (id, window) -> {
                dropExpired(window, now);
                return window.isEmpty() ? null : window;
            });
        }
    }

    private static void dropExpired(Deque<Instant> window, Instant now) {
        Instant cutoff = now.minus(WINDOW);
        while (!window.isEmpty() && !window.peekFirst().isAfter(cutoff)) {
            window.pollFirst();
        }
    }
}
