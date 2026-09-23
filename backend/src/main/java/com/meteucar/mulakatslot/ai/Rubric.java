package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.question.Question;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Değerlendirmenin ölçütü: soru, kavramlar ve model cevap. Her zaman
 * sunucunun kendi veritabanındaki sorudan kurulur; istemciden rubrik
 * alınmaz, yoksa kullanıcı "her kavram karşılandı" diyen bir rubrik
 * gönderebilirdi.
 */
public record Rubric(String questionId, String prompt, String modelAnswer, List<Concept> concepts) {

    public record Concept(String id, String label, List<String> anchors) {
    }

    /** Kavram id'leri, içerikteki sırayla. */
    public List<String> conceptIds() {
        return concepts.stream().map(Concept::id).toList();
    }

    /**
     * payload JSONB'den okunur. Seeder içeriği Bean Validation'dan geçirerek
     * yazdığı için alanlar yerinde; yine de eksik alan istisna değil boş
     * değer üretir, bozuk bir soru değerlendirmeyi 500'e çevirmesin.
     */
    public static Rubric of(Question question) {
        Map<String, Object> payload = question.getPayload();
        List<Concept> concepts = new ArrayList<>();
        if (payload.get("keyConcepts") instanceof List<?> rawConcepts) {
            for (Object raw : rawConcepts) {
                if (raw instanceof Map<?, ?> concept && concept.get("id") instanceof String id) {
                    concepts.add(new Concept(id, stringOrEmpty(concept.get("label")), strings(concept.get("anchors"))));
                }
            }
        }
        return new Rubric(
                question.getId(),
                stringOrEmpty(payload.get("prompt")),
                stringOrEmpty(payload.get("modelAnswer")),
                List.copyOf(concepts));
    }

    private static String stringOrEmpty(Object value) {
        return value instanceof String text ? text : "";
    }

    private static List<String> strings(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream().filter(String.class::isInstance).map(String.class::cast).toList();
    }
}
