/* ------------------------------------------------------------------ */
/* AudioContext — tembel, tek örnek, sessizce devre dışı kalabilir      */
/*                                                                     */
/* Tarayıcılar sesi ancak bir kullanıcı hareketinden sonra açıyor;      */
/* context o hareketin içinde (kol çekme, ses düğmesi) oluşturulur ve   */
/* iOS Safari için resume() de aynı olayın içinde çağrılır. Olay        */
/* dışında oluşturulan context "suspended" kalır ve hiç ses çıkmaz.     */
/* ------------------------------------------------------------------ */

/**
 * Genel ses seviyesi. Alet sesi arka planda kalsın ama duyulsun: 0.25'te
 * kısa tıklar dizüstü hoparlörlerinde kayboluyordu.
 */
const MASTER_GAIN = 0.5;

type AudioGraph = {
  context: AudioContext;
  /** Bütün sesler buraya bağlanır; seviye tek yerden ayarlanır. */
  master: GainNode;
  /** Gürültü tabanlı sesler için bir kez üretilen beyaz gürültü. */
  noise: AudioBuffer;
};

let graph: AudioGraph | null = null;
/** Oluşturma bir kez başarısız olduysa her çağrıda yeniden denenmez. */
let unavailable = false;
/**
 * resume() sözü henüz çözülmedi. O arada çalınan ses (kol sesi ilk
 * çekişte tam bu aralığa düşüyor) context açılınca birkaç ms geç çalar;
 * atmaktansa geç çalmak iyi.
 */
let resuming = false;

function createGraph(): AudioGraph | null {
  if (unavailable) return null;
  try {
    const context = new AudioContext();

    const master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);

    // 0.25 sn yeter: en uzun gürültü sesi (kol) bunun yarısı kadar.
    const length = Math.floor(context.sampleRate * 0.25);
    const noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    return { context, master, noise };
  } catch {
    // Eski tarayıcı, kapatılmış Web Audio, sınırlı ortam: ses yok, uygulama var.
    unavailable = true;
    return null;
  }
}

/**
 * Kullanıcı hareketinin İÇİNDE çağrılmalı: context'i gerekirse oluşturur
 * ve askıdaysa sürdürür. Hata fırlatmaz.
 */
export function unlockAudio(): void {
  graph ??= createGraph();
  if (!graph) return;

  // "suspended" ya da iOS Safari'nin "interrupted" durumu (tip tanımında yok).
  const state: string = graph.context.state;
  if (state === "running" || state === "closed") return;

  resuming = true;
  graph.context
    .resume()
    // Söz reddedilirse (izin yok) sessiz kalmak yeterli.
    .catch(() => {})
    .finally(() => {
      resuming = false;
    });
}

/**
 * Çalmaya hazır ses grafiği; context yoksa ya da çalışmıyorsa null.
 * Burada context OLUŞTURULMAZ: hareket dışında oluşturmak işe yaramıyor.
 * Uzun süre askıda kalmış context'e ses sıralamak da yanlış olurdu —
 * sürdürüldüğü anda birikmiş seslerin hepsi birden çalardı; bu yüzden
 * askıdayken yalnızca bir resume() sürüyorsa kabul edilir.
 */
export function getRunningGraph(): AudioGraph | null {
  if (!graph) return null;
  const state = graph.context.state;
  return state === "running" || (state === "suspended" && resuming) ? graph : null;
}
