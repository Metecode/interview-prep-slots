/* ------------------------------------------------------------------ */
/* iOS sessiz anahtar ipucu — saf karar                                */
/*                                                                     */
/* Web'den sessiz anahtarın durumu okunamıyor ve iOS o konumdayken Web  */
/* Audio'yu susturuyor. Yapabileceğimiz tek şey kullanıcıyı doğru       */
/* anda uyarmak: sesi ilk açtığında ve açtığı halde duymadığı belli     */
/* olduğunda (kısa sürede ikinci kez açıyorsa).                         */
/* ------------------------------------------------------------------ */

/** Bu süre içinde ses ikinci kez açılırsa kullanıcı duymuyor sayılır. */
export const REPEAT_ENABLE_WINDOW_MS = 15_000;

/** İpucunun ekranda kaldığı süre. */
export const SOUND_HINT_DURATION_MS = 4_000;

export type DeviceInfo = {
  userAgent: string;
  maxTouchPoints: number;
};

/**
 * iPhone, iPod ya da iPad mi? iPadOS 13'ten beri Safari masaüstü user
 * agent'ı ("Macintosh") gönderiyor; onu gerçek Mac'ten ayıran dokunmatik
 * ekran. Android ve masaüstünde sessiz anahtar yok, ipucu gösterilmez.
 */
export function isAppleTouchDevice({ userAgent, maxTouchPoints }: DeviceInfo): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Ses açıldığı anda ipucu gösterilsin mi?
 * - Daha önce hiç gösterilmediyse evet (ilk açılış).
 * - Önceki açılış REPEAT_ENABLE_WINDOW_MS içindeyse evet: aç-kapat-aç,
 *   kullanıcının duymadığının işareti.
 */
export function shouldShowSoundHint(options: {
  hintShown: boolean;
  lastEnabledAt: number | null;
  now: number;
}): boolean {
  const { hintShown, lastEnabledAt, now } = options;
  if (!hintShown) return true;
  return lastEnabledAt !== null && now - lastEnabledAt <= REPEAT_ENABLE_WINDOW_MS;
}
