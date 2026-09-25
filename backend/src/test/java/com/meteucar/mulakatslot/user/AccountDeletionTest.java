package com.meteucar.mulakatslot.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.auth.AccessTokenService;
import com.meteucar.mulakatslot.auth.RefreshTokenCookie;
import com.meteucar.mulakatslot.auth.RefreshTokenRepository;
import com.meteucar.mulakatslot.auth.RefreshTokenService;
import com.meteucar.mulakatslot.progress.ProgressRecord;
import com.meteucar.mulakatslot.progress.QuestionProgress;
import com.meteucar.mulakatslot.progress.QuestionProgressRepository;
import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.question.QuestionRepository;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

/**
 * Hesap silme uçtan uca: cascade gerçekten veritabanında çalışıyor mu,
 * silinmiş kullanıcının hâlâ imzası geçerli access token'ı ve refresh
 * cookie'si bir şey yapabiliyor mu.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AccountDeletionTest {

    private static final String QUESTION = "account-deletion-test";
    private static final String T1 = "2026-01-01T10:00:00Z";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionProgressRepository questionProgressRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private AccessTokenService accessTokenService;

    private AppUser user;
    private AppUser otherUser;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        questionProgressRepository.deleteAll();
        appUserRepository.deleteAll();
        user = appUserRepository.save(new AppUser("gh-delete", "silinecek"));
        otherUser = appUserRepository.save(new AppUser("gh-delete-other", "kalacak"));

        if (!questionRepository.existsById(QUESTION)) {
            questionRepository.save(new Question(QUESTION, "misc", "Silme", (short) 1, "definition",
                    Map.of("prompt", "Silme testi sorusu", "keyConcepts", List.of())));
        }
    }

    @Test
    void deletesTheUserWithProgressAndTokensButLeavesOthersAlone() throws Exception {
        saveProgress(user);
        saveProgress(otherUser);
        refreshTokenService.issue(user);
        refreshTokenService.issue(otherUser);

        String setCookie = mockMvc.perform(authed(delete("/api/me"), bearer(user)))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);

        assertThat(setCookie)
                .startsWith(RefreshTokenCookie.NAME + "=;")
                .contains("Max-Age=0")
                .contains("Path=/api/auth");

        assertThat(appUserRepository.existsById(user.getId())).isFalse();
        assertThat(questionProgressRepository.findByIdUserId(user.getId())).isEmpty();
        assertThat(refreshTokenRepository.findByUserId(user.getId())).isEmpty();

        assertThat(appUserRepository.existsById(otherUser.getId())).isTrue();
        assertThat(questionProgressRepository.findByIdUserId(otherUser.getId())).hasSize(1);
        assertThat(refreshTokenRepository.findByUserId(otherUser.getId())).hasSize(1);
    }

    /**
     * Access token 15 dakika daha imza olarak geçerli. Senkron uçları
     * kullanıcı satırına dayandığı için 401 veriyor ve kullanıcıyı yeniden
     * oluşturmuyor.
     */
    @Test
    void theOldAccessTokenCanNoLongerSync() throws Exception {
        String token = bearer(user);
        mockMvc.perform(authed(delete("/api/me"), token)).andExpect(status().isNoContent());

        String body = jsonMapper.writeValueAsString(List.of(new ProgressRecord(QUESTION, 3, T1, List.of())));

        mockMvc.perform(authed(put("/api/progress"), token).content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
        mockMvc.perform(authed(post("/api/progress/merge"), token).content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
        mockMvc.perform(authed(get("/api/progress"), token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));

        assertThat(appUserRepository.existsById(user.getId())).isFalse();
        assertThat(questionProgressRepository.findByIdUserId(user.getId())).isEmpty();
        assertThat(appUserRepository.findAll()).extracting(AppUser::getId).containsExactly(otherUser.getId());
    }

    @Test
    void theOldRefreshCookieCanNoLongerRefresh() throws Exception {
        String refreshValue = refreshTokenService.issue(user);
        mockMvc.perform(authed(delete("/api/me"), bearer(user))).andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie(RefreshTokenCookie.NAME, refreshValue)))
                .andExpect(status().isUnauthorized());
    }

    /** İstemci ağ hatasından sonra tekrar denerse hata görmesin. */
    @Test
    void deletingTwiceIsStillNoContent() throws Exception {
        String token = bearer(user);

        mockMvc.perform(authed(delete("/api/me"), token)).andExpect(status().isNoContent());
        mockMvc.perform(authed(delete("/api/me"), token))
                .andExpect(status().isNoContent())
                .andExpect(result -> assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                        .contains("Max-Age=0"));

        assertThat(appUserRepository.existsById(otherUser.getId())).isTrue();
    }

    @Test
    void deletingWithoutATokenIsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/me")).andExpect(status().isUnauthorized());

        assertThat(appUserRepository.existsById(user.getId())).isTrue();
    }

    private String bearer(AppUser as) {
        return accessTokenService.issue(as.getId());
    }

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder builder, String token) {
        return builder
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON);
    }

    private void saveProgress(AppUser owner) {
        Question question = questionRepository.findById(QUESTION).orElseThrow();
        questionProgressRepository.save(
                new QuestionProgress(owner, question, (short) 2, OffsetDateTime.parse(T1)));
    }
}
