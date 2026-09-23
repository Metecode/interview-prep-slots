package com.meteucar.mulakatslot.ai;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Sağlayıcının ham çıktısını rubriğe göre temizler. Saf: veritabanı,
 * Spring ve sağlayıcı bilmez; bu yüzden birim testle sınanır.
 *
 * <p>Model şemaya uysa bile ona güvenilmez: bilinmeyen id üretebilir, bir
 * kavramı hiçbir listeye koymayabilir ya da ikisine birden koyabilir.
 */
public final class AiEvaluationValidator {

    /** Devam sorusu için savunma sınırı; tek bir soru bundan uzun olmaz. */
    static final int FOLLOW_UP_MAX_CHARS = 300;

    private AiEvaluationValidator() {
    }

    /**
     * Kurallar:
     * <ul>
     * <li>Rubrikte olmayan id'ler atılır.</li>
     * <li>Bir kavram yalnızca hits'te ve missing'de DEĞİLSE karşılanmış
     * sayılır. İki listede birden geçiyorsa model kararsız demektir;
     * kullanıcıya bilmediği bir şeyi "biliyorsun" demektense eksik
     * saymak daha az zararlı.</li>
     * <li>Geri kalan her kavram missing'e gider: hits ∪ missing her zaman
     * kavram listesinin tamamı.</li>
     * <li>İki liste de rubrik sırasıyla döner; çiplerin sırası değişmesin.</li>
     * <li>feedback {@link EvaluationPrompt#FEEDBACK_MAX_CHARS} karakterde,
     * followUp {@link #FOLLOW_UP_MAX_CHARS} karakterde kesilir.</li>
     * </ul>
     */
    public static AiEvaluation validate(AiEvaluation raw, List<String> conceptIds) {
        Set<String> claimedHits = raw.hits() == null ? Set.of() : new HashSet<>(raw.hits());
        Set<String> claimedMissing = raw.missing() == null ? Set.of() : new HashSet<>(raw.missing());

        List<String> hits = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String id : conceptIds) {
            if (claimedHits.contains(id) && !claimedMissing.contains(id)) {
                hits.add(id);
            } else {
                missing.add(id);
            }
        }

        return new AiEvaluation(
                List.copyOf(hits),
                List.copyOf(missing),
                truncate(raw.feedback(), EvaluationPrompt.FEEDBACK_MAX_CHARS),
                truncate(raw.followUp(), FOLLOW_UP_MAX_CHARS));
    }

    /**
     * Karakter, kod noktası olarak sayılır: UTF-16 birimiyle kesmek bir
     * emojiyi ya da vekil çifti ortadan bölüp bozuk metin üretebilirdi.
     */
    static String truncate(String text, int maxChars) {
        if (text == null) {
            return "";
        }
        String trimmed = text.strip();
        if (trimmed.codePointCount(0, trimmed.length()) <= maxChars) {
            return trimmed;
        }
        int end = trimmed.offsetByCodePoints(0, maxChars);
        return trimmed.substring(0, end).stripTrailing();
    }
}
