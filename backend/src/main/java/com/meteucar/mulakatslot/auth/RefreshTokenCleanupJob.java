package com.meteucar.mulakatslot.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Süresi dolmuş refresh token satırlarını siler.
 *
 * <p>İptal edilmiş satırlar hemen silinmez: yeniden kullanım tespiti iptal
 * kaydının durmasına bağlı. Ama süresi dolmuş bir token zaten reddedildiği
 * için bir süre sonra taşımaya değmez.
 */
@Component
public class RefreshTokenCleanupJob {

    /**
     * Süresi dolduktan sonra 7 gün daha tutulur: bu pencerede gelen bir
     * token hâlâ tespit kaydıyla karşılaşır, sessizce "bilinmeyen token"a
     * dönüşmez.
     */
    private static final Duration RETENTION_AFTER_EXPIRY = Duration.ofDays(7);

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanupJob.class);

    private final RefreshTokenRepository refreshTokenRepository;
    private final Clock clock;

    public RefreshTokenCleanupJob(RefreshTokenRepository refreshTokenRepository, Clock clock) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.clock = clock;
    }

    /** Günde bir, gecenin trafiği düşük saatinde. */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public int deleteExpiredTokens() {
        OffsetDateTime cutoff = OffsetDateTime.now(clock).minus(RETENTION_AFTER_EXPIRY);
        int deleted = refreshTokenRepository.deleteExpiredBefore(cutoff);
        if (deleted > 0) {
            log.info("Temizlik: süresi {} tarihinden önce dolan {} refresh token silindi", cutoff, deleted);
        }
        return deleted;
    }
}
