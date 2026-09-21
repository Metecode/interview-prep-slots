package com.meteucar.mulakatslot.question;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import tools.jackson.databind.json.JsonMapper;

/**
 * Doğrulama tamamen bellekte biter ve veritabanına hiç dokunmadan patlar,
 * bu yüzden burada Testcontainers'a gerek yok — JdbcTemplate ve
 * transactionManager'a null veriliyor: kod bunlara ulaşmaya çalışsa test
 * NullPointerException ile patlar, yani "DB'ye hiç dokunmuyor" iddiası
 * testin kendisi tarafından da garanti ediliyor.
 */
class QuestionSeederInvalidContentTest {

    @Test
    void invalidContentStopsBeforeTouchingDatabase() {
        assertThatThrownBy(seederOver("classpath:invalid-content/*.json")::seed)
                .isInstanceOf(QuestionContentException.class)
                .hasMessageContaining("bad.json")
                .hasMessageContaining("keyConcepts")
                .hasMessageContaining("missing-key-concepts");
    }

    @Test
    void emptyContentDirectoryStopsBeforeTouchingDatabase() {
        assertThatThrownBy(seederOver("classpath:empty-content/*.json")::seed)
                .isInstanceOf(QuestionContentException.class)
                .hasMessageContaining("bulunamadı");
    }

    private static QuestionSeeder seederOver(String locationPattern) {
        return new QuestionSeeder(
                new PathMatchingResourcePatternResolver(),
                new JsonMapper(),
                Validation.buildDefaultValidatorFactory().getValidator(),
                null,
                null,
                null,
                locationPattern);
    }
}
