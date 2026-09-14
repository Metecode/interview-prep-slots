import { useEffect, useReducer, useRef, useState } from "react";

import styles from "./App.module.css";
import { CategoryPicker } from "./components/CategoryPicker";
import { Machine } from "./components/Machine";
import { QuestionCard } from "./components/QuestionCard";
import { ResultPanel } from "./components/ResultPanel";
import { QUESTIONS } from "./content";
import { evaluateLexical } from "./domain/evaluate";
import { embeddingClient, shouldAutoDownloadModel } from "./embedding/client";
import { evaluateSemanticAnswer } from "./embedding/semanticEvaluate";
import { useEmbeddingStatus } from "./embedding/useEmbeddingStatus";
import { initialSessionState, sessionReducer, toStore } from "./domain/session";
import type { SessionState } from "./domain/session";
import { useStore } from "./storage/useStore";
import type { SelfRating, Store } from "./domain/progress";
import type { Category } from "./domain/question";

/**
 * İlk state, diskten geleni HYDRATE ile uygulayarak kurulur.
 * HYDRATE'i efektte dispatch etmek yerine burada uygulamak sıralama
 * sorununu tamamen kaldırıyor: efekt sırası yüzünden kayıt, hidrasyondan
 * önceki boş state'i diske basamıyor.
 *
 * İlk açılışta (initialized false) hangi kategorilerin açık geleceğine
 * reducer kendisi karar veriyor — bkz. session.ts HYDRATE dalı.
 */
function initState(store: Store): SessionState {
  const base: SessionState = {
    ...initialSessionState(),
    // GEÇİCİ: kota gerçekte dışarıdan yüklenecek. Sıfır kalırsa yapay zekâ
    // düğmesinin açık hali denenemiyor.
    quotaRemaining: 3,
  };

  return sessionReducer(base, {
    type: "HYDRATE",
    progress: store.progress,
    settings: store.settings,
  });
}

export default function App() {
  const { hydrated, recovered, save } = useStore();

  // Depo okunmadan oturum kurulmuyor; okuma IndexedDB'den, göz kırpması kadar.
  if (!hydrated) {
    return (
      <main className={styles.app}>
        <h1 className={styles.title}>Mülakat Slot — makine denemesi</h1>
      </main>
    );
  }

  return <Session store={hydrated} recovered={recovered} save={save} />;
}

type SessionProps = {
  store: Store;
  recovered: boolean;
  save: (store: Store) => void;
};

function Session({ store, recovered, save }: SessionProps) {
  const [state, dispatch] = useReducer(sessionReducer, store, initState);
  const [spinKey, setSpinKey] = useState(0);
  const [fastMode, setFastMode] = useState(store.settings.fastMode);
  const [disableModelDownload, setDisableModelDownload] = useState(
    store.settings.disableModelDownload,
  );
  const [lastAnswer, setLastAnswer] = useState("");
  const [warningDismissed, setWarningDismissed] = useState(false);
  const prevPhaseRef = useRef(state.phase);
  // İlk çekilişte indirme yalnızca bir kez tetiklenir; sonraki çekilişler
  // ayar değişse bile bunu tekrar sormaz.
  const hasTriggeredDownloadRef = useRef(false);
  const embeddingStatus = useEmbeddingStatus();

  // Kaydı RATE'i kovalayarak değil, ilerleme ve ayar değişimini izleyerek
  // yapıyoruz: hangi eylemin yazdırdığını bilmek gerekmiyor.
  const { progress, activeCategories } = state;
  useEffect(() => {
    save(toStore({ progress, activeCategories }, { fastMode, disableModelDownload }));
  }, [progress, activeCategories, fastMode, disableModelDownload, save]);

  // spinKey yalnızca gerçek bir dönüş başladığında artar — çekiliş havuzu
  // boşsa reducer state'i değiştirmez, Machine'e anlamsız bir dönüş gitmez.
  useEffect(() => {
    if (state.phase === "spinning" && prevPhaseRef.current !== "spinning") {
      setSpinKey((key) => key + 1);
    }
    prevPhaseRef.current = state.phase;

    console.log("faz ->", state.phase, state.current?.id ?? null);
  }, [state]);

  /**
   * Model indirme yalnızca ilk çekilişte, sessizce tetiklenir — kullanıcı
   * bir şey işaretlemek zorunda kalmaz. Ayarlardan kapatılmışsa ya da ağ
   * buna uygun değilse (veri tasarrufu, yavaş bağlantı) hiç denenmez.
   */
  function handlePull() {
    if (!hasTriggeredDownloadRef.current) {
      hasTriggeredDownloadRef.current = true;
      if (shouldAutoDownloadModel(disableModelDownload)) embeddingClient.preload();
    }
    dispatch({ type: "SPIN", questions: QUESTIONS, now: new Date(), rng: Math.random });
  }

  function handleSettle() {
    dispatch({ type: "SETTLE" });
  }

  /**
   * Model hazır değilse doğrudan lexical'a gidilir — burada yeniden
   * indirme denenmez, bu yalnızca ilk çekilişin işi. Hazırsa embedding
   * denenir; herhangi bir adım başarısız olursa yine lexical'a düşülür.
   */
  function handleSubmit(answer: string) {
    if (!state.current) return;
    const question = state.current;
    // RATE denemeyi kaydederken cevabı istiyor; kart o an sökülmüş olacak.
    setLastAnswer(answer);

    if (embeddingStatus.state !== "ready") {
      dispatch({ type: "SUBMIT", evaluation: evaluateLexical(question, answer) });
      return;
    }

    evaluateSemanticAnswer(question, answer).then((evaluation) => {
      dispatch({ type: "SUBMIT", evaluation: evaluation ?? evaluateLexical(question, answer) });
    });
  }

  function handlePass() {
    setLastAnswer("");
    dispatch({ type: "PASS" });
  }

  function handleRate(rating: SelfRating) {
    dispatch({ type: "RATE", rating, answer: lastAnswer, now: new Date() });
  }

  function handleAskAi() {
    dispatch({ type: "SPEND_QUOTA" });
    console.log("yapay zekâ turu henüz bağlı değil");
  }

  function handleToggleCategory(category: Category) {
    dispatch({ type: "TOGGLE_CATEGORY", category });
  }

  const canSpin =
    (state.phase === "idle" || state.phase === "evaluated") &&
    state.activeCategories.length > 0;

  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Mülakat Slot — makine denemesi</h1>

      <CategoryPicker
        active={state.activeCategories}
        disabled={state.phase === "spinning"}
        onToggle={handleToggleCategory}
      />

      <Machine
        question={state.current}
        allQuestions={QUESTIONS}
        activeCategories={state.activeCategories}
        spinKey={spinKey}
        spinning={state.phase === "spinning"}
        canSpin={canSpin}
        quotaRemaining={state.quotaRemaining}
        fastMode={fastMode}
        onPull={handlePull}
        onSettle={handleSettle}
      />

      {/* Kol zaten disabled ama sebebi görünmüyor; yalnızca seçim boşken çıkar. */}
      {state.activeCategories.length === 0 && (
        <p className={styles.spinHint}>Çevirmek için en az bir kategori seç.</p>
      )}

      {/* Makineye ait ayarlar, soruya değil: yeri makinenin hemen altı.
          Varsayılan kapalı — kimse ayar aramak zorunda kalmasın. */}
      <details className={styles.settings}>
        <summary>Ayarlar</summary>

        <label className={styles.controls}>
          <input
            type="checkbox"
            checked={fastMode}
            onChange={(e) => setFastMode(e.target.checked)}
          />
          Hızlı mod
        </label>

        <label className={styles.controls}>
          <input
            type="checkbox"
            checked={!disableModelDownload}
            onChange={(e) => setDisableModelDownload(!e.target.checked)}
          />
          Gelişmiş değerlendirme modelini indirme (~50 MB)
        </label>
      </details>

      {recovered && !warningDismissed && (
        <div className={styles.warning} role="alert">
          <span>Kayıtlı ilerlemen okunamadı, sıfırdan başlıyorsun.</span>
          <button
            type="button"
            className={styles.warningClose}
            onClick={() => setWarningDismissed(true)}
            aria-label="Uyarıyı kapat"
          >
            ×
          </button>
        </div>
      )}

      {/* key: soru değişince kart yeniden kurulur, yazılan cevap temizlenir. */}
      {state.phase === "answering" && state.current && (
        <QuestionCard
          key={state.current.id}
          question={state.current}
          onSubmit={handleSubmit}
          onPass={handlePass}
        />
      )}

      {state.phase === "evaluated" && state.current && (
        <ResultPanel
          question={state.current}
          evaluation={state.evaluation}
          quotaRemaining={state.quotaRemaining}
          onRate={handleRate}
          onAskAi={handleAskAi}
        />
      )}
    </main>
  );
}
