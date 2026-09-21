package com.meteucar.mulakatslot.question;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Adımlar birbirine bağlı: her test bir öncekinin bıraktığı içerik
 * klasörünü değiştirip seeder'ı tekrar çalıştırıyor, bu yüzden sıralı.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class QuestionSeederTest {

    @TempDir
    static Path contentDir;

    @Autowired
    private QuestionSeeder questionSeeder;

    @Autowired
    private QuestionRepository questionRepository;

    @DynamicPropertySource
    static void contentLocation(DynamicPropertyRegistry registry) {
        registry.add("app.content.location", () -> "file:" + contentDir + "/*.json");
    }

    @BeforeAll
    static void writeInitialFixture() throws IOException {
        writeFixture("Alfa üzerine ilk soru metnidir, yeterince uzun tutuldu.");
    }

    @Test
    @Order(1)
    void firstRunInsertsAllQuestions() {
        assertThat(questionRepository.findAllById(List.of("seed-test-alpha", "seed-test-beta")))
                .hasSize(2);
    }

    @Test
    @Order(2)
    void secondRunWithSameContentChangesNothing() {
        OffsetDateTime alphaBefore = updatedAtOf("seed-test-alpha");
        OffsetDateTime betaBefore = updatedAtOf("seed-test-beta");

        QuestionSeeder.SeedResult result = questionSeeder.seed();

        assertThat(result.inserted()).isZero();
        assertThat(result.updated()).isZero();
        assertThat(result.deleted()).isZero();
        assertThat(result.unchanged()).isEqualTo(2);
        assertThat(updatedAtOf("seed-test-alpha")).isEqualTo(alphaBefore);
        assertThat(updatedAtOf("seed-test-beta")).isEqualTo(betaBefore);
    }

    @Test
    @Order(3)
    void changingOnePayloadUpdatesOnlyThatQuestion() throws IOException {
        OffsetDateTime betaBefore = updatedAtOf("seed-test-beta");

        writeFixture("Alfa üzerine değişen ve güncellenmiş soru metnidir.");
        QuestionSeeder.SeedResult result = questionSeeder.seed();

        assertThat(result.updated()).isEqualTo(1);
        assertThat(result.unchanged()).isEqualTo(1);
        assertThat(result.inserted()).isZero();
        assertThat(result.deleted()).isZero();
        assertThat(updatedAtOf("seed-test-beta")).isEqualTo(betaBefore);

        Question alpha = questionRepository.findById("seed-test-alpha").orElseThrow();
        assertThat(alpha.getPayload()).containsEntry("modelAnswer",
                "Alfa üzerine değişen ve güncellenmiş soru metnidir.");
    }

    @Test
    @Order(4)
    void removingAQuestionFromJsonDeletesItFromDatabase() throws IOException {
        Files.writeString(contentDir.resolve("round.json"), """
                {
                  "lang": "tr",
                  "category": "sql",
                  "questions": [%s]
                }
                """.formatted(betaJson()));

        QuestionSeeder.SeedResult result = questionSeeder.seed();

        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.unchanged()).isEqualTo(1);
        assertThat(questionRepository.findById("seed-test-alpha")).isEmpty();
        assertThat(questionRepository.findById("seed-test-beta")).isPresent();
    }

    private OffsetDateTime updatedAtOf(String id) {
        Optional<Question> question = questionRepository.findById(id);
        assertThat(question).isPresent();
        return question.get().getUpdatedAt();
    }

    private static void writeFixture(String alphaModelAnswer) throws IOException {
        Files.writeString(contentDir.resolve("round.json"), """
                {
                  "lang": "tr",
                  "category": "sql",
                  "questions": [%s, %s]
                }
                """.formatted(alphaJson(alphaModelAnswer), betaJson()));
    }

    private static String alphaJson(String modelAnswer) {
        return """
                {
                  "id": "seed-test-alpha",
                  "category": "sql",
                  "topic": "Alfa Konu",
                  "difficulty": 2,
                  "kind": "definition",
                  "prompt": "Alfa sorusu nedir ve neden vardır?",
                  "modelAnswer": "%s",
                  "keyConcepts": [
                    {"id": "a1", "label": "Kavram A1", "aliases": ["a1"], "anchors": ["Bu alfa kavramı bir için çapa cümlesidir."]},
                    {"id": "a2", "label": "Kavram A2", "aliases": ["a2"], "anchors": ["Bu alfa kavramı iki için çapa cümlesidir."]},
                    {"id": "a3", "label": "Kavram A3", "aliases": ["a3"], "anchors": ["Bu alfa kavramı üç için çapa cümlesidir."]}
                  ]
                }
                """.formatted(modelAnswer);
    }

    private static String betaJson() {
        return """
                {
                  "id": "seed-test-beta",
                  "category": "react",
                  "topic": "Beta Konu",
                  "difficulty": 1,
                  "kind": "applied",
                  "prompt": "Beta sorusu nedir ve neden vardır?",
                  "modelAnswer": "Beta üzerine sabit kalan, hiç değişmeyen soru metnidir.",
                  "keyConcepts": [
                    {"id": "b1", "label": "Kavram B1", "aliases": ["b1"], "anchors": ["Bu beta kavramı bir için çapa cümlesidir."]},
                    {"id": "b2", "label": "Kavram B2", "aliases": ["b2"], "anchors": ["Bu beta kavramı iki için çapa cümlesidir."]},
                    {"id": "b3", "label": "Kavram B3", "aliases": ["b3"], "anchors": ["Bu beta kavramı üç için çapa cümlesidir."]}
                  ]
                }
                """;
    }
}
