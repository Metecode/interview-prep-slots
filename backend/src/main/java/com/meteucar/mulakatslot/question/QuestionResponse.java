package com.meteucar.mulakatslot.question;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Frontend'in src/domain/question.ts#Question tipiyle birebir eşleşir; payload
 * burada üst seviyeye açılır, frontend'de dönüşüm katmanı gerekmez.
 * followUps ve source yoksa alan hiç yazılmaz (Zod tarafında .optional() —
 * null değil, alanın kendisi eksik olmalı).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuestionResponse(
        String id,
        String category,
        String kind,
        String topic,
        short difficulty,
        String prompt,
        String modelAnswer,
        List<KeyConceptResponse> keyConcepts,
        List<String> followUps,
        String source) {
}
