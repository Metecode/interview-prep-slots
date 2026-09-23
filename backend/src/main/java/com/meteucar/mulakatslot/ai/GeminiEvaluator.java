package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.question.Question;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Gemini Interactions API ile değerlendirme.
 *
 * <p>Biçim resmi dokümantasyondan (ai.google.dev, Eylül 2026): Google yeni
 * projelere generateContent yerine Interactions API'yi öneriyor.
 * Yapılandırılmış çıktı {@code response_format} ile istenir
 * ({@code type: text, mime_type: application/json, schema}); yanıt
 * şeması {@code Api-Revision} başlığıyla sabitlenir, Google biçimi
 * değiştirdiğinde bizim ayrıştırıcımız sessizce bozulmasın.
 *
 * <p>Sağlayıcıya giden tek şey soru, rubrik ve cevap metni. Kullanıcı
 * kimliği, kullanıcı adı ya da token gönderilmez. {@code store: false}:
 * etkileşimin sonradan geri çağrılmak üzere Google'da saklanmasına gerek
 * yok, her değerlendirme tek seferlik.
 */
public class GeminiEvaluator implements AiEvaluator {

    private static final Logger log = LoggerFactory.getLogger(GeminiEvaluator.class);

    static final String BASE_URL = "https://generativelanguage.googleapis.com";
    static final String INTERACTIONS_PATH = "/v1beta/interactions";
    static final String API_KEY_HEADER = "x-goog-api-key";
    static final String API_REVISION_HEADER = "Api-Revision";
    static final String API_REVISION = "2026-05-20";

    /** TCP/TLS bağlantısı; Google'a bağlanamıyorsak beklemenin anlamı yok. */
    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /**
     * İstek gönderildikten sonra yanıtı bekleme süresi. Model cevaptan önce
     * düşünüyor; v2 prompt'uyla (few-shot, uzun geri bildirim) 20 saniye
     * yetmedi, çağrılar HttpTimeoutException ile düştü. Bundan uzunu
     * "yoğun" sayılır ve kullanıcıya 503 döner.
     */
    static final Duration READ_TIMEOUT = Duration.ofSeconds(30);

    private final RestClient restClient;
    private final String model;
    private final JsonMapper jsonMapper;
    private final GeminiResponseParser parser;

    /** Testler MockRestServiceServer'a bağlı bir istemci verir. */
    GeminiEvaluator(RestClient restClient, String model, JsonMapper jsonMapper) {
        this.restClient = restClient;
        this.model = model;
        this.jsonMapper = jsonMapper;
        this.parser = new GeminiResponseParser(jsonMapper);
    }

    public static GeminiEvaluator create(AiProperties.Gemini settings, JsonMapper jsonMapper) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);

        RestClient restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .requestFactory(requestFactory)
                .defaultHeader(API_KEY_HEADER, settings.apiKey().strip())
                .defaultHeader(API_REVISION_HEADER, API_REVISION)
                .build();
        return new GeminiEvaluator(restClient, settings.model(), jsonMapper);
    }

    @Override
    public AiEvaluation evaluate(Question question, String answer) {
        Rubric rubric = Rubric.of(question);
        String requestBody = jsonMapper.writeValueAsString(requestBody(rubric, answer));

        long started = System.nanoTime();
        try {
            String responseBody = restClient.post()
                    .uri(INTERACTIONS_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);
            if (responseBody == null) {
                throw new AiResponseException("Gemini boş gövde döndü");
            }
            GeminiResponseParser.Parsed parsed = parser.parse(responseBody);
            logCall(started, "ok", parsed.usage().describe());
            return parsed.evaluation();
        } catch (RestClientResponseException e) {
            // Sebep zincire eklenmiyor: istisnanın mesajı yanıt gövdesini
            // taşıyor, gövde de isteği (cevabı) yansıtabilir.
            logCall(started, "HTTP " + e.getStatusCode().value(), null);
            throw unavailable(e.getStatusCode());
        } catch (ResourceAccessException e) {
            // Zaman aşımı ve ağ hataları. Asıl bilgi kök sebepte:
            // HttpTimeoutException (okuma), HttpConnectTimeoutException
            // (bağlantı), ConnectException... Bu mesajlar ağ katmanından
            // gelir, istek gövdesini içermez.
            String rootCause = rootCauseOf(e);
            logCall(started, "ağ hatası", rootCause);
            throw new AiUnavailableException("Gemini'ye ulaşılamadı: " + rootCause, e);
        } catch (AiResponseException e) {
            logCall(started, "okunamayan yanıt", e.getMessage());
            throw e;
        }
    }

    /**
     * Her çağrı için tek satır: süre ve sonuç. Prompt ve cevap metni
     * burada da yok; yalnızca model, süre, sonuç türü ve token sayıları.
     */
    private void logCall(long startedNanos, String outcome, String detail) {
        long elapsedMs = (System.nanoTime() - startedNanos) / 1_000_000;
        if (detail == null) {
            log.info("Gemini çağrısı: model={}, süre={} ms, sonuç={}", model, elapsedMs, outcome);
        } else {
            log.info("Gemini çağrısı: model={}, süre={} ms, sonuç={}, {}", model, elapsedMs, outcome, detail);
        }
    }

    private static String rootCauseOf(Exception e) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(e);
        return root.getClass().getName() + ": " + root.getMessage();
    }

    Map<String, Object> requestBody(Rubric rubric, String answer) {
        Map<String, Object> responseFormat = new LinkedHashMap<>();
        responseFormat.put("type", "text");
        responseFormat.put("mime_type", "application/json");
        responseFormat.put("schema", EvaluationPrompt.responseSchema(rubric));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("system_instruction", EvaluationPrompt.systemInstruction());
        body.put("input", EvaluationPrompt.userInput(rubric, answer));
        body.put("response_format", responseFormat);
        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", EvaluationPrompt.TEMPERATURE);
        // Rubriğe göre işaretleme derin düşünme istemiyor; modelin
        // desteklediği en düşük seviye. max_output_tokens bilerek yok:
        // düşünme token'ları da ona sayılıyor (bkz. GeminiThinking).
        generationConfig.put("thinking_level", GeminiThinking.lowestLevel(model));
        body.put("generation_config", generationConfig);
        body.put("store", false);
        return body;
    }

    /**
     * 429 ve 5xx geçicidir, beklenen durum. Diğer 4xx (geçersiz anahtar,
     * şemayı reddetme) bizim yapılandırma hatamız: kullanıcı yine 503 görür
     * ama log error'da kalır ki fark edilsin. Gövde loglanmaz; hata mesajı
     * isteği, dolayısıyla cevabı aktarıyor olabilir.
     */
    private static AiUnavailableException unavailable(HttpStatusCode status) {
        boolean transientFailure = status.value() == HttpStatus.TOO_MANY_REQUESTS.value() || status.is5xxServerError();
        if (!transientFailure) {
            log.error("Gemini isteği reddetti: HTTP {} — anahtar, model ya da şema yapılandırmasını kontrol et",
                    status.value());
        }
        return new AiUnavailableException("Gemini HTTP " + status.value());
    }
}
