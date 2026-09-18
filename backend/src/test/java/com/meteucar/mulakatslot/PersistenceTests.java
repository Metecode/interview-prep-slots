package com.meteucar.mulakatslot;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.progress.QuestionProgress;
import com.meteucar.mulakatslot.progress.QuestionProgressId;
import com.meteucar.mulakatslot.progress.QuestionProgressRepository;
import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.question.QuestionRepository;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * Üç tabloya kayıt yazıp okuyarak JSONB alanlarının doğru saklandığını
 * doğrular.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class PersistenceTests {

	@Autowired
	private AppUserRepository appUserRepository;

	@Autowired
	private QuestionRepository questionRepository;

	@Autowired
	private QuestionProgressRepository questionProgressRepository;

	@Autowired
	private EntityManager entityManager;

	@Test
	@Transactional
	void writesAndReadsAllThreeTablesWithJsonbPayload() {
		AppUser user = appUserRepository.save(new AppUser("gh-12345", "metecode"));

		Map<String, Object> payload = Map.of(
				"prompt", "React'te virtual DOM nedir?",
				"keyConcepts", List.of("diffing", "reconciliation"));
		Question question = questionRepository.save(
				new Question("react-virtual-dom", "frontend", "react", (short) 2, "open-ended", payload));

		QuestionProgress progress = new QuestionProgress(user, question, (short) 1, OffsetDateTime.now());
		progress.setAttempts(List.of(Map.of("selfRating", "partial", "matchedConcepts", List.of("diffing"))));
		questionProgressRepository.save(progress);

		// Persistence context'i temizleyip gerçekten DB'den okuduğumuzdan emin oluyoruz.
		entityManager.flush();
		entityManager.clear();

		Optional<AppUser> foundUser = appUserRepository.findById(user.getId());
		assertThat(foundUser).isPresent();
		assertThat(foundUser.get().getGithubId()).isEqualTo("gh-12345");

		Optional<Question> foundQuestion = questionRepository.findById("react-virtual-dom");
		assertThat(foundQuestion).isPresent();
		assertThat(foundQuestion.get().getPayload())
				.containsEntry("prompt", "React'te virtual DOM nedir?")
				.containsEntry("keyConcepts", List.of("diffing", "reconciliation"));

		Optional<QuestionProgress> foundProgress = questionProgressRepository
				.findById(new QuestionProgressId(user.getId(), question.getId()));
		assertThat(foundProgress).isPresent();
		assertThat(foundProgress.get().getBox()).isEqualTo((short) 1);
		assertThat(foundProgress.get().getAttempts()).hasSize(1);
		assertThat(foundProgress.get().getAttempts().get(0)).containsEntry("selfRating", "partial");
	}
}
