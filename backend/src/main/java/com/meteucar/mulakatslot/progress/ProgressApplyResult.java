package com.meteucar.mulakatslot.progress;

/**
 * PUT /api/progress yanıtı.
 *
 * <ul>
 *   <li>applied — box ve lastSeenAt yazıldı (yeni satır ya da daha yeni kayıt)
 *   <li>merged — kayıt eskiydi, yazılmadı; ama deneme geçmişi birleşti
 *   <li>ignored — hiçbir şey değişmedi: geçersiz, bilinmeyen soru ya da
 *       zaten elimizde olan veri
 * </ul>
 *
 * <p>Üçü de normal sonuç, hata değil.
 */
public record ProgressApplyResult(int applied, int merged, int ignored) {
}
