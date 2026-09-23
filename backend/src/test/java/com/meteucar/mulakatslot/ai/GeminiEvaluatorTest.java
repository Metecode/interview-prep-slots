package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.meteucar.mulakatslot.question.Question;
import java.io.IOException;
import java.io.InputStream;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/**
 * HTTP katmanı MockRestServiceServer ile; ağa hiç çıkılmaz. Gerçek API
 * çağrısı CI'da ASLA yapılmaz.
 */
@ExtendWith(OutputCaptureExtension.class)
class GeminiEvaluatorTest {

    private static final String URL = GeminiEvaluator.BASE_URL + GeminiEvaluator.INTERACTIONS_PATH;

    private MockRestServiceServer server;
    private GeminiEvaluator evaluator;
    private final Question question = AiTestQuestions.threeConcepts();

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(GeminiEvaluator.BASE_URL)
                .defaultHeader(GeminiEvaluator.API_KEY_HEADER, "test-key")
                .defaultHeader(GeminiEvaluator.API_REVISION_HEADER, GeminiEvaluator.API_REVISION);
        server = MockRestServiceServer.bindTo(builder).build();
        evaluator = new GeminiEvaluator(builder.build(), "gemini-3.5-flash", JsonMapper.builder().build());
    }

    @Test
    void sendsStructuredOutputRequestAndParsesTheAnswer() throws IOException {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(GeminiEvaluator.API_KEY_HEADER, "test-key"))
                .andExpect(header(GeminiEvaluator.API_REVISION_HEADER, GeminiEvaluator.API_REVISION))
                .andExpect(jsonPath("$.model").value("gemini-3.5-flash"))
                .andExpect(jsonPath("$.store").value(false))
                .andExpect(jsonPath("$.generation_config.temperature").value(EvaluationPrompt.TEMPERATURE))
                // gemini-3.5-flash "minimal"i destekliyor; max_output_tokens yok.
                .andExpect(jsonPath("$.generation_config.thinking_level").value("minimal"))
                .andExpect(jsonPath("$.generation_config.max_output_tokens").doesNotExist())
                .andExpect(jsonPath("$.response_format.type").value("text"))
                .andExpect(jsonPath("$.response_format.mime_type").value("application/json"))
                .andExpect(jsonPath("$.response_format.schema.properties.hits.items.enum",
                        Matchers.contains("concept-a", "concept-b", "concept-c")))
                .andExpect(jsonPath("$.input", Matchers.containsString("cevabım burada")))
                .andRespond(withSuccess(resource("ai/gemini-interaction-completed.json"), MediaType.APPLICATION_JSON));

        AiEvaluation evaluation = evaluator.evaluate(question, "cevabım burada");

        assertThat(evaluation.hits()).containsExactly("concept-a", "concept-c");
        server.verify();
    }

    /** Her çağrı süresiyle loglanır; cevap ve prompt metni loga girmez. */
    @Test
    void everyCallIsLoggedWithDurationButWithoutAnswerOrPrompt(CapturedOutput output) throws IOException {
        server.expect(requestTo(URL))
                .andRespond(withSuccess(resource("ai/gemini-interaction-completed.json"), MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL)).andRespond(withException(new SocketTimeoutException("Read timed out")));

        evaluator.evaluate(question, "loga girmemesi gereken cevap");
        assertThatThrownBy(() -> evaluator.evaluate(question, "loga girmemesi gereken cevap"));

        assertThat(output.getAll())
                .containsPattern("Gemini çağrısı: model=gemini-3.5-flash, süre=\\d+ ms, sonuç=ok, "
                        + "tokens\\(input=612, output=71, thought=38\\)")
                .containsPattern("süre=\\d+ ms, sonuç=ağ hatası, java.net.SocketTimeoutException: Read timed out")
                .doesNotContain("loga girmemesi gereken cevap")
                .doesNotContain("Önbellek geçersizleştirme neden zordur?")
                .doesNotContain("Deneyimli bir teknik mülakatçısın");
    }

    /** İstek gövdesinde yalnızca bu alanlar var: kullanıcıya ait kimlik yok. */
    @Test
    void requestBodyCarriesNoUserFields() {
        var body = evaluator.requestBody(Rubric.of(question), "cevap");

        assertThat(body.keySet()).containsExactlyInAnyOrder(
                "model", "system_instruction", "input", "response_format", "generation_config", "store");
    }

    @Test
    void providerRateLimitIsUnavailable() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThatThrownBy(() -> evaluator.evaluate(question, "cevap")).isInstanceOf(AiUnavailableException.class);
    }

    @Test
    void providerServerErrorIsUnavailable() {
        server.expect(requestTo(URL)).andRespond(withServerError());

        assertThatThrownBy(() -> evaluator.evaluate(question, "cevap")).isInstanceOf(AiUnavailableException.class);
    }

    /** Kök sebep mesaja girer: "ResourceAccessException" tek başına teşhis için yetmiyordu. */
    @Test
    void timeoutIsUnavailableAndCarriesTheRootCause() {
        server.expect(requestTo(URL)).andRespond(withException(new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> evaluator.evaluate(question, "cevap"))
                .isInstanceOf(AiUnavailableException.class)
                .hasMessageContaining("java.net.SocketTimeoutException: Read timed out");
    }

    /** Zaman aşımları ayrı: bağlantı kısa, okuma modelin düşünme süresine göre. */
    @Test
    void connectAndReadTimeoutsAreSeparate() {
        assertThat(GeminiEvaluator.CONNECT_TIMEOUT).hasSeconds(5);
        assertThat(GeminiEvaluator.READ_TIMEOUT).hasSeconds(30);
    }

    @Test
    void unreadableBodyIsAResponseError() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{ bu json değil", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> evaluator.evaluate(question, "cevap")).isInstanceOf(AiResponseException.class);
    }

    private static String resource(String path) throws IOException {
        try (InputStream in = GeminiEvaluatorTest.class.getClassLoader().getResourceAsStream(path)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
