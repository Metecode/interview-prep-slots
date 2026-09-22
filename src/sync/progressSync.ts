import { apiFetch, getSnapshot } from "../auth/authClient";
import { questionProgressSchema } from "../domain/progress";
import type { QuestionProgress } from "../domain/progress";

/* ------------------------------------------------------------------ */
/* İlerleme senkronu — React bilmez, saf modül                         */
/* ------------------------------------------------------------------ */

/*
  Birincil depo IndexedDB, sunucu ikinci kopya. Buradaki her istek
  başarısız olabilir ve olduğunda hiçbir şey yapılmaz: yerel veri zaten
  yazıldı, bir sonraki senkronda lastSeenAt karşılaştırması onu yakalar.
  Bu yüzden kuyruk tutulmuyor — tutulsaydı çevrimdışı bir kullanıcının
  kuyruğu sınırsız büyür ve hangisinin gerçekten gittiğini bilmek için
  ikinci bir defter gerekirdi.
*/

const PROGRESS_URL = "/api/progress";
const MERGE_URL = "/api/progress/merge";

/** Soru id'sinden ilerlemesine; state ve depo ile aynı şekil. */
export type ProgressMap = Record<string, QuestionProgress>;

/* ------------------------------------------------------------------ */
/* Senkron durumu — arayüzde küçük bir göstergeye bakar                */
/* ------------------------------------------------------------------ */

/**
 * "error" bir hata ekranı değil: yerel veri zaten yazıldı, bir sonraki
 * tetik yakalar. Gösterge yalnızca "sunucudaki kopya şu an geride"
 * demek için var. Misafirde hiç istek atılmadığı için durum hep "idle".
 */
export type SyncStatus = "idle" | "syncing" | "error";

const syncListeners = new Set<() => void>();
let pendingRequests = 0;
let lastFailed = false;

export function subscribeSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/** Değer ilkel; useSyncExternalStore için kimlik derdi yok. */
export function getSyncStatus(): SyncStatus {
  if (pendingRequests > 0) return "syncing";
  return lastFailed ? "error" : "idle";
}

function publishSync(): void {
  for (const listener of syncListeners) listener();
}

/*
  Birleştirmenin hangi kullanıcı için çalıştığı. Tek istek güvencesi burada,
  çağıran tarafta değil: React StrictMode efektleri iki kez çalıştırıyor ve
  bileşen yeniden bağlanabiliyor — authClient'taki bootstrap sözü de aynı
  sebeple modül seviyesinde duruyor.
*/
let mergedUserId: string | null = null;

/**
 * Girişten sonra bir kez: yereldeki her şey gönderilir, sunucu iki yönlü
 * birleştirip tam sonucu döner. Dönen harita çağıranın yerele yazacağı
 * şeydir; null dönerse yerel veriye DOKUNULMAZ.
 */
export async function syncAfterLogin(local: ProgressMap): Promise<ProgressMap | null> {
  const { status, user } = getSnapshot();
  // Misafirde hiç istek atılmaz: senkron yalnızca hesabı olanın işi.
  if (status !== "authenticated" || !user) return null;
  if (mergedUserId === user.id) return null;
  mergedUserId = user.id;

  const body = await send("POST", MERGE_URL, Object.values(local));
  if (body === null) {
    // Başarısız birleştirme kapıyı kilitli bırakmasın; bir sonraki tetik
    // tekrar denesin. Yerel veriye dokunulmadı, kaybolan bir şey yok.
    mergedUserId = null;
    return null;
  }

  const merged = toProgressMap(body);
  if (merged === null) return null;

  // Sunucu tanımadığı questionId'leri atlıyor — içerik sürümleri arasında
  // fark olabilir. Dönen listeyi olduğu gibi yazsaydık o sorulara ait yerel
  // ilerleme silinirdi. Sunucunun bildiği her kayıt zaten yanıtta olduğu
  // için üstte o kazanır; yalnızca bilmedikleri yerelden korunur.
  return { ...local, ...merged };
}

/** Çıkışta çağrılır: bir sonraki giriş yeniden birleştirmeli. */
export function resetSync(): void {
  mergedUserId = null;
  // Çıkan kullanıcının başarısız senkronu yeni oturumda asılı kalmasın.
  lastFailed = false;
  publishSync();
}

/**
 * Yalnızca belirtilen soruların ilerlemesini gönderir — kısmi liste,
 * tam değişim değil. Sunucu her kayıt için daha yeni lastSeenAt'i alır.
 */
export async function pushChanges(progress: ProgressMap, questionIds: readonly string[]): Promise<void> {
  if (getSnapshot().status !== "authenticated") return;

  // Henüz hiç cevaplanmamış bir soru istenmiş olabilir; gönderecek kaydı yok.
  const records = questionIds.map((id) => progress[id]).filter((record) => record !== undefined);
  if (records.length === 0) return;

  await send("PUT", PROGRESS_URL, records);
}

/* ------------------------------------------------------------------ */
/* İç yardımcılar                                                      */
/* ------------------------------------------------------------------ */

/** Başarısızlıkta null döner ve sessiz kalır; çağıranın yapacağı bir şey yok. */
async function send(
  method: "PUT" | "POST",
  url: string,
  records: QuestionProgress[],
): Promise<unknown | null> {
  pendingRequests += 1;
  publishSync();

  try {
    const response = await apiFetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      console.warn(`İlerleme senkronu başarısız (${url}):`, response.status);
      lastFailed = true;
      return null;
    }

    const body = await response.json();
    lastFailed = false;
    return body;
  } catch (error) {
    console.warn(`İlerleme senkronu gönderilemedi (${url}):`, error);
    lastFailed = true;
    return null;
  } finally {
    pendingRequests -= 1;
    publishSync();
  }
}

/**
 * Sunucudan gelen listeyi haritaya çevirir. Kayıt bazında doğrulanıyor:
 * içerik sürümleri arasında fark olabilir, tanımadığımız tek bir kayıt
 * yüzünden kullanıcının tüm ilerlemesini çöpe atmak istemiyoruz.
 */
function toProgressMap(raw: unknown): ProgressMap | null {
  if (!Array.isArray(raw)) {
    console.warn("Birleşmiş ilerleme dizi değil, yerel veri korunuyor.");
    return null;
  }

  const merged: ProgressMap = {};
  for (const item of raw) {
    const parsed = questionProgressSchema.safeParse(item);
    if (!parsed.success) {
      console.warn("Sunucudan gelen ilerleme kaydı şemaya uymuyor, atlandı:", parsed.error.issues);
      continue;
    }
    merged[parsed.data.questionId] = parsed.data;
  }
  return merged;
}
