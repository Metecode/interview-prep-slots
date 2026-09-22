package com.meteucar.mulakatslot.progress;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Bir sorunun ilerlemesi, veritabanından bağımsız biçimde.
 *
 * <p>Üç rolü birden taşır: doğrulamadan geçmiş gelen kayıt, saklanan satırın
 * anlık görüntüsü ve birleştirmenin sonucu. Üçü de aynı şey — birleştirme iki
 * duruma aynı gözle bakıp yine aynı türden bir durum üretiyor.
 */
record ProgressState(
        String questionId,
        short box,
        OffsetDateTime lastSeenAt,
        List<Map<String, Object>> attempts) {
}
