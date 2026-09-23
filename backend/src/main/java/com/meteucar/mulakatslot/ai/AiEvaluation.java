package com.meteucar.mulakatslot.ai;

import java.util.List;

/**
 * Yapay zekânın kararı.
 *
 * @param hits     cevapta karşılanan kavramların id'leri
 * @param missing  karşılanmayanlar; doğrulamadan sonra hits ile birlikte
 *                 kavram listesinin tamamı
 * @param feedback kısa, nötr Türkçe geri bildirim; puan içermez
 * @param followUp tek bir devam sorusu
 */
public record AiEvaluation(List<String> hits, List<String> missing, String feedback, String followUp) {
}
