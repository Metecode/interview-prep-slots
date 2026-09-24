import { useCallback, useEffect, useState } from "react";

import { createStoreStartup } from "./storeStartup";
import type { StoreStartup } from "./storeStartup";
import type { Store } from "../domain/progress";
import { storage } from "../platform";

/*
  Uygulamanın tek açılışı. Modül seviyesinde çünkü StrictMode efekti iki
  kez çalıştırıyor ve bileşen yeniden bağlanabiliyor; tek sefer güvencesi
  hook'un ömrüne bağlı kalmamalı (authClient.bootstrap ile aynı sebep).
  Mantık storeStartup.ts'te; burası yalnızca platformun adapter'ını verir.
*/
const startOnce = createStoreStartup(storage);

/**
 * Açılışta depoyu okur.
 *
 * loaded: okuma bitene kadar null, sonra store ve okumanın durumu.
 * save: debounce yok — kayıt tur sonunda bir kez çağrılıyor, tuş başına
 * değil. Değişmeyen store'u ve yazmanın kapalı olduğu oturumu yazıcı eler.
 */
export function useStore() {
  const [started, setStarted] = useState<StoreStartup | null>(null);

  useEffect(() => {
    let cancelled = false;

    void startOnce().then((value) => {
      // Bileşen sökülmüşse state'e dokunma.
      if (cancelled) return;
      setStarted(value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const writer = started?.writer ?? null;
  // Yazıcı kendi hatasını yutuyor; burada beklenecek bir şey yok.
  const save = useCallback(
    (store: Store) => {
      if (writer) void writer.write(store);
    },
    [writer],
  );

  return { loaded: started?.result ?? null, save };
}
