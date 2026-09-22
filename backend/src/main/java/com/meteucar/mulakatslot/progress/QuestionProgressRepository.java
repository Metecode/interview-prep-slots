package com.meteucar.mulakatslot.progress;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionProgressRepository extends JpaRepository<QuestionProgress, QuestionProgressId> {

    /**
     * Tek kullanıcının tüm satırları. Ayrı bir index gerekmiyor: birincil
     * anahtar (user_id, question_id) zaten user_id'yi en solda tutuyor.
     */
    List<QuestionProgress> findByIdUserId(UUID userId);
}
