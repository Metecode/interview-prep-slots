import type { ReactNode } from "react";

import { QuestionCard } from "./QuestionCard";
import { ResultPanel } from "./result/ResultPanel";
import { useExitTransition } from "../hooks/useExitTransition";
import type { SessionState } from "../domain/session";
import type { QuestionProgress, SelfRating } from "../domain/progress";
import type { Evaluation, Question } from "../domain/question";
import styles from "./Stage.module.css";

/* ------------------------------------------------------------------ */
/* Sahne — soru kartı ve sonuç ekranı aynı hücreyi paylaşır            */
/*                                                                     */
/* İki ekran üst üste değil yan yana render edilseydi, geçiş sırasında  */
/* çıkan içerik gireni aşağı iterdi. Aynı grid hücresinde durunca       */
/* çakışma düzeni bozmuyor.                                             */
/* ------------------------------------------------------------------ */

/**
 * Ekranda ne olduğunun anlık görüntüsü. Çıkış animasyonu sürerken eski
 * ekran bu nesneden çiziliyor: tur kapanınca state'teki soru null'a
 * dönüyor, sönmekte olan panelin gösterecek bir şeyi kalmıyordu.
 */
type StageItem =
  | { kind: "question"; question: Question; progress: QuestionProgress | null }
  | {
      kind: "result";
      question: Question;
      evaluation: Evaluation | null;
      progress: QuestionProgress | null;
    };

function stageOf(state: SessionState): StageItem | null {
  if (!state.current) return null;
  if (state.phase === "answering") {
    return {
      kind: "question",
      question: state.current,
      progress: state.progress[state.current.id] ?? null,
    };
  }
  if (state.phase === "evaluated") {
    return {
      kind: "result",
      question: state.current,
      evaluation: state.evaluation,
      progress: state.progress[state.current.id] ?? null,
    };
  }
  return null;
}

/** Sahnenin kimliği: bu değişince geçiş başlar. */
function stageKey(stage: StageItem | null): string {
  return stage ? `${stage.kind}:${stage.question.id}` : "none";
}

/** Stage.module.css'teki çıkış süresiyle (--dur-base) aynı olmalı. */
const EXIT_MS = 240;

export type StageProps = {
  state: SessionState;
  onSubmit: (answer: string) => void;
  onPass: () => void;
  onRate: (rating: SelfRating) => void;
  onAskAi: () => void;
};

export function Stage({ state, onSubmit, onPass, onRate, onAskAi }: StageProps) {
  const stage = stageOf(state);
  const key = stageKey(stage);
  const exiting = useExitTransition(key, stage, EXIT_MS);

  function render(item: StageItem): ReactNode {
    if (item.kind === "question") {
      return (
        <div className={styles.narrow}>
          <QuestionCard
            question={item.question}
            progress={item.progress}
            onSubmit={onSubmit}
            onPass={onPass}
          />
        </div>
      );
    }
    return (
      <ResultPanel
        question={item.question}
        evaluation={item.evaluation}
        progress={item.progress}
        quotaRemaining={state.quotaRemaining}
        onRate={onRate}
        onAskAi={onAskAi}
      />
    );
  }

  return (
    <div className={styles.stage}>
      {/* Çıkan katman önce yazılıyor: React key eşlemesi onu yerinde
          tutsun, sönerken içeriği (yazılmış cevap) sıfırlanmasın. */}
      {exiting && (
        <div
          key={stageKey(exiting)}
          className={styles.stageLayer}
          data-state="exit"
          inert
        >
          {render(exiting)}
        </div>
      )}

      {stage && (
        <div key={key} className={styles.stageLayer} data-state="enter">
          {render(stage)}
        </div>
      )}
    </div>
  );
}
