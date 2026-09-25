package com.meteucar.mulakatslot.user;

import com.meteucar.mulakatslot.auth.RefreshTokenCookie;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Hesabın kendisi. Kimlik yalnızca Bearer access token'ın sub alanından
 * gelir; SecurityConfig'te varsayılan kapalı kural bu ucu zaten korur.
 */
@RestController
@RequestMapping("/api/me")
public class AccountController {

    private static final Logger log = LoggerFactory.getLogger(AccountController.class);

    private final AppUserService appUserService;
    private final RefreshTokenCookie refreshTokenCookie;

    public AccountController(AppUserService appUserService, RefreshTokenCookie refreshTokenCookie) {
        this.appUserService = appUserService;
        this.refreshTokenCookie = refreshTokenCookie;
    }

    /**
     * Hesabı, ilerlemeyi ve refresh token'ları siler. Kullanıcı zaten
     * silinmişse de 204 döner: istemci ağ hatasından sonra tekrar
     * denediğinde hata görmesin, sonuç zaten istenen durum.
     *
     * <p>Access token 15 dakika daha imza olarak geçerli kalır ama işe
     * yaramaz: kullanıcı satırına bağlı her uç 401 döner.
     */
    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        if (appUserService.delete(userId)) {
            log.info("Hesap silindi (user_id={})", userId);
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.clear().toString())
                .build();
    }
}
