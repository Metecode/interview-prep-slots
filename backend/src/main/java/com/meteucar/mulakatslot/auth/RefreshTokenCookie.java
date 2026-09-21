package com.meteucar.mulakatslot.auth;

import com.meteucar.mulakatslot.config.AuthProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Refresh token'ı taşıyan cookie'yi üretir.
 *
 * <p>HttpOnly: JavaScript okuyamaz, XSS ile çalınamaz. SameSite=Strict: başka
 * bir sitenin tetiklediği isteklerde gönderilmez. Path=/api/auth: yalnızca
 * yenileme ve çıkış uçlarına gider, diğer isteklerde ağda dolaşmaz.
 */
@Component
public class RefreshTokenCookie {

    public static final String NAME = "refresh_token";

    private static final String PATH = "/api/auth";

    private final boolean secure;

    public RefreshTokenCookie(AuthProperties properties) {
        this.secure = properties.cookieSecure();
    }

    public ResponseCookie build(String value) {
        return baseBuilder(value).maxAge(RefreshTokenService.TOKEN_TTL).build();
    }

    /** Aynı ad/path ile boş ve Max-Age=0 cookie; tarayıcı kaydı siler. */
    public ResponseCookie clear() {
        return baseBuilder("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder baseBuilder(String value) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path(PATH);
    }
}
