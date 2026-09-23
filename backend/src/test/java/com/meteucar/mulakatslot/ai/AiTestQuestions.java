package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.question.Question;
import java.util.List;
import java.util.Map;

/** Birim testlerin ortak sorusu; veritabanına yazılmaz. */
final class AiTestQuestions {

    static final String QUESTION_ID = "ai-test-question";

    private AiTestQuestions() {
    }

    static Question threeConcepts() {
        return new Question(QUESTION_ID, "misc", "Test", (short) 1, "definition", Map.of(
                "prompt", "Önbellek geçersizleştirme neden zordur?",
                "modelAnswer", "Çünkü verinin nerede kopyalandığını ve ne zaman eskidiğini bilmek gerekir.",
                "keyConcepts", List.of(
                        concept("concept-a", "Kavram A", "Bu birinci çapadır, on karakterden uzun."),
                        concept("concept-b", "Kavram B", "Bu ikinci çapadır, on karakterden uzun."),
                        concept("concept-c", "Kavram C", "Bu üçüncü çapadır, on karakterden uzun."))));
    }

    private static Map<String, Object> concept(String id, String label, String anchor) {
        return Map.of("id", id, "label", label, "aliases", List.of(id), "anchors", List.of(anchor));
    }
}
