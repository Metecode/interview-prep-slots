package com.meteucar.mulakatslot.question;

import jakarta.validation.ConstraintViolation;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Doğrulama hatalarını hangi dosya, hangi soru id'sinde olduğu belli olacak
 * şekilde okunur bir mesaja çevirir. QuestionSeeder'ı kısa tutmak için ayrı
 * dosyada.
 */
final class ContentViolationFormatter {

    private static final Pattern QUESTION_INDEX = Pattern.compile("questions\\[(\\d+)\\]");

    private ContentViolationFormatter() {
    }

    static String describe(String filename, ContentFileDto file,
            Set<ConstraintViolation<ContentFileDto>> violations) {
        String details = violations.stream()
                .map(v -> "  - %s (%s): %s".formatted(v.getPropertyPath(), questionIdFor(file, v), v.getMessage()))
                .sorted()
                .collect(Collectors.joining("\n"));
        return "%s: içerik doğrulaması başarısız\n%s".formatted(filename, details);
    }

    private static String questionIdFor(ContentFileDto file, ConstraintViolation<ContentFileDto> violation) {
        Matcher matcher = QUESTION_INDEX.matcher(violation.getPropertyPath().toString());
        if (!matcher.find()) {
            return "soru id'si belirlenemedi";
        }
        int index = Integer.parseInt(matcher.group(1));
        List<ContentQuestionDto> questions = file.questions();
        if (questions == null || index >= questions.size()) {
            return "soru id'si belirlenemedi";
        }
        String id = questions.get(index).id();
        return (id == null || id.isBlank()) ? "soru id'si belirlenemedi" : "id=" + id;
    }
}
