package com.meteucar.mulakatslot.auth;

/**
 * Refresh token bulunamadı, süresi doldu ya da daha önce kullanılmış.
 * Çağıran için hepsi aynı sonucu doğurur: 401. Nedenin ayrıntısı yalnızca
 * sunucu günlüğüne yazılır, yanıtta paylaşılmaz.
 */
public class InvalidRefreshTokenException extends UnauthorizedException {

    public InvalidRefreshTokenException(String message) {
        super(message);
    }
}
