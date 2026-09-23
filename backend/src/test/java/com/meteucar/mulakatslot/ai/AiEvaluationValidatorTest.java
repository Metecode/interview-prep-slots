package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class AiEvaluationValidatorTest {

    private static final List<String> CONCEPTS = List.of("a", "b", "c");

    @Test
    void unknownIdsAreDropped() {
        AiEvaluation result = validate(List.of("a", "uydurma"), List.of("b", "c", "baska"));

        assertThat(result.hits()).containsExactly("a");
        assertThat(result.missing()).containsExactly("b", "c");
    }

    @Test
    void conceptsInNeitherListGoToMissing() {
        AiEvaluation result = validate(List.of("b"), List.of());

        assertThat(result.hits()).containsExactly("b");
        assertThat(result.missing()).containsExactly("a", "c");
    }

    /** Model kararsızsa kullanıcıya bilmediği bir şeyi "biliyorsun" demiyoruz. */
    @Test
    void conceptInBothListsCountsAsMissing() {
        AiEvaluation result = validate(List.of("a", "b"), List.of("b"));

        assertThat(result.hits()).containsExactly("a");
        assertThat(result.missing()).containsExactly("b", "c");
    }

    @Test
    void hitsAndMissingTogetherCoverEveryConceptExactlyOnce() {
        AiEvaluation result = validate(List.of("c", "c", "a"), List.of("a"));

        assertThat(result.hits()).containsExactly("c");
        assertThat(result.missing()).containsExactly("a", "b");
    }

    @Test
    void nullListsAreTreatedAsEmpty() {
        AiEvaluation result = AiEvaluationValidator.validate(new AiEvaluation(null, null, null, null), CONCEPTS);

        assertThat(result.hits()).isEmpty();
        assertThat(result.missing()).containsExactlyElementsOf(CONCEPTS);
        assertThat(result.feedback()).isEmpty();
        assertThat(result.followUp()).isEmpty();
    }

    @Test
    void feedbackIsCutAtTheLimit() {
        String longFeedback = "ç".repeat(EvaluationPrompt.FEEDBACK_MAX_CHARS + 150);

        AiEvaluation result = AiEvaluationValidator.validate(
                new AiEvaluation(List.of(), List.of(), longFeedback, "Soru?"), CONCEPTS);

        assertThat(result.feedback()).hasSize(EvaluationPrompt.FEEDBACK_MAX_CHARS);
    }

    /** Vekil çift ortadan bölünmesin: 300 kod noktası, 300 UTF-16 birimi değil. */
    @Test
    void truncationCountsCodePointsNotUtf16Units() {
        String emojis = "🙂".repeat(301);

        String cut = AiEvaluationValidator.truncate(emojis, 300);

        assertThat(cut.codePointCount(0, cut.length())).isEqualTo(300);
        assertThat(cut).isEqualTo("🙂".repeat(300));
    }

    @Test
    void shortTextIsOnlyTrimmed() {
        assertThat(AiEvaluationValidator.truncate("  kısa  ", 300)).isEqualTo("kısa");
    }

    private static AiEvaluation validate(List<String> hits, List<String> missing) {
        return AiEvaluationValidator.validate(new AiEvaluation(hits, missing, "geri bildirim", "Soru?"), CONCEPTS);
    }
}
