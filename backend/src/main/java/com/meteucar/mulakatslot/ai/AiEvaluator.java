package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.question.Question;

/**
 * Sağlayıcıdan bağımsız değerlendirme arayüzü. Uygulamanın geri kalanı
 * yalnızca bunu bilir; Gemini, başka bir sağlayıcı ya da testlerdeki sahte
 * uygulama arasında fark yoktur.
 *
 * <p>Dönen sonuç HAM kabul edilir: bilinmeyen kavram id'leri, eksik liste
 * ya da uzun geri bildirim olabilir. Temizliği {@link AiEvaluationValidator}
 * yapar, uygulamalar ayrıca uğraşmaz.
 *
 * <p>Uygulamalar kullanıcıya ait hiçbir kimlik bilgisini sağlayıcıya
 * göndermez: elde yalnızca soru ve cevap metni var, imza da bunu söylüyor.
 */
public interface AiEvaluator {

    /**
     * @throws AiUnavailableException sağlayıcı şu an cevap veremiyor
     *                                (kota, zaman aşımı, 5xx, ağ)
     * @throws AiResponseException    sağlayıcı cevap verdi ama okunamadı
     */
    AiEvaluation evaluate(Question question, String answer);
}
