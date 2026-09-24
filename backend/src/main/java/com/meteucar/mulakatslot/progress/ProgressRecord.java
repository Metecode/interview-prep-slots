package com.meteucar.mulakatslot.progress;

import java.util.List;

/**
 * Senkron uçlarının hem girdi hem çıktı şekli; frontend'in
 * src/domain/progress.ts#QuestionProgress tipiyle birebir eşleşir.
 *
 * <p>lastSeenAt bilerek String: bozuk bir tarih tüm isteği 400'e düşürmesin,
 * yalnızca o kayıt atlansın (bkz. {@link ProgressValidator}). Aynı sebeple
 * box da ilkel değil sarmalayıcı tip — alan hiç gelmediğinde sessizce 0
 * olmasın, null kalıp doğrulamada elensin.
 *
 * <p>attempts tipli: denemede bilinmeyen alan isteği 400'e düşürür, değer
 * ihlali yalnızca kaydı atlatır (bkz. {@link ProgressAttempt}). Saklarken
 * JSONB'ye yazılır; içeriğine SQL sorgusu atılmayacağı için ilişkisel olarak
 * parçalanmadı.
 */
public record ProgressRecord(
        String questionId,
        Integer box,
        String lastSeenAt,
        List<ProgressAttempt> attempts) {
}
