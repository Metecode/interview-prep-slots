/* ------------------------------------------------------------------ */
/* Kalıcı depolama isteği                                              */
/* ------------------------------------------------------------------ */

/*
  Tarayıcı, disk daraldığında "en iyi çaba" depolamayı sormadan silebilir;
  Safari ayrıca uzun süre açılmayan sitenin verisini temizliyor. Kalıcı
  depolama bunu engeller. Tarayıcı isteği sessizce reddedebilir (Chrome
  site etkileşimine, kuruluma bakıyor); sonuç yalnızca loglanır,
  kullanıcıya gösterilmez. Hata fırlatmaz: uygulama bunu beklemeden açılır.
*/

type StorageManagerLike = Pick<StorageManager, "persist" | "persisted">;

export async function requestPersistentStorage(
  storageManager: StorageManagerLike | undefined = globalThis.navigator?.storage,
): Promise<void> {
  if (!storageManager?.persist || !storageManager.persisted) {
    console.info("Kalıcı depolama desteklenmiyor.");
    return;
  }

  try {
    if (await storageManager.persisted()) {
      console.info("Depolama zaten kalıcı.");
      return;
    }
    const granted = await storageManager.persist();
    console.info(granted ? "Kalıcı depolama verildi." : "Kalıcı depolama verilmedi.");
  } catch (error) {
    console.warn("Kalıcı depolama istenemedi:", error);
  }
}
