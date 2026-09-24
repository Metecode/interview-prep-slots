import { useCallback, useEffect, useState } from "react";

import { loadStore, saveStore } from "./db";
import type { LoadResult } from "./db";
import type { Store } from "../domain/progress";
import { storage } from "../platform";

/*
  Açılış okuması modül seviyesinde tek söz. React StrictMode okuma efektini
  iki kez çalıştırıyor; loadStore artık yan etkili (bozuk kaydı yedekliyor,
  kurtarılanı yazıyor), iki kez çalışsaydı iki yedek ve iki yazma olurdu.
  authClient'taki bootstrap sözü de aynı sebeple modül seviyesinde.
*/
let startup: Promise<LoadResult> | null = null;

function loadOnce(): Promise<LoadResult> {
  if (startup === null) startup = loadStore(storage);
  return startup;
}

/**
 * Açılışta depoyu okur.
 *
 * loaded: okuma bitene kadar null, sonra store ve okumanın durumu.
 * save: debounce yok — kayıt tur sonunda bir kez çağrılıyor, tuş başına değil.
 */
export function useStore() {
  const [loaded, setLoaded] = useState<LoadResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadOnce().then((result) => {
      // Bileşen sökülmüşse state'e dokunma.
      if (cancelled) return;
      setLoaded(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const writable = loaded !== null && loaded.status !== "failed";

  // Okuma ya da yedekleme başarısızsa oturum boyunca diske yazılmaz:
  // altta okuyamadığımız gerçek veri olabilir. saveStore kendi hatasını
  // yutuyor; burada beklenecek bir şey yok.
  const save = useCallback(
    (store: Store) => {
      if (!writable) return;
      void saveStore(storage, store);
    },
    [writable],
  );

  return { loaded, save };
}
