package com.meteucar.mulakatslot.auth;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * Yalnızca rotasyonda kullanılır. PESSIMISTIC_WRITE satırı SELECT ... FOR
     * UPDATE ile kilitler; aynı token'la gelen eşzamanlı iki yenileme sıraya
     * girer, ikincisi birincinin sonucunu görür. Kilitsiz okuyan yollar
     * (çıkış, testler) {@link #findByTokenHash} kullanmaya devam eder —
     * onların seri çalışmasına gerek yok.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM RefreshToken t WHERE t.tokenHash = :tokenHash")
    Optional<RefreshToken> findForRotationByTokenHash(@Param("tokenHash") String tokenHash);

    List<RefreshToken> findByUserId(UUID userId);

    /**
     * Yeniden kullanım tespitinde çağrılır: tek sorguda kullanıcının geçerli
     * tüm token'larını iptal eder. Satır satır yüklemek yerine toplu update,
     * çünkü aradaki her milisaniye saldırganın elindeki token'ın yaşam süresi.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE RefreshToken t SET t.revokedAt = :now, t.revokedReason = :reason
            WHERE t.user.id = :userId AND t.revokedAt IS NULL
            """)
    int revokeAllForUser(@Param("userId") UUID userId, @Param("now") OffsetDateTime now,
            @Param("reason") RevocationReason reason);

    /** Temizlik işi için: süresi çoktan dolmuş satırlar. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") OffsetDateTime cutoff);
}
