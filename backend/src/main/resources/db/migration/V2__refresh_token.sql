-- Refresh token: düz değer asla saklanmaz, yalnızca SHA-256 özeti tutulur.
-- Token 32 bayt SecureRandom olduğu için tahmin edilemez; bu yüzden yavaş
-- bir KDF (bcrypt/argon2) gerekmiyor, düz SHA-256 yeterli ve sabit
-- sürede aranabilir olmasını sağlıyor.
-- id üretimi Hibernate'te (@UuidGenerator) tek kaynak; DB DEFAULT yok.
CREATE TABLE refresh_token (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    -- null ise geçerli; iptal edilmiş bir token'ın satırı silinmez, çünkü
    -- yeniden kullanım tespiti iptal kaydının kalmasına bağlı.
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Yeniden kullanım tespitinde kullanıcının tüm token'ları tek sorguda
-- iptal ediliyor; token_hash'in UNIQUE index'i bu erişimi karşılamıyor.
CREATE INDEX idx_refresh_token_user ON refresh_token (user_id);
