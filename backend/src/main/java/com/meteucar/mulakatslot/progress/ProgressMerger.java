package com.meteucar.mulakatslot.progress;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Senkronun karar katmanı. Veritabanı, entity, repository ya da Spring
 * bilmez: elindeki iki durumdan hangisinin kazanacağına karar verir, o kadar.
 *
 * <p>Ayrı durmasının sebebi test edilebilirlik: birleştirme kuralları
 * ("yeni lastSeenAt kazanır ama attempts hep birleşir") burada, Postgres
 * ayağa kaldırmadan doğrulanabiliyor. Transaction, kilit ve yazma işi
 * {@link ProgressSyncService}'te.
 */
final class ProgressMerger {

    private ProgressMerger() {
    }

    /**
     * @param stored            soru id'sinden saklanan duruma; değiştirilmez
     * @param incoming          istemciden gelen ham kayıtlar, doğrulanmamış
     * @param knownQuestionIds  içerikte gerçekten var olan soru id'leri
     * @param now               gelecek tarih kontrolünün dayandığı an
     */
    static MergePlan merge(Map<String, ProgressState> stored, List<ProgressRecord> incoming,
            Set<String> knownQuestionIds, OffsetDateTime now) {

        // Aynı istekte tekrar eden questionId, kendinden öncekinin sonucuyla
        // karşılaştırılsın: ikinci kopya "zaten elimizde" sayılır.
        Map<String, ProgressState> current = new LinkedHashMap<>(stored);
        List<ProgressState> changes = new ArrayList<>();
        List<ProgressValidator.Rejected> rejections = new ArrayList<>();
        int applied = 0;
        int merged = 0;
        int ignored = 0;
        int unknownQuestions = 0;

        for (ProgressRecord record : incoming) {
            ProgressValidator.Result result = ProgressValidator.validate(record, now);
            if (result instanceof ProgressValidator.Rejected rejected) {
                rejections.add(rejected);
                ignored++;
                continue;
            }
            ProgressState update = ((ProgressValidator.Valid) result).state();

            if (!knownQuestionIds.contains(update.questionId())) {
                // İçerik sürümleri arasında fark olabilir; hata değil.
                unknownQuestions++;
                ignored++;
                continue;
            }

            ProgressState existing = current.get(update.questionId());
            if (existing == null) {
                ProgressState created = new ProgressState(update.questionId(), update.box(), update.lastSeenAt(),
                        ProgressAttempts.merge(List.of(), update.attempts()));
                current.put(created.questionId(), created);
                changes.add(created);
                applied++;
                continue;
            }

            // Deneme geçmişi kaydın yaşına bakmadan birleşir: eski bir
            // cihazdan gelen cevap da kullanıcının yazdığı cevaptır.
            List<Map<String, Object>> mergedAttempts =
                    ProgressAttempts.merge(existing.attempts(), update.attempts());
            boolean attemptsChanged = !mergedAttempts.equals(existing.attempts());
            boolean incomingIsNewer = update.lastSeenAt().isAfter(existing.lastSeenAt());

            if (!incomingIsNewer && !attemptsChanged) {
                ignored++;
                continue;
            }

            // Kutu ve lastSeenAt yalnızca gelen daha yeniyse değişir;
            // attempts her iki durumda da birleşmiş haliyle yazılır.
            ProgressState next = new ProgressState(
                    update.questionId(),
                    incomingIsNewer ? update.box() : existing.box(),
                    incomingIsNewer ? update.lastSeenAt() : existing.lastSeenAt(),
                    mergedAttempts);
            current.put(next.questionId(), next);
            changes.add(next);

            if (incomingIsNewer) {
                applied++;
            } else {
                // Kayıt eskiydi, kutuya dokunulmadı; yine de yeni bir şey öğrendik.
                merged++;
            }
        }

        return new MergePlan(changes, new ProgressApplyResult(applied, merged, ignored), rejections,
                unknownQuestions);
    }

    /**
     * changes; yalnızca gerçekten değişen satırların YENİ tam durumu.
     * Değişmeyen bir soru burada hiç görünmez, yani çağıran listeyi olduğu
     * gibi uygulayabilir.
     *
     * @param rejections       doğrulamada atlanan kayıtlar ve nedenleri;
     *                         loglamayı user_id'yi bilen çağıran yapar
     * @param unknownQuestions loglanmak için ayrı duruyor; sayaçlarda zaten
     *                         ignored içinde.
     */
    record MergePlan(List<ProgressState> changes, ProgressApplyResult counters,
            List<ProgressValidator.Rejected> rejections, int unknownQuestions) {
    }
}
