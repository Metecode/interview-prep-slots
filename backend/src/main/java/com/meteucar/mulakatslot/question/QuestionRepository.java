package com.meteucar.mulakatslot.question;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepository extends JpaRepository<Question, String> {

    List<Question> findByCategoryIn(Collection<String> categories);
}
