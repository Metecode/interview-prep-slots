package com.meteucar.mulakatslot.auth;

import com.meteucar.mulakatslot.user.AppUserRepository;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final RefreshTokenService refreshTokenService;
    private final AccessTokenService accessTokenService;
    private final RefreshTokenCookie refreshTokenCookie;
    private final AppUserRepository appUserRepository;

    public AuthController(RefreshTokenService refreshTokenService, AccessTokenService accessTokenService,
            RefreshTokenCookie refreshTokenCookie, AppUserRepository appUserRepository) {
        this.refreshTokenService = refreshTokenService;
        this.accessTokenService = accessTokenService;
        this.refreshTokenCookie = refreshTokenCookie;
        this.appUserRepository = appUserRepository;
    }

    /**
     * Cookie'deki refresh token'ı yenisiyle değiştirir ve yeni bir access
     * token döner. Kullanılan token bir daha kabul edilmez.
     */
    @PostMapping("/refresh")
    public ResponseEntity<RefreshResponse> refresh(
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshValue) {
        if (refreshValue == null) {
            throw new InvalidRefreshTokenException("refresh cookie yok");
        }

        RefreshTokenService.RotatedToken rotated = refreshTokenService.rotate(refreshValue);
        RefreshResponse body = new RefreshResponse(
                accessTokenService.issue(rotated.userId()),
                new AuthUserResponse(rotated.userId(), rotated.username()));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.build(rotated.value()).toString())
                .body(body);
    }

    /**
     * Cookie'siz gelen çıkış isteği de başarılı sayılır: kullanıcı zaten
     * çıkmış durumda, hata döndürmenin bir karşılığı yok.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshValue) {
        if (refreshValue != null) {
            refreshTokenService.revoke(refreshValue);
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.clear().toString())
                .build();
    }

    /** Bearer access token ile çağrılır; sub alanı kullanıcının UUID'si. */
    @GetMapping("/me")
    public AuthUserResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return appUserRepository.findById(userId)
                .map(user -> new AuthUserResponse(user.getId(), user.getUsername()))
                // Token hâlâ geçerli ama kullanıcı silinmiş olabilir.
                .orElseThrow(() -> new UnauthorizedException("token geçerli ama kullanıcı yok: " + userId));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<AuthErrorResponse> handleUnauthorized(UnauthorizedException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(AuthErrorResponse.unauthorized());
    }
}
