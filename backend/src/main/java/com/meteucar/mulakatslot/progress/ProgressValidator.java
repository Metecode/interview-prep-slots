package com.meteucar.mulakatslot.progress;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Gelen senkron kayıtlarını eler.
 *
 * <p>Değer ihlali isteği 400'e düşürmez, yalnızca o kaydı atlatır: tek bozuk
 * kayıt yüzünden kullanıcının tüm senkronunun durması, o kaydın kaybından çok
 * daha pahalı. (Şekil ihlali — denemede bilinmeyen alan — farklı: o Jackson
 * katmanında 400 alır, bkz. {@link ProgressAttempt}.)
 *
 * <p>Log yazmaz. Atlama nedeni {@link Rejected} olarak döner ve servis onu
 * user_id ile birlikte loglar. Nedenler sabit metin: kullanıcıdan gelen hiçbir
 * değer, özellikle cevap metni, loga ulaşmasın.
 */
final class ProgressValidator {

    /**
     * İstemcinin saati yanlış olabilir. Bu kadar ileri bir tarih, sunucudaki
     * doğru veriyi sonsuza kadar ezecek bir kayıt demektir; kabul edilmez.
     */
    static final Duration MAX_FUTURE_SKEW = Duration.ofDays(1);

    /**
     * Frontend'de de aynı sınır (src/domain/progress.ts MAX_ANSWER_LENGTH).
     * UTF-16 birimi sayılıyor; JavaScript'in length'iyle aynı ölçü.
     */
    static final int MAX_ANSWER_LENGTH = 5000;

    private ProgressValidator() {
    }

    /** Doğrulamanın sonucu: ya saklanabilir durum ya da atlama nedeni. */
    sealed interface Result permits Valid, Rejected {
    }

    record Valid(ProgressState state) implements Result {
    }

    /**
     * @param questionId kayıtta yoksa null
     * @param reason     sabit metin; loga olduğu gibi yazılır
     */
    record Rejected(String questionId, String reason) implements Result {
    }

    static Result validate(ProgressRecord record, OffsetDateTime now) {
        if (record == null || record.questionId() == null || record.questionId().isBlank()) {
            return new Rejected(null, "questionId yok");
        }
        String questionId = record.questionId();

        if (record.box() == null || record.box() < 1 || record.box() > 5) {
            return new Rejected(questionId, "box 1-5 aralığı dışında");
        }

        if (record.attempts() == null) {
            return new Rejected(questionId, "attempts yok");
        }
        if (record.attempts().size() > ProgressAttempts.MAX_ATTEMPTS) {
            return new Rejected(questionId, "attempts " + ProgressAttempts.MAX_ATTEMPTS + " denemeden uzun");
        }

        OffsetDateTime lastSeenAt = parseTimestamp(record.lastSeenAt());
        if (lastSeenAt == null) {
            return new Rejected(questionId, "lastSeenAt geçerli ISO tarih değil");
        }
        if (lastSeenAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
            return new Rejected(questionId, "lastSeenAt bir günden fazla ileride");
        }

        List<Map<String, Object>> attempts = new ArrayList<>();
        for (ProgressAttempt attempt : record.attempts()) {
            String problem = attemptProblem(attempt);
            if (problem != null) {
                return new Rejected(questionId, problem);
            }
            attempts.add(attempt.toStored());
        }

        return new Valid(new ProgressState(questionId, record.box().shortValue(), lastSeenAt, attempts));
    }

    /** Denemedeki ilk değer ihlali; deneme geçerliyse null. */
    private static String attemptProblem(ProgressAttempt attempt) {
        if (attempt == null) {
            return "deneme boş";
        }
        // Birleştirme denemeleri at'e göre tekilleştirip sıralıyor.
        if (parseTimestamp(attempt.at()) == null) {
            return "deneme zamanı (at) geçerli ISO tarih değil";
        }

        String answer = attempt.answer();
        if (answer == null) {
            return "cevap (answer) yok";
        }
        if (answer.length() > MAX_ANSWER_LENGTH) {
            return "cevap " + MAX_ANSWER_LENGTH + " karakteri aşıyor";
        }
        // Postgres JSONB \u0000'ı reddediyor: kabul edilseydi yazma hatası
        // tüm senkronu 500'e düşürürdü.
        if (answer.indexOf('\u0000') >= 0) {
            return "cevap NUL karakteri içeriyor";
        }
        // Eşi olmayan surrogate geçerli UTF-8'e çevrilemez; saklanırsa ya
        // reddedilir ya da sessizce bozulur.
        if (hasUnpairedSurrogate(answer)) {
            return "cevap eşi olmayan surrogate içeriyor";
        }

        if (attempt.hitCount() == null || attempt.hitCount() < 0) {
            return "hitCount eksik ya da negatif";
        }
        if (attempt.totalConcepts() == null || attempt.totalConcepts() < 1) {
            return "totalConcepts eksik ya da 1'den küçük";
        }
        if (attempt.selfRating() == null || attempt.selfRating() < 0 || attempt.selfRating() > 2) {
            return "selfRating 0-2 aralığı dışında";
        }
        if (attempt.passed() == null) {
            return "passed yok";
        }
        return null;
    }

    /** Ayrıştırılamayan ya da eksik tarih null döner. */
    private static OffsetDateTime parseTimestamp(String value) {
        if (value == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static boolean hasUnpairedSurrogate(String text) {
        for (int i = 0; i < text.length(); i++) {
            char current = text.charAt(i);
            if (Character.isHighSurrogate(current)) {
                if (i + 1 < text.length() && Character.isLowSurrogate(text.charAt(i + 1))) {
                    // Geçerli çift; eşini de atla.
                    i++;
                    continue;
                }
                return true;
            }
            if (Character.isLowSurrogate(current)) {
                return true;
            }
        }
        return false;
    }
}
