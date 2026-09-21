package com.meteucar.mulakatslot.auth;

import com.meteucar.mulakatslot.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.UuidGenerator;

/**
 * Tarayıcıdaki refresh token'ın sunucu tarafındaki karşılığı. Düz değer
 * hiçbir zaman saklanmaz; yalnızca SHA-256 özeti tutulur, arama da onunla
 * yapılır.
 */
@Entity
@Table(name = "refresh_token")
public class RefreshToken {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private AppUser user;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Convert(converter = RevocationReason.DbConverter.class)
    @Column(name = "revoked_reason")
    private RevocationReason revokedReason;

    // DB tarafında DEFAULT now() var, Java katmanı hiç yazmıyor.
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected RefreshToken() {
        // JPA için
    }

    public RefreshToken(AppUser user, String tokenHash, OffsetDateTime expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public UUID getId() {
        return id;
    }

    public AppUser getUser() {
        return user;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getRevokedAt() {
        return revokedAt;
    }

    public RevocationReason getRevokedReason() {
        return revokedReason;
    }

    public void revoke(OffsetDateTime at, RevocationReason reason) {
        // Zaten iptal edilmiş bir token'ın ilk iptal zamanı ve sebebi korunur:
        // yeniden kullanım tespiti ikisine de bakıyor.
        if (this.revokedAt == null) {
            this.revokedAt = at;
            this.revokedReason = reason;
        }
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpired(OffsetDateTime now) {
        return expiresAt.isBefore(now);
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
