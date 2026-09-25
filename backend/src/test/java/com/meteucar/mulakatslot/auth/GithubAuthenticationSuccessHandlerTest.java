package com.meteucar.mulakatslot.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * GitHub el sıkışmasının kendisi test edilmiyor (ağ ve gerçek bir OAuth
 * uygulaması gerekir); handler sahte bir OAuth2User ile doğrudan çağrılıyor.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class GithubAuthenticationSuccessHandlerTest {

    private static final String REGISTRATION_ID = "github";

    @Autowired
    private GithubAuthenticationSuccessHandler successHandler;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private OAuth2AuthorizedClientRepository authorizedClientRepository;

    @Autowired
    private OAuth2AuthorizedClientService authorizedClientService;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        appUserRepository.deleteAll();
    }

    @Test
    void createsUserSetsCookieAndRedirectsToFrontend() throws Exception {
        MockHttpServletResponse response = handshake(authentication(4242, "metecode"), new MockHttpServletRequest());

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
        handshake(authentication(4242, "metecode"), new MockHttpServletRequest());
        handshake(authentication(4242, "mete-yeni-ad"), new MockHttpServletRequest());

        assertThat(appUserRepository.findAll()).hasSize(1);
        assertThat(appUserRepository.findByGithubId("4242").orElseThrow().getUsername())
                .isEqualTo("mete-yeni-ad");
    }

    /**
     * Handler token'ı servisten siliyor; bu ancak login filtresinin kullandığı
     * repository de servise yazıyorsa bir şey ifade eder. Uygulamanın
     * context'indeki gerçek repository ile kaydedip servisten okuyoruz.
     */
    @Test
    void appRepositoryStoresAuthenticatedClientsInTheService() {
        OAuth2AuthenticationToken authentication = authentication(4343, "baglanti");
        saveGithubToken(authentication, new MockHttpServletRequest());

        OAuth2AuthorizedClient stored =
                authorizedClientService.loadAuthorizedClient(REGISTRATION_ID, authentication.getName());
        assertThat(stored).isNotNull();
        assertThat(stored.getAccessToken().getTokenValue()).isEqualTo("gho_sahte_token");

        authorizedClientService.removeAuthorizedClient(REGISTRATION_ID, authentication.getName());
    }

    @Test
    void removesGithubTokenAndInvalidatesSessionAfterLogin() throws Exception {
        OAuth2AuthenticationToken authentication = authentication(4444, "temizlik");
        MockHttpSession session = new MockHttpSession();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(session);

        // Login filtresinin handler'dan önce yaptığı kayıt.
        saveGithubToken(authentication, request);
        assertThat(authorizedClientService.<OAuth2AuthorizedClient>loadAuthorizedClient(
                REGISTRATION_ID, authentication.getName())).isNotNull();

        handshake(authentication, request);

        assertThat(authorizedClientService.<OAuth2AuthorizedClient>loadAuthorizedClient(
                REGISTRATION_ID, authentication.getName())).isNull();
        assertThat(session.isInvalid()).isTrue();
    }

    private void saveGithubToken(OAuth2AuthenticationToken authentication, MockHttpServletRequest request) {
        OAuth2AccessToken accessToken = new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER,
                "gho_sahte_token", Instant.now(), Instant.now().plusSeconds(3600));
        OAuth2AuthorizedClient client = new OAuth2AuthorizedClient(
                clientRegistrationRepository.findByRegistrationId(REGISTRATION_ID),
                authentication.getName(), accessToken);
        authorizedClientRepository.saveAuthorizedClient(client, authentication, request,
                new MockHttpServletResponse());
    }

    private static OAuth2AuthenticationToken authentication(int githubId, String login) {
        // GitHub id'yi sayı olarak gönderir; handler'ın metne çevirdiğini de doğruluyoruz.
        OAuth2User principal = new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("ROLE_USER")),
                Map.of("id", githubId, "login", login),
                "id");
        return new OAuth2AuthenticationToken(principal, principal.getAuthorities(), REGISTRATION_ID);
    }

    private MockHttpServletResponse handshake(OAuth2AuthenticationToken authentication,
            MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        successHandler.onAuthenticationSuccess(request, response, authentication);
        return response;
    }
}
