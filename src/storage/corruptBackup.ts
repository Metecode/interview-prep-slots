import type { StorageAdapter } from "../platform";
import { CORRUPT_BACKUP_PREFIX, STORE_NS } from "./storeKeys";

/* ------------------------------------------------------------------ */
/* Bozuk kaydın yedeği — üzerine yazmadan önce ham hali saklanır       */
/* ------------------------------------------------------------------ */

/*
  Kurtarma bozuk kaydın bir kısmını atıyor. Atılan kısım belki elle ya da
  ileride daha iyi bir kurtarmayla geri alınabilir; bu yüzden ham kayıt
  olduğu gibi ayrı bir anahtara yazılır ve ANA ANAHTARA ANCAK BUNDAN
  SONRA dokunulur. Sınır, bozuk kayıt her açılışta yeniden yedeklenirse
  deponun şişmesini önlüyor.
*/
export const MAX_CORRUPT_BACKUPS = 3;

/**
 * Ham kaydı yedekler. false dönerse yedek yazılmadı: çağıran ana anahtara
 * yazmamalı, çünkü o zaman ham veri geri dönüşsüz kaybolur.
 */
export async function backupCorrupt(storage: StorageAdapter, raw: unknown, now: Date): Promise<boolean> {
  try {
    await storage.set(STORE_NS, `${CORRUPT_BACKUP_PREFIX}${now.toISOString()}`, raw);
  } catch (error) {
    console.error("Bozuk kayıt yedeklenemedi, bu oturumda diske yazılmayacak:", error);
    return false;
  }

  await pruneBackups(storage);
  return true;
}

/** En yeni MAX_CORRUPT_BACKUPS yedek kalır. Silme başarısızsa yedek yine yazıldı. */
async function pruneBackups(storage: StorageAdapter): Promise<void> {
  try {
    const entries = await storage.getAll<unknown>(STORE_NS);
    const backupKeys = entries
      .map((entry) => entry.key)
      .filter((key) => key.startsWith(CORRUPT_BACKUP_PREFIX))
      .sort();

    const stale = backupKeys.slice(0, Math.max(0, backupKeys.length - MAX_CORRUPT_BACKUPS));
    for (const key of stale) await storage.delete(STORE_NS, key);
  } catch (error) {
    console.error("Eski yedekler silinemedi:", error);
  }
}
