-- İptal sebebi, eşzamanlı yenilemeyi gerçek yeniden kullanımdan ayırmak
-- için gerekli: rotasyonla iptal edilmiş bir token'ın kısa süre içinde
-- tekrar gelmesi normal (bkz. RefreshTokenService.REUSE_GRACE), çıkışla
-- iptal edilmiş bir token'ın gelmesi değil.
ALTER TABLE refresh_token ADD COLUMN revoked_reason TEXT;

-- NULL, iptal edilmemiş token demek. CHECK ifadesi NULL için NULL üretir
-- ve NULL sonuç kısıtı ihlal etmez; ayrıca IS NULL izni yazmaya gerek yok.
ALTER TABLE refresh_token ADD CONSTRAINT chk_refresh_token_revoked_reason
    CHECK (revoked_reason IN ('rotated', 'logout', 'reuse_detected'));
