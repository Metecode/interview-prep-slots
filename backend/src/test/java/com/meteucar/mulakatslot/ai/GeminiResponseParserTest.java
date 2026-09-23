package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ayrıştırma, dosyada duran örnek yanıtla sınanır; CI gerçek API'yi ASLA
 * çağırmaz. Örnek, Interactions API dokümantasyonundaki yanıt biçimiyle
 * (Api-Revision 2026-05-20) kuruldu: düşünme adımı + model_output adımı.
 */
class GeminiResponseParserTest {

    private final GeminiResponseParser parser = new GeminiResponseParser(JsonMapper.builder().build());

    @Test
    void readsTheModelOutputStepAndIgnoresThoughts() throws IOException {
        GeminiResponseParser.Parsed parsed = parser.parse(resource("ai/gemini-interaction-completed.json"));
        AiEvaluation evaluation = parsed.evaluation();

        assertThat(evaluation.hits()).containsExactly("concept-a", "concept-c");
        assertThat(evaluation.missing()).containsExactly("concept-b");
        assertThat(evaluation.feedback()).startsWith("Kavram A ve C doğru anlatılmış");
        assertThat(evaluation.followUp()).isEqualTo("Kavram B olmasaydı hangi sorun ortaya çıkardı?");
        // Token sayıları gecikme teşhisi için loglanıyor.
        assertThat(parsed.usage().describe()).isEqualTo("tokens(input=612, output=71, thought=38)");
    }

    /** Metin birden fazla parçaya bölünmüş gelebilir; birleştirilip okunur. */
    @Test
    void joinsTextSplitAcrossParts() {
        String body = """
                { "status": "completed", "steps": [ { "type": "model_output", "content": [
                  { "type": "text", "text": "{\\"hits\\":[\\"a\\"],\\"missing\\":[]," },
                  { "type": "text", "text": "\\"feedback\\":\\"f\\",\\"followUp\\":\\"q\\"}" }
                ] } ] }
                """;

        AiEvaluation evaluation = parser.parse(body).evaluation();

        assertThat(evaluation.hits()).containsExactly("a");
        assertThat(evaluation.feedback()).isEqualTo("f");
    }

    @Test
    void extraFieldsInTheModelOutputAreIgnored() {
        String body = modelOutput("{\\\"hits\\\":[],\\\"missing\\\":[],\\\"feedback\\\":\\\"f\\\","
                + "\\\"followUp\\\":\\\"q\\\",\\\"score\\\":7}");

        assertThat(parser.parse(body).evaluation().feedback()).isEqualTo("f");
    }

    @Test
    void malformedModelJsonIsAResponseError() {
        String body = modelOutput("{\\\"hits\\\": [\\\"a\\\"");

        assertThatThrownBy(() -> parser.parse(body))
                .isInstanceOf(AiResponseException.class)
                .hasMessageContaining("model çıktısı");
    }

    @Test
    void malformedEnvelopeIsAResponseError() {
        assertThatThrownBy(() -> parser.parse("<html>502 Bad Gateway</html>"))
                .isInstanceOf(AiResponseException.class);
    }

    /** Token sınırında kesilen çıktı yarım JSON'dur; hiç denenmez. */
    @Test
    void incompleteInteractionIsAResponseError() {
        String body = """
                { "status": "incomplete", "steps": [ { "type": "model_output",
                  "content": [ { "type": "text", "text": "{\\"hits\\": [" } ] } ] }
                """;

        assertThatThrownBy(() -> parser.parse(body))
                .isInstanceOf(AiResponseException.class)
                .hasMessageContaining("incomplete")
                .hasMessageContaining("thought=");
    }

    @Test
    void missingModelOutputIsAResponseError() {
        assertThatThrownBy(() -> parser.parse("{ \"status\": \"completed\", \"steps\": [] }"))
                .isInstanceOf(AiResponseException.class);
    }

    /** Hata mesajı ayrıştırılan metinden parça taşımamalı: o metin cevabı aktarıyor olabilir. */
    @Test
    void errorMessageDoesNotQuoteTheModelOutput() {
        String body = modelOutput("gizli cevap metni {");

        assertThatThrownBy(() -> parser.parse(body))
                .isInstanceOf(AiResponseException.class)
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("gizli"))
                .hasNoCause();
    }

    private static String modelOutput(String escapedText) {
        return """
                { "status": "completed", "steps": [ { "type": "model_output",
                  "content": [ { "type": "text", "text": "%s" } ] } ] }
                """.formatted(escapedText);
    }

    private static String resource(String path) throws IOException {
        try (InputStream in = GeminiResponseParserTest.class.getClassLoader().getResourceAsStream(path)) {
            assertThat(in).as("test kaynağı: " + path).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
