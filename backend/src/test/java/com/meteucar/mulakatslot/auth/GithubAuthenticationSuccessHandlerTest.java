package com.meteucar.mulakatslot.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * GitHub el sıkışmasının kendisi test edilmiyor (ağ ve gerçek bir OAuth
 * uygulaması gerekir); handler sahte bir OAuth2User ile doğrudan çağrılıyor.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class GithubAuthenticationSuccessHandlerTest {

    @Autowired
    private GithubAuthenticationSuccessHandler successHandler;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        appUserRepository.deleteAll();
    }

    @Test
    void createsUserSetsCookieAndRedirectsToFrontend() throws Exception {
        MockHttpServletResponse response = handshake(4242, "metecode");

        AppUser user = appUserRepository.findByGithubId("4242").orElseThrow();
        assertThat(user.getUsername()).isEqualTo("metecode");

        Cookie cookie = response.getCookie(RefreshTokenCookie.NAME);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/api/auth");
        assertThat(cookie.getValue()).isNotEmpty();

        assertThat(refreshTokenRepository.findByUserId(user.getId())).hasSize(1);

        // Token URL'e konmaz: yönlendirme yalnızca frontend kökü.
        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:5173");
    }

    @Test
    void secondLoginReusesTheSameUserAndRefreshesTheUsername() throws Exception {
        handshake(4242, "metecode");
        handshake(4242, "mete-yeni-ad");

        assertThat(appUserRepository.findAll()).hasSize(1);
        assertThat(appUserRepository.findByGithubId("4242").orElseThrow().getUsername())
                .isEqualTo("mete-yeni-ad");
    }

    private MockHttpServletResponse handshake(int githubId, String login) throws Exception {
        // GitHub id'yi sayı olarak gönderir; handler'ın metne çevirdiğini de doğruluyoruz.
        OAuth2User principal = new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("ROLE_USER")),
                Map.of("id", githubId, "login", login),
                "id");
        Authentication authentication =
                new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "github");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        successHandler.onAuthenticationSuccess(request, response, authentication);
        return response;
    }
}
