import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import styles from "./App.module.css";
import { useAuth } from "./auth/useAuth";
import { CategoryPicker } from "./components/CategoryPicker";
import { ChevronIcon } from "./components/ChevronIcon";
import { Collapse } from "./components/Collapse";
import { Footer } from "./components/Footer";
import { Machine } from "./components/Machine";
import { Stage } from "./components/Stage";
import { StepIndicator } from "./components/StepIndicator";
import { Switch } from "./components/Switch";
import { TopBar } from "./components/TopBar";
import { QUESTIONS } from "./content";
import { evaluateLexical } from "./domain/evaluate";
import { initialSessionState, sessionReducer, toStore } from "./domain/session";
import type { SessionState } from "./domain/session";
import { useStore } from "./storage/useStore";
import { useProgressSync } from "./sync/useProgressSync";
import type { ProgressMap } from "./sync/progressSync";
import type { SelfRating, Store } from "./domain/progress";
import { CATEGORIES } from "./domain/question";
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
  // O aralıkta boş bir kabuk duruyor: yarım bir arayüz çizip hemen
  // değiştirmektense hiç çizmemek daha sakin.
  if (!hydrated) {
    return (
      <div className={styles.root}>
        <main className={styles.app}>
          <p className={styles.loadingText} role="status">
            Yükleniyor…
          </p>
        </main>
      </div>
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

  // Sunucu ikinci kopya: senkron oturuma yazar, diske yazmayı yukarıdaki
  // efekt zaten üstleniyor. Doğrudan IndexedDB'ye yazsaydı bu efekt bir
  // sonraki render'da onu bellekteki eski haliyle ezerdi.
  const { status, user } = useAuth();
  const handleMerged = useCallback((merged: ProgressMap) => {
    dispatch({ type: "SYNC_PROGRESS", progress: merged });
  }, []);
  const { pushQuestion } = useProgressSync({
    progress,
    // Misafirde null: senkron modülü hiç istek atmaz.
    userId: status === "authenticated" && user ? user.id : null,
    onMerged: handleMerged,
  });

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
    // Soru id'si dispatch'ten önce alınır: RATE turu kapatınca current null olur.
    if (state.current) pushQuestion(state.current.id);
    dispatch({ type: "RATE", rating, answer: lastAnswer, now: new Date() });
  }

  function handleAskAi() {
    dispatch({ type: "SPEND_QUOTA" });
  }

  function handleToggleCategory(category: Category) {
    dispatch({ type: "TOGGLE_CATEGORY", category });
  }

  function handleToggleAllCategories() {
    const allSelected = state.activeCategories.length === CATEGORIES.length;
    dispatch({ type: "SET_CATEGORIES", categories: allSelected ? [] : [...CATEGORIES] });
  }

  const canSpin =
    (state.phase === "idle" || state.phase === "evaluated") &&
    state.activeCategories.length > 0;

  return (
    <div className={styles.root}>
      <TopBar questionCount={activeQuestionCount} quotaRemaining={state.quotaRemaining} />
      {/* Adım göstergesi üst çubuğun altında, ince bir ayırıcıyla. */}
      <StepIndicator phase={state.phase} />

      <main className={styles.shell}>
        <div className={styles.app}>
          <CategoryPicker
            active={state.activeCategories}
            disabled={state.phase === "spinning"}
            onToggle={handleToggleCategory}
            onToggleAll={handleToggleAllCategories}
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
              aria-controls="settings-panel"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              Ayarlar
              <ChevronIcon className={styles.chevron} />
            </button>

            <Collapse open={settingsOpen} id="settings-panel">
              <div className={styles.controls}>
                <Switch checked={fastMode} onChange={setFastMode} label="Hızlı mod" />
              </div>
            </Collapse>
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
        </div>

        {/* Soru kartı ve sonuç ekranı burada; geçişi Stage yönetiyor. */}
        <Stage
          state={state}
          onSubmit={handleSubmit}
          onPass={handlePass}
          onRate={handleRate}
          onAskAi={handleAskAi}
        />
      </main>

      <Footer />
    </div>
  );
}
