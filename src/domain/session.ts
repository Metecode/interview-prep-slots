import { drawQuestion } from "./draw";
import { applyAttempt } from "./leitner";
import type { Attempt, QuestionProgress, SelfRating } from "./progress";
import type { Category, Evaluation, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Oturum — tek turun durum makinesi                                   */
/* ------------------------------------------------------------------ */

/**
 * idle      — makara duruyor, çevrilmeyi bekliyor
 * spinning  — kazanan belli, animasyon oynuyor
 * answering — soru açık, kullanıcı yazıyor
 * evaluated — geri bildirim verildi, kutu kararı bekleniyor
 */
export type Phase = "idle" | "spinning" | "answering" | "evaluated";

export type SessionState = {
  phase: Phase;
  current: Question | null;
  evaluation: Evaluation | null;
  passed: boolean;
  progress: Record<string, QuestionProgress>;
  /** Son sorulanlar, eskiden yeniye. Çekilişte soğutma için kullanılır. */
  recentIds: string[];
  activeCategories: Category[];
  quotaRemaining: number;
};

export type SessionAction =
  | { type: "TOGGLE_CATEGORY"; category: Category }
  | {
      type: "SPIN";
      questions: readonly Question[];
      now: Date;
      rng: () => number;
    }
  | { type: "SETTLE" }
  | { type: "SUBMIT"; evaluation: Evaluation }
  | { type: "PASS" }
  | { type: "RATE"; rating: SelfRating; answer: string; now: Date }
  | { type: "SPEND_QUOTA" };

/** Geçmişte tutulan soru sayısı. Soğutma penceresinden geniş olmalı. */
export const MAX_RECENT_IDS = 10;

export function initialSessionState(): SessionState {
  return {
    phase: "idle",
    current: null,
    evaluation: null,
    passed: false,
    progress: {},
    recentIds: [],
    activeCategories: [],
    // AI isteğe bağlı yol; kota dışarıdan yüklenene kadar kapalı.
    quotaRemaining: 0,
  };
}

/** İlk kez cevaplanan soru kutu 1'den başlar. */
function newProgress(questionId: string, at: string): QuestionProgress {
  return { questionId, box: 1, lastSeenAt: at, attempts: [] };
}

/**
 * Saf reducer: değerlendirme dışarıdan gelir, burada hesaplanmaz.
 * Geçersiz eylem hata fırlatmaz — aynı state nesnesi döner ki
 * React gereksiz render etmesin.
 */
export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "TOGGLE_CATEGORY": {
      // Makara dönerken filtre değişirse ekrandaki kazanan havuz dışı kalır.
      if (state.phase === "spinning") return state;

      const isActive = state.activeCategories.includes(action.category);
      return {
        ...state,
        activeCategories: isActive
          ? state.activeCategories.filter((c) => c !== action.category)
          : [...state.activeCategories, action.category],
      };
    }

    case "SPIN": {
      // Cevap yazılırken çevirmek yazılanı sessizce siler.
      if (state.phase !== "idle" && state.phase !== "evaluated") return state;

      const next = drawQuestion({
        questions: action.questions,
        progress: state.progress,
        activeCategories: state.activeCategories,
        recentIds: state.recentIds,
        now: action.now,
        rng: action.rng,
      });

      // Havuz boş ya da hiçbir kategori eşleşmedi: makara boşa dönmesin.
      if (!next) return state;

      return {
        ...state,
        phase: "spinning",
        current: next,
        evaluation: null,
        passed: false,
      };
    }

    case "SETTLE": {
      // Animasyonun bittiğini yalnızca dönen makara bildirebilir.
      if (state.phase !== "spinning") return state;
      return { ...state, phase: "answering" };
    }

    case "SUBMIT": {
      if (state.phase !== "answering") return state;
      return { ...state, phase: "evaluated", evaluation: action.evaluation };
    }

    case "PASS": {
      if (state.phase !== "answering") return state;
      // Pas geçildi: gösterilecek değerlendirme yok, model cevabı yeter.
      return { ...state, phase: "evaluated", evaluation: null, passed: true };
    }

    case "RATE": {
      if (state.phase !== "evaluated" || !state.current) return state;

      const question = state.current;
      const attempt: Attempt = {
        at: action.now.toISOString(),
        answer: action.answer,
        hitCount: state.evaluation?.hits.length ?? 0,
        // Kavram sayısı sorunun kendisinden gelir; değerlendirme atlanmış olabilir.
        totalConcepts: question.keyConcepts.length,
        // Pas geçildiyse verilen rating yok sayılır. Geçmişte de "bilmiyordum"
        // olarak durur, yoksa kutu 1 ile kayıt birbirini tutmaz.
        selfRating: state.passed ? 0 : action.rating,
        passed: state.passed,
      };

      const existing =
        state.progress[question.id] ?? newProgress(question.id, attempt.at);

      return {
        ...state,
        phase: "idle",
        progress: {
          ...state.progress,
          [question.id]: applyAttempt(existing, attempt),
        },
        // En eskisi baştan düşer, sıra eskiden yeniye korunur.
        recentIds: [...state.recentIds, question.id].slice(-MAX_RECENT_IDS),
      };
    }

    case "SPEND_QUOTA": {
      // Pas geçilen soruya AI harcanmaz; kota kullanıcının cebinden çıkar.
      if (state.quotaRemaining <= 0 || state.passed) return state;
      return { ...state, quotaRemaining: state.quotaRemaining - 1 };
    }

    default:
      return state;
  }
}
