import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import styles from "./App.module.css";
import { CategoryPicker } from "./components/CategoryPicker";
import { ChevronIcon } from "./components/ChevronIcon";
import { Footer } from "./components/Footer";
import { Machine } from "./components/Machine";
import { QuestionCard } from "./components/QuestionCard";
import { ResultPanel } from "./components/ResultPanel";
import { Switch } from "./components/Switch";
import { TopBar } from "./components/TopBar";
import { QUESTIONS } from "./content";
import { evaluateLexical } from "./domain/evaluate";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [warningDismissed, setWarningDismissed] = useState(false);
  const prevPhaseRef = useRef(state.phase);

  // Kaydı RATE'i kovalayarak değil, ilerleme ve ayar değişimini izleyerek
  // yapıyoruz: hangi eylemin yazdırdığını bilmek gerekmiyor.
  const { progress, activeCategories } = state;
  useEffect(() => {
    save(toStore({ progress, activeCategories }, { fastMode }));
  }, [progress, activeCategories, fastMode, save]);

  // TopBar'daki havuz bilgisi: aktif kategorilerdeki soru sayısı.
  const activeQuestionCount = useMemo(
    () => QUESTIONS.filter((q) => activeCategories.includes(q.category)).length,
    [activeCategories],
  );

  // spinKey yalnızca gerçek bir dönüş başladığında artar — çekiliş havuzu
  // boşsa reducer state'i değiştirmez, Machine'e anlamsız bir dönüş gitmez.
  useEffect(() => {
    if (state.phase === "spinning" && prevPhaseRef.current !== "spinning") {
      setSpinKey((key) => key + 1);
    }
    prevPhaseRef.current = state.phase;

    console.log("faz ->", state.phase, state.current?.id ?? null);
  }, [state]);

  function handlePull() {
    dispatch({ type: "SPIN", questions: QUESTIONS, now: new Date(), rng: Math.random });
  }

  function handleSettle() {
    dispatch({ type: "SETTLE" });
  }

  function handleSubmit(answer: string) {
    if (!state.current) return;
    const question = state.current;
    // RATE denemeyi kaydederken cevabı istiyor; kart o an sökülmüş olacak.
    setLastAnswer(answer);
    dispatch({ type: "SUBMIT", evaluation: evaluateLexical(question, answer) });
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
    <>
      <TopBar questionCount={activeQuestionCount} quotaRemaining={state.quotaRemaining} />

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
        <div className={styles.settings}>
          <button
            type="button"
            className={styles.settingsToggle}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            Ayarlar
            <ChevronIcon className={styles.chevron} />
          </button>

          {settingsOpen && (
            <div className={styles.controls}>
              <Switch checked={fastMode} onChange={setFastMode} label="Hızlı mod" />
            </div>
          )}
        </div>

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

      <Footer />
    </>
  );
}
