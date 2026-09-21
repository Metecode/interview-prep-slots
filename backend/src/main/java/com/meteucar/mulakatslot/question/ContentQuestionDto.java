package com.meteucar.mulakatslot.question;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Frontend'in src/domain/question.ts#questionSchema ile birebir eşleşir.
 */
public record ContentQuestionDto(
        @NotBlank @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "kebab-case olmalı") String id,
        @NotBlank String category,
        @NotBlank @Size(min = 2, max = 24) String topic,
        @Min(1) @Max(3) short difficulty,
        @NotBlank @Pattern(regexp = "definition|applied") String kind,
        @NotBlank @Size(min = 10) String prompt,
        @NotBlank @Size(min = 20) String modelAnswer,
        @NotEmpty @Size(min = 3, max = 6) @Valid List<ContentKeyConceptDto> keyConcepts,
        @Size(max = 3) List<@Size(min = 10) String> followUps,
        String source) {
}
