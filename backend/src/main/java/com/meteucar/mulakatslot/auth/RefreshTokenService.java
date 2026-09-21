package com.meteucar.mulakatslot.auth;

import com.meteucar.mulakatslot.user.AppUser;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh token'ların üretimi, döndürülmesi (rotation) ve iptali.
 *
 * <p>Her yenilemede eski token iptal edilir ve yenisi verilir. İptal edilmiş
 * bir token yeniden gelirse bu çoğunlukla token'ın kopyalandığı anlamına
 * gelir: o kullanıcının tüm token'ları iptal edilir, meşru oturum da dahil.
 * Tek istisna {@link #REUSE_GRACE} penceresi — aşağıdaki açıklamaya bakın.
 */
@Service
public class RefreshTokenService {

    /** 30 gün: kullanıcı ayda bir kez bile girse oturumu düşmez. */
    public static final Duration TOKEN_TTL = Duration.ofDays(30);

    /** 256 bit entropi; kaba kuvvetle tahmin edilemeyecek kadar geniş. */
    private static final int TOKEN_BYTES = 32;

    /**
     * Rotasyonla iptal edilmiş bir token bu süre içinde tekrar gelirse
     * yeniden kullanım sayılmaz.
     *
     * <p>Refresh cookie'si aynı tarayıcının tüm sekmeleri arasında paylaşılıyor.
     * İki sekme (ya da React StrictMode'un çift efekti) aynı anda yenileme
     * isteği gönderdiğinde ikisi de aynı düz değeri taşır; satır kilidi
     * ikinciyi sıraya sokar ama o istek yine de iptal edilmiş bir token
     * görür. Bunu saldırı saymak, meşru kullanıcının tüm oturumlarını
     * kapatırdı. İkinci istek 401 alıp tekrar denediğinde cookie'de artık
     * birincinin yazdığı yeni token var, o yüzden kayıp yok.
     *
     * <p>Pencere yalnızca sebebi 'rotated' olan iptaller için geçerli:
     * çıkışla ya da tespitle iptal edilmiş bir token hemen gelse bile
     * gerçek yeniden kullanımdır.
     */
    private static final Duration REUSE_GRACE = Duration.ofSeconds(10);

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

    private final RefreshTokenRepository refreshTokenRepository;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, Clock clock) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.clock = clock;
    }

    /**
     * Yeni bir token üretip özetini kaydeder. Düz değer yalnızca burada,
     * yalnızca bir kez görünür; çağıran onu cookie'ye yazar.
     */
    @Transactional
    public String issue(AppUser user) {
        byte[] raw = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(raw);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        OffsetDateTime expiresAt = OffsetDateTime.now(clock).plus(TOKEN_TTL);
        refreshTokenRepository.save(new RefreshToken(user, RefreshTokenHashes.of(value), expiresAt));
        return value;
    }

    /**
     * Geçerli bir token'ı yenisiyle değiştirir.
     *
     * <p>noRollbackFor: yeniden kullanım tespitinde önce kullanıcının tüm
     * token'larını iptal edip sonra hata fırlatıyoruz. Varsayılan davranışta
     * RuntimeException transaction'ı geri alır ve iptaller kaybolurdu.
     */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public RotatedToken rotate(String value) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        // Kilitli okuma: aynı token'la gelen eşzamanlı istekler burada sıraya girer.
        RefreshToken current = refreshTokenRepository.findForRotationByTokenHash(RefreshTokenHashes.of(value))
                .orElseThrow(() -> new InvalidRefreshTokenException("bilinmeyen refresh token"));

        if (current.isRevoked()) {
            handleRevokedToken(current, now);
        }
        if (current.isExpired(now)) {
            throw new InvalidRefreshTokenException("süresi dolmuş refresh token");
        }

        current.revoke(now, RevocationReason.ROTATED);
        // Kullanıcı alanları transaction içinde okunuyor: open-in-view kapalı,
        // lazy proxy controller'a gittiğinde artık açılamaz.
        AppUser user = current.getUser();
        return new RotatedToken(user.getId(), user.getUsername(), issue(user));
    }

    /** Her iki yol da 401 ile biter; ayrıldıkları nokta toplu iptal yapılıp yapılmadığı. */
    private void handleRevokedToken(RefreshToken current, OffsetDateTime now) {
        AppUser user = current.getUser();

        if (isConcurrentRefresh(current, now)) {
            log.debug("Eşzamanlı yenileme: rotasyonla iptal edilmiş token {} sn içinde tekrar geldi (user_id={})",
                    REUSE_GRACE.toSeconds(), user.getId());
            throw new InvalidRefreshTokenException("eşzamanlı yenileme, token zaten döndürülmüş");
        }

        int revoked = refreshTokenRepository.revokeAllForUser(user.getId(), now, RevocationReason.REUSE_DETECTED);
        log.warn("İptal edilmiş refresh token yeniden kullanıldı, kullanıcının {} token'ı iptal edildi "
                + "(user_id={}, iptal sebebi={})", revoked, user.getId(), current.getRevokedReason());
        throw new InvalidRefreshTokenException("iptal edilmiş refresh token yeniden kullanıldı");
    }

    private boolean isConcurrentRefresh(RefreshToken current, OffsetDateTime now) {
        return current.getRevokedReason() == RevocationReason.ROTATED
                && current.getRevokedAt().isAfter(now.minus(REUSE_GRACE));
    }

    /**
     * Çıkışta çağrılır. Bilinmeyen ya da zaten iptal edilmiş bir değer hata
     * değildir: çıkış her durumda başarılı sayılır.
     */
    @Transactional
    public void revoke(String value) {
        Optional<RefreshToken> token = refreshTokenRepository.findForRotationByTokenHash(RefreshTokenHashes.of(value));
        token.ifPresent(t -> t.revoke(OffsetDateTime.now(clock), RevocationReason.LOGOUT));
    }

    /** Yenileme sonucu: kimin için, hangi yeni düz token. */
    public record RotatedToken(UUID userId, String username, String value) {
    }
}
