/* ------------------------------------------------------------------ */
/* AudioContext — tembel, tek örnek, sessizce devre dışı kalabilir      */
/*                                                                     */
/* Tarayıcılar sesi ancak bir kullanıcı hareketinden sonra açıyor;      */
/* context o hareketin içinde (kol çekme, ses düğmesi) oluşturulur ve   */
/* iOS Safari için resume() de aynı olayın içinde çağrılır. Olay        */
/* dışında oluşturulan context "suspended" kalır ve hiç ses çıkmaz.     */
/*                                                                     */
/* iOS context'i arka plana geçişte, aramada, kilit ekranında           */
/* "interrupted" ya da "suspended" yapar ve kendiliğinden açmaz; bu     */
/* yüzden her kullanıcı hareketinde durum yeniden kontrol edilir.       */
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
/**
 * Sonuçlanmamış resume() sözü. O arada çalınan ses (kol sesi ilk
 * çekişte tam bu aralığa düşüyor) context açılınca birkaç ms geç çalar;
 * atmaktansa geç çalmak iyi. Boolean yerine söz: üst üste iki resume()
 * olduğunda ilkinin bitişi ikincisini "bitti" diye işaretlemesin.
 */
let pendingResume: Promise<void> | null = null;

/** Hatalar yutulmaz ama kullanıcıya da gösterilmez: yalnızca geliştirmede. */
function reportAudioIssue(message: string, detail?: unknown): void {
  if (import.meta.env.DEV) console.warn(`[ses] ${message}`, detail ?? "");
}

function createGraph(): AudioGraph | null {
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

    if (import.meta.env.DEV) {
      context.addEventListener("statechange", () => {
        reportAudioIssue(`context durumu: ${context.state}`);
      });
    }

    return { context, master, noise };
  } catch (error) {
    // Eski tarayıcı, kapatılmış Web Audio, sınırlı ortam: ses yok, uygulama var.
    // Kalıcı olarak vazgeçilmez; bir sonraki harekette yeniden denenir.
    reportAudioIssue("AudioContext oluşturulamadı", error);
    return null;
  }
}

/**
 * iOS bazen resume() sözünü çözüyor ama context askıda kalıyor. Hareketin
 * içinde gerçekten bir ses kaynağı başlatmak kilidi güvenilir biçimde açan
 * klasik yol: 1 örneklik sessiz bir arabellek.
 */
function playSilence(context: AudioContext): void {
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.start(0);
  } catch (error) {
    reportAudioIssue("sessiz kilit arabelleği çalınamadı", error);
  }
}

/**
 * Kullanıcı hareketinin İÇİNDE çağrılmalı (pointerup, touchend, keydown,
 * click): context yoksa ya da kapanmışsa oluşturur, çalışmıyorsa sürdürür.
 * Her harekette çağrılması güvenli; context zaten çalışıyorsa hiçbir şey
 * yapmaz. Hata fırlatmaz.
 */
export function ensureAudioReady(): void {
  if (!graph || graph.context.state === "closed") graph = createGraph();
  if (!graph) return;

  const { context } = graph;
  // "suspended" ya da iOS Safari'nin "interrupted" durumu (tip tanımında yok).
  const state: string = context.state;
  if (state === "running") return;

  playSilence(context);

  const resume = context
    .resume()
    .catch((error: unknown) => {
      reportAudioIssue(`resume() reddedildi (durum: ${state})`, error);
    })
    .finally(() => {
      if (pendingResume === resume) pendingResume = null;
    });
  pendingResume = resume;
}

/**
 * Çalmaya hazır ses grafiği; context yoksa ya da çalışmıyorsa null.
 * Burada context OLUŞTURULMAZ: hareket dışında oluşturmak işe yaramıyor.
 * Uzun süre askıda kalmış context'e ses sıralamak da yanlış olurdu —
 * sürdürüldüğü anda birikmiş seslerin hepsi birden çalardı; bu yüzden
 * askıdayken yalnızca bir resume() sürüyorsa kabul edilir. iOS'un
 * "interrupted" durumu da askı sayılır: yalnızca "suspended"a bakılsaydı
 * arka plandan dönüşteki ilk kol sesi atılırdı.
 */
export function getRunningGraph(): AudioGraph | null {
  if (!graph) return null;
  const state: string = graph.context.state;
  if (state === "running") return graph;

  const waking = state === "suspended" || state === "interrupted";
  return waking && pendingResume !== null ? graph : null;
}
