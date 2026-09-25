package com.meteucar.mulakatslot.auth;

import com.meteucar.mulakatslot.config.AuthProperties;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/**
 * GitHub el sıkışması bittiğinde çalışır: kullanıcıyı kaydeder, refresh
 * token'ı cookie'ye yazar ve frontend'e döner.
 *
 * <p>Token URL'e konmaz: URL tarayıcı geçmişine, Referer başlığına ve sunucu
 * günlüklerine yazılır.
 *
 * <p>GitHub'ın verdiği access token'a el sıkışmadan sonra ihtiyacımız yok:
 * kimlik ve kullanıcı adı principal'da geliyor, GitHub API'si bir daha
 * çağrılmıyor. Spring onu varsayılan olarak bellekte saklıyor; burada
 * siliniyor ki sunucuda kullanılmayan bir kimlik bilgisi birikmesin.
 */
@Component
public class GithubAuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final AppUserService appUserService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshTokenCookie refreshTokenCookie;
    private final OAuth2AuthorizedClientService authorizedClientService;
    private final String appBaseUrl;
    private final RedirectStrategy redirectStrategy = new DefaultRedirectStrategy();

    public GithubAuthenticationSuccessHandler(AppUserService appUserService,
            RefreshTokenService refreshTokenService, RefreshTokenCookie refreshTokenCookie,
            OAuth2AuthorizedClientService authorizedClientService, AuthProperties properties) {
        this.appUserService = appUserService;
        this.refreshTokenService = refreshTokenService;
        this.refreshTokenCookie = refreshTokenCookie;
        this.authorizedClientService = authorizedClientService;
        this.appBaseUrl = properties.appBaseUrl();
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException {
        try {
            OAuth2User principal = (OAuth2User) authentication.getPrincipal();
            AppUser user = appUserService.upsertFromGithub(githubId(principal), username(principal));

            String refreshValue = refreshTokenService.issue(user);
            response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.build(refreshValue).toString());

            // Session yalnızca authorization request durumunu taşıyordu; el sıkışma
            // bitti, oturum artık refresh token'la yürüyor. Bundan sonrası stateless.
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }

            redirectStrategy.sendRedirect(request, response, appBaseUrl);
        } finally {
            // Kayıt ya da cookie adımı hata verse de GitHub token'ı bellekte kalmaz.
            removeGithubToken(authentication);
        }
    }

    /**
     * Login filtresi token'ı bu handler çağrılmadan önce kaydediyor.
     * Kimliği doğrulanmış principal için varsayılan repository
     * ({@code AuthenticatedPrincipalOAuth2AuthorizedClientRepository})
     * servise yazdığından silme de servisten yapılır.
     */
    private void removeGithubToken(Authentication authentication) {
        if (authentication instanceof OAuth2AuthenticationToken token) {
            authorizedClientService.removeAuthorizedClient(
                    token.getAuthorizedClientRegistrationId(), authentication.getName());
        }
    }

    /** GitHub bunu sayı olarak gönderir, biz metin olarak saklıyoruz. */
    private String githubId(OAuth2User principal) {
        Object id = principal.getAttributes().get("id");
        if (id == null) {
            throw new IllegalStateException("GitHub yanıtında 'id' alanı yok");
        }
        return String.valueOf(id);
    }

    private String username(OAuth2User principal) {
        Object login = principal.getAttributes().get("login");
        if (login == null) {
            throw new IllegalStateException("GitHub yanıtında 'login' alanı yok");
        }
        return String.valueOf(login);
    }
}
