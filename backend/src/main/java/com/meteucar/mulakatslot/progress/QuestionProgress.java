package com.meteucar.mulakatslot.progress;

import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Kutu (box) yalnızca kullanıcının öz-değerlendirmesiyle değişir, AI
 * skoruyla değil. attempts; alias eşleşmesi ve öz-değerlendirme geçmişini
 * tutar, sorgu atılmayacağı için JSONB.
 */
@Entity
@Table(name = "question_progress")
public class QuestionProgress {

    @EmbeddedId
    private QuestionProgressId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("questionId")
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "box", nullable = false)
    private short box;

    @Column(name = "last_seen_at", nullable = false)
    private OffsetDateTime lastSeenAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attempts", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> attempts = new ArrayList<>();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected QuestionProgress() {
        // JPA için
    }

    public QuestionProgress(AppUser user, Question question, short box, OffsetDateTime lastSeenAt) {
        this.user = user;
        this.question = question;
        this.id = new QuestionProgressId(user.getId(), question.getId());
        this.box = box;
        this.lastSeenAt = lastSeenAt;
    }

    public QuestionProgressId getId() {
        return id;
    }

    public AppUser getUser() {
        return user;
    }

    public Question getQuestion() {
        return question;
    }

    public short getBox() {
        return box;
    }

    public void setBox(short box) {
        this.box = box;
    }

    public OffsetDateTime getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(OffsetDateTime lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }

    public List<Map<String, Object>> getAttempts() {
        return attempts;
    }

    public void setAttempts(List<Map<String, Object>> attempts) {
        this.attempts = attempts;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    @PrePersist
    @PreUpdate
    void touchUpdatedAt() {
        this.updatedAt = OffsetDateTime.now();
    }
}
