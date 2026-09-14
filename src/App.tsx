import { useEffect, useReducer, useRef, useState } from "react";

import styles from "./App.module.css";
import { CategoryPicker } from "./components/CategoryPicker";
import { Machine } from "./components/Machine";
import { QuestionCard } from "./components/QuestionCard";
import { ResultPanel } from "./components/ResultPanel";
import { evaluateLexical } from "./domain/evaluate";
import { embeddingClient } from "./embedding/client";
import { evaluateSemanticAnswer } from "./embedding/semanticEvaluate";
import { useEmbeddingStatus } from "./embedding/useEmbeddingStatus";
import { initialSessionState, sessionReducer, toStore } from "./domain/session";
import type { SessionState } from "./domain/session";
import { useStore } from "./storage/useStore";
import type { SelfRating, Store } from "./domain/progress";
import type { Category, Question } from "./domain/question";

/* ------------------------------------------------------------------ */
/* GEÇİCİ deneme sayfası — kart eklenene kadar yalnızca makine ve       */
/* konsola düşen faz değişimi var.                                     */
/* ------------------------------------------------------------------ */

const TEMP_QUESTIONS: Question[] = [
  {
    id: "sql-index-nedir",
    category: "sql",
    topic: "Index",
    difficulty: 1,
    prompt: "Bir veritabanı index'i nedir ve sorgu performansını nasıl etkiler?",
    modelAnswer:
      "Index, tabloya ek bir arama yapısı ekleyerek WHERE ve JOIN sorgularının tam tablo taraması yapmadan ilgili satırlara hızlıca ulaşmasını sağlar.",
    keyConcepts: [
      {
        id: "b-tree",
        label: "B-Tree yapısı",
        aliases: ["b-tree", "b agaci", "btree"],
        anchors: ["Çoğu index B-Tree ağacı üzerinde sıralı olarak tutulur."],
      },
      {
        id: "arama-hizi",
        label: "Arama hızını artırır",
        aliases: ["hizli arama", "performans"],
        anchors: ["Index olmadan veritabanı tüm satırları taramak zorunda kalır."],
      },
    ],
  },
  {
    id: "react-usememo-ne-zaman",
    category: "react",
    topic: "Memo",
    difficulty: 2,
    prompt: "useMemo ne zaman kullanılır, ne zaman gereksizdir?",
    modelAnswer:
      "useMemo, pahalı bir hesaplamanın her render'da tekrar çalışmasını önlemek için bağımlılıklar değişmediği sürece sonucu önbellekler; ucuz hesaplamalarda gereksiz karmaşıklık katar.",
    keyConcepts: [
      {
        id: "pahali-hesap",
        label: "Pahalı hesaplama önbellekleme",
        aliases: ["memoization", "onbellek", "cache"],
        anchors: ["useMemo yalnızca maliyetli hesaplamaları önbelleğe almak için anlamlıdır."],
      },
      {
        id: "bagimlilik-dizisi",
        label: "Bağımlılık dizisi",
        aliases: ["dependency array", "deps"],
        anchors: ["Bağımlılık dizisindeki değerler değişmedikçe eski sonuç döner."],
      },
    ],
  },
  {
    id: "koleksiyon-hashmap-vs-treemap",
    category: "koleksiyonlar",
    topic: "HashMap",
    difficulty: 2,
    prompt: "HashMap ile TreeMap arasındaki temel fark nedir?",
    modelAnswer:
      "HashMap sabit zamanlı erişim sağlar ama sırasızdır; TreeMap anahtarları sıralı tutar, erişim ve ekleme log(n) zaman alır.",
    keyConcepts: [
      {
        id: "siralama",
        label: "Sıralı anahtar tutma",
        aliases: ["sirali", "ordered"],
        anchors: ["TreeMap anahtarları doğal sıraya ya da comparator'a göre tutar."],
      },
      {
        id: "zaman-karmasikligi",
        label: "Zaman karmaşıklığı farkı",
        aliases: ["o(1)", "o(log n)", "zaman karmasikligi"],
        anchors: ["HashMap ortalama O(1), TreeMap O(log n) zaman karmaşıklığına sahiptir."],
      },
    ],
  },
  {
    id: "kafka-partition-nedir",
    category: "kafka-redis",
    topic: "Partition",
    difficulty: 3,
    prompt: "Kafka'da partition kavramı neden vardır ve paralelliği nasıl etkiler?",
    modelAnswer:
      "Bir topic birden fazla partition'a bölünerek farklı consumer'ların paralel okuma yapmasına izin verir; partition sayısı paralellik üst sınırını belirler.",
    keyConcepts: [
      {
        id: "paralel-tuketim",
        label: "Paralel tüketim",
        aliases: ["paralellik", "concurrent consumer"],
        anchors: ["Partition sayısı kadar consumer paralel olarak mesaj tüketebilir."],
      },
      {
        id: "sira-garantisi",
        label: "Partition içi sıra garantisi",
        aliases: ["mesaj sirasi", "ordering"],
        anchors: ["Mesaj sırası yalnızca aynı partition içinde garanti edilir."],
      },
    ],
  },
];

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
  const [semanticEnabled, setSemanticEnabled] = useState(store.settings.semanticEnabled);
  const [lastAnswer, setLastAnswer] = useState("");
  const [warningDismissed, setWarningDismissed] = useState(false);
  const prevPhaseRef = useRef(state.phase);
  const embeddingStatus = useEmbeddingStatus();

  // Kaydı RATE'i kovalayarak değil, ilerleme ve ayar değişimini izleyerek
  // yapıyoruz: hangi eylemin yazdırdığını bilmek gerekmiyor.
  const { progress, activeCategories } = state;
  useEffect(() => {
    save(toStore({ progress, activeCategories }, { fastMode, semanticEnabled }));
  }, [progress, activeCategories, fastMode, semanticEnabled, save]);

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
    dispatch({ type: "SPIN", questions: TEMP_QUESTIONS, now: new Date(), rng: Math.random });
  }

  function handleSettle() {
    dispatch({ type: "SETTLE" });
  }

  /**
   * "Daha iyi değerlendirme" kapalıysa ya da model henüz hazır değilse
   * doğrudan lexical'a gidilir — model hazır değilken yükleme burada
   * arka planda tetiklenir, bu turu beklettirmeden. Hazırsa embedding
   * denenir; herhangi bir adım başarısız olursa yine lexical'a düşülür.
   */
  function handleSubmit(answer: string) {
    if (!state.current) return;
    const question = state.current;
    // RATE denemeyi kaydederken cevabı istiyor; kart o an sökülmüş olacak.
    setLastAnswer(answer);

    if (!semanticEnabled || embeddingStatus.state !== "ready") {
      if (semanticEnabled) embeddingClient.preload();
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
        allQuestions={TEMP_QUESTIONS}
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

      {/* Makineye ait bir ayar, soruya değil: yeri makinenin hemen altı. */}
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
          checked={semanticEnabled}
          onChange={(e) => setSemanticEnabled(e.target.checked)}
        />
        Daha iyi değerlendirme (bir kez ~50 MB indirir)
      </label>

      {/* Yükleme engelleyici değil: kart açıkken de görünebilir, kullanıcı
          bu sırada lexical sonuçla devam eder. */}
      {semanticEnabled && embeddingStatus.state === "loading" && (
        <div className={styles.embeddingProgress}>
          <progress value={embeddingStatus.loaded} max={Math.max(embeddingStatus.total, 1)} />
          <span>Model indiriliyor…</span>
        </div>
      )}

      {semanticEnabled && embeddingStatus.state === "error" && (
        <p className={styles.embeddingError}>
          Model yüklenemedi, kelime eşleşmesi kullanılıyor.
        </p>
      )}

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
