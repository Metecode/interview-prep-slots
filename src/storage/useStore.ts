import { useCallback, useEffect, useState } from "react";

import { loadStore } from "./db";
import type { LoadResult } from "./db";
import { createStoreWriter } from "./storeWriter";
import type { StoreWriter } from "./storeWriter";
import type { Store } from "../domain/progress";
import { storage } from "../platform";

/*
  Açılış okuması modül seviyesinde tek söz. React StrictMode okuma efektini
  iki kez çalıştırıyor; loadStore yan etkili (bozuk kaydı yedekliyor,
  kurtarılanı yazıyor), iki kez çalışsaydı iki yedek ve iki yazma olurdu.
  authClient'taki bootstrap sözü de aynı sebeple modül seviyesinde.

  Yazıcı da okumanın sonucuyla birlikte bir kez kurulur: yazmanın açık
  olup olmadığı ve "son yazılan" karşılaştırması oturum boyunca tek.
*/
type Startup = { result: LoadResult; writer: StoreWriter };

let startup: Promise<Startup> | null = null;

function startOnce(): Promise<Startup> {
  if (startup === null) {
    startup = loadStore(storage).then((result) => ({
      result,
      writer: createStoreWriter(storage, { enabled: result.status !== "failed" }),
    }));
  }
  return startup;
}

/**
 * Açılışta depoyu okur.
 *
 * loaded: okuma bitene kadar null, sonra store ve okumanın durumu.
 * save: debounce yok — kayıt tur sonunda bir kez çağrılıyor, tuş başına
 * değil. Değişmeyen store'u ve yazmanın kapalı olduğu oturumu yazıcı eler.
 */
export function useStore() {
  const [started, setStarted] = useState<Startup | null>(null);

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
