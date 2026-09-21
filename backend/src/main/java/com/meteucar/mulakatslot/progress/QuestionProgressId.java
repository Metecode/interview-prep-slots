package com.meteucar.mulakatslot.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class QuestionProgressId implements Serializable {

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "question_id")
    private String questionId;

    protected QuestionProgressId() {
        // JPA için
    }

    public QuestionProgressId(UUID userId, String questionId) {
        this.userId = userId;
        this.questionId = questionId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getQuestionId() {
        return questionId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof QuestionProgressId that)) {
            return false;
        }
        return Objects.equals(userId, that.userId) && Objects.equals(questionId, that.questionId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, questionId);
    }
}
