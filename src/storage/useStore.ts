import { useCallback, useEffect, useState } from "react";

import { loadStore, saveStore } from "./db";
import type { Store } from "../domain/progress";
import { storage } from "../platform";

/**
 * Açılışta depoyu okur.
 *
 * hydrated: okuma bitene kadar null, sonra diskten gelen store.
 * recovered: kayıt bozuktu ve boş store'la devam ediliyor.
 * save: debounce yok — kayıt tur sonunda bir kez çağrılıyor, tuş başına değil.
 */
export function useStore() {
  const [hydrated, setHydrated] = useState<Store | null>(null);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadStore(storage).then((result) => {
      // Bileşen sökülmüşse state'e dokunma.
      if (cancelled) return;
      setHydrated(result.store);
      setRecovered(result.recovered);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // saveStore kendi hatasını yutuyor; burada beklenecek bir şey yok.
  const save = useCallback((store: Store) => {
    void saveStore(storage, store);
  }, []);

  return { hydrated, recovered, save };
}
