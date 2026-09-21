package com.meteucar.mulakatslot.question;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Frontend'in src/domain/question.ts#keyConceptSchema ile birebir eşleşir.
 */
public record ContentKeyConceptDto(
        @NotBlank String id,
        @NotBlank String label,
        @NotEmpty List<@NotBlank String> aliases,
        @NotEmpty @Size(max = 4) List<@Size(min = 10) String> anchors) {
}
