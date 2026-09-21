package com.meteucar.mulakatslot.question;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import java.util.List;

/**
 * Bir içerik dosyasının tamamı. Frontend'in src/domain/question.ts#questionFileSchema
 * ile birebir eşleşir.
 */
public record ContentFileDto(
        @NotBlank @Pattern(regexp = "tr|en", message = "'tr' ya da 'en' olmalı") String lang,
        @NotBlank String category,
        @NotEmpty(message = "en az bir soru içermeli") @Valid List<ContentQuestionDto> questions) {
}
