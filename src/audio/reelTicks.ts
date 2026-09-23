/* ------------------------------------------------------------------ */
/* Tambur tıkları — saf hesap                                          */
/*                                                                     */
/* Tık sabit bir zamanlayıcıyla çalınmıyor: şeridin o anki konumundan  */
/* ödeme çizgisindeki satır hesaplanıyor, satır değişince tık çalıyor. */
/* Böylece hızlı dönüşte sık, yavaşlarken seyrek; animasyon atlanınca  */
/* ya da hızlı modda da ses görüntüyle aynı kalıyor.                   */
/* ------------------------------------------------------------------ */

/**
 * İki tık arasındaki en kısa süre. Daha sık tıklar ayrı ayrı duyulmuyor,
 * tek bir vızıltıya dönüşüyor. Sınır iki tambur için ortak: aynı anda
 * dönen iki şeridin tıkları da üst üste binmesin.
 */
export const MIN_TICK_GAP_MS = 25;

/**
 * getComputedStyle(...).transform değerinden dikey ötelemeyi okur.
 * Tarayıcı hesaplanmış değeri her zaman "none", matrix(...) ya da
 * matrix3d(...) olarak verir; translateY(...) yazılmış olsa bile.
 * Okunamayan değer 0 sayılır: tık hesabı bozulsun ama hata fırlatmasın.
 */
export function parseTranslateY(transform: string): number {
  const match = /^matrix(3d)?\((.+)\)$/.exec(transform.trim());
  if (!match) return 0;

  const values = match[2].split(",").map((part) => Number.parseFloat(part));
  // matrix(a, b, c, d, tx, ty) → 5. indeks; matrix3d'de ty 13. indeks.
  const ty = match[1] ? values[13] : values[5];
  return Number.isFinite(ty) ? ty : 0;
}

/**
 * Ödeme çizgisinde duran satırın şeritteki indeksi.
 *
 * Şerit yukarı kaydıkça translateY eksiye gider; her satır yüksekliği
 * kadar kayma ortaya bir sonraki satırı getirir. Yuvarlama en yakın
 * satırı seçer: satırın ortası çizgiyi yarı yolda geçtiğinde değişir,
 * yani tık yüz çizginin üstündeyken duyulur.
 *
 * restIndex, şerit hiç kaydırılmamışken ortada duran satır.
 */
export function paylineRowIndex(
  translateY: number,
  rowHeight: number,
  restIndex: number,
): number {
  if (!(rowHeight > 0)) return restIndex;
  return restIndex + Math.round(-translateY / rowHeight);
}

/**
 * Bu tık çalınsın mı? Önceki tıktan MIN_TICK_GAP_MS geçmediyse hayır.
 * Hiç tık çalınmamışsa (lastTickAt null) her zaman evet.
 */
export function shouldPlayTick(
  now: number,
  lastTickAt: number | null,
  minGapMs: number = MIN_TICK_GAP_MS,
): boolean {
  return lastTickAt === null || now - lastTickAt >= minGapMs;
}
