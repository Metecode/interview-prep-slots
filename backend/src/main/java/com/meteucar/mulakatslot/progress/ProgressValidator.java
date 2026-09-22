package com.meteucar.mulakatslot.progress;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Gelen senkron kayıtlarını eler.
 *
 * <p>Geçersiz kayıt isteği 400'e düşürmez, yalnızca atlanır: tek bozuk kayıt
 * yüzünden kullanıcının tüm senkronunun durması, o kaydın kaybından çok daha
 * pahalı. Atlanan her kayıt loglanır ki sessizce kaybolmasın.
 */
final class ProgressValidator {

    /**
     * İstemcinin saati yanlış olabilir. Bu kadar ileri bir tarih, sunucudaki
     * doğru veriyi sonsuza kadar ezecek bir kayıt demektir; kabul edilmez.
     */
    static final Duration MAX_FUTURE_SKEW = Duration.ofDays(1);

    private static final Logger log = LoggerFactory.getLogger(ProgressValidator.class);

    private ProgressValidator() {
    }

    static Optional<ProgressState> validate(ProgressRecord record, OffsetDateTime now) {
        if (record == null || record.questionId() == null || record.questionId().isBlank()) {
            log.info("Senkron kaydı atlandı: questionId yok");
            return Optional.empty();
        }
        String questionId = record.questionId();

        if (record.box() == null || record.box() < 1 || record.box() > 5) {
            log.info("Senkron kaydı atlandı: box aralık dışı (question_id={}, box={})", questionId, record.box());
            return Optional.empty();
        }

        if (record.attempts() == null || record.attempts().size() > ProgressAttempts.MAX_ATTEMPTS) {
            log.info("Senkron kaydı atlandı: attempts dizi değil ya da {} elemandan uzun (question_id={})",
                    ProgressAttempts.MAX_ATTEMPTS, questionId);
            return Optional.empty();
        }

        OffsetDateTime lastSeenAt;
        try {
            lastSeenAt = OffsetDateTime.parse(record.lastSeenAt());
        } catch (DateTimeParseException | NullPointerException e) {
            log.info("Senkron kaydı atlandı: lastSeenAt geçerli ISO tarih değil (question_id={}, değer={})",
                    questionId, record.lastSeenAt());
            return Optional.empty();
        }

        if (lastSeenAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
            log.info("Senkron kaydı atlandı: lastSeenAt gelecekte (question_id={}, değer={})",
                    questionId, lastSeenAt);
            return Optional.empty();
        }

        return Optional.of(new ProgressState(
                questionId, record.box().shortValue(), lastSeenAt, new ArrayList<>(record.attempts())));
    }
}
