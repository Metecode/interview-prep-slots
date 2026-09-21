package com.meteucar.mulakatslot.question;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * payload; prompt, modelAnswer, keyConcepts, followUps gibi iç içe alanları
 * taşır. Bunlara göre sorgu atmadığımız için ilişkisel olarak parçalanmadı.
 */
@Entity
@Table(name = "question")
public class Question {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    private String id;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "topic", nullable = false)
    private String topic;

    @Column(name = "difficulty", nullable = false)
    private short difficulty;

    @Column(name = "kind", nullable = false)
    private String kind;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Question() {
        // JPA için
    }

    public Question(String id, String category, String topic, short difficulty, String kind,
            Map<String, Object> payload) {
        this.id = id;
        this.category = category;
        this.topic = topic;
        this.difficulty = difficulty;
        this.kind = kind;
        this.payload = payload;
    }

    public String getId() {
        return id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public short getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(short difficulty) {
        this.difficulty = difficulty;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public Map<String, Object> getPayload() {
        return payload;
    }

    public void setPayload(Map<String, Object> payload) {
        this.payload = payload;
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
