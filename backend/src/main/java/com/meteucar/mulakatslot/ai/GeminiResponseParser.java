package com.meteucar.mulakatslot.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Gemini Interactions API yanıtını {@link AiEvaluation}'a çevirir. HTTP
 * bilmez; kayıtlı örnek yanıtlarla test edilir, CI gerçek API'yi çağırmaz.
 *
 * <p>Yanıt biçimi (Api-Revision 2026-05-20):
 * <pre>
 * { "status": "completed",
 *   "steps": [ { "type": "model_output",
 *                "content": [ { "type": "text", "text": "{...}" } ] } ] }
 * </pre>
 * Düşünme adımları ayrı step olarak gelebilir; yalnızca model_output
 * adımlarındaki text parçaları okunur.
 */
final class GeminiResponseParser {

    private static final String STATUS_COMPLETED = "completed";
    private static final String STEP_MODEL_OUTPUT = "model_output";
    private static final String CONTENT_TEXT = "text";

    private final JsonMapper jsonMapper;

    GeminiResponseParser(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    /**
     * @throws AiResponseException yanıt ya da içindeki JSON okunamazsa, üretim
     *                             tamamlanmadıysa ya da metin yoksa. Mesajda
     *                             ham çıktı yok (bkz. AiResponseException).
     */
    Parsed parse(String responseBody) {
        Interaction interaction = read(responseBody, Interaction.class, "yanıt gövdesi");
        Usage usage = interaction.usage() == null ? Usage.UNKNOWN : interaction.usage();

        if (!STATUS_COMPLETED.equals(interaction.status())) {
            // incomplete: çıktı token sınırında kesildi; JSON yarım kalmıştır.
            // Düşünme token'ları da bu sınıra sayılıyor, sayılar teşhis için.
            throw new AiResponseException("etkileşim tamamlanmadı: status=" + interaction.status()
                    + ", " + usage.describe());
        }

        String text = modelText(interaction);
        if (text.isBlank()) {
            throw new AiResponseException("yanıtta model metni yok");
        }
        ModelOutput output = read(text, ModelOutput.class, "model çıktısı");
        return new Parsed(
                new AiEvaluation(output.hits(), output.missing(), output.feedback(), output.followUp()),
                usage);
    }

    /** Değerlendirme ve token kullanımı; kullanım yalnızca loglanır. */
    record Parsed(AiEvaluation evaluation, Usage usage) {
    }

    private static String modelText(Interaction interaction) {
        if (interaction.steps() == null) {
            return "";
        }
        StringBuilder text = new StringBuilder();
        for (Step step : interaction.steps()) {
            if (!STEP_MODEL_OUTPUT.equals(step.type()) || step.content() == null) {
                continue;
            }
            for (Content content : step.content()) {
                if (CONTENT_TEXT.equals(content.type()) && content.text() != null) {
                    text.append(content.text());
                }
            }
        }
        return text.toString();
    }

    private <T> T read(String json, Class<T> type, String what) {
        try {
            T value = jsonMapper.readValue(json, type);
            if (value == null) {
                throw new AiResponseException(what + " boş");
            }
            return value;
        } catch (JacksonException e) {
            // Sebep zincire eklenmiyor: Jackson'ın mesajı ayrıştırdığı metinden
            // parça alıntılıyor, o metin de cevabı aktarıyor olabilir.
            throw new AiResponseException(what + " ayrıştırılamadı: " + e.getClass().getSimpleName());
        }
    }

    /* Yalnızca okunan alanlar; gerisi (id, usage, created...) yok sayılır. */

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Interaction(String status, List<Step> steps, Usage usage) {
    }

    /**
     * Token sayıları; gecikme teşhisi için loglanır. Düşünme token'ları
     * cevaptan önce üretiliyor, gecikmenin büyük kısmı çoğu zaman onlar.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Usage(
            @JsonProperty("total_input_tokens") Integer input,
            @JsonProperty("total_output_tokens") Integer output,
            @JsonProperty("total_thought_tokens") Integer thought) {

        static final Usage UNKNOWN = new Usage(null, null, null);

        String describe() {
            return "tokens(input=%s, output=%s, thought=%s)".formatted(input, output, thought);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Step(String type, List<Content> content) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Content(String type, String text) {
    }

    /** Şemada fazladan alan yasak ama model yine de eklerse yanıt düşmesin. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record ModelOutput(List<String> hits, List<String> missing, String feedback, String followUp) {
    }
}
