import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { CATEGORY_LABELS } from "../../content/labels";
import { nextReviewInLabel } from "../../domain/leitner";
import type { QuestionProgress, SelfRating as Rating } from "../../domain/progress";
import type { Evaluation, Question } from "../../domain/question";
import { StageBadge } from "../StageBadge";
import { FollowUps } from "./FollowUps";
import { ModelAnswer } from "./ModelAnswer";
import { ScoreCard } from "./ScoreCard";
import { SelfRating } from "./SelfRating";
import styles from "./ResultPanel.module.css";

/* ------------------------------------------------------------------ */
/* Sonuç ekranı — soru üstte tam genişlik, altında iki sütun            */
/*                                                                     */
/* Kartlar sırayla yükselerek gelir. --i sıradaki yerini söyler:        */
/* geniş ekranda sol sütun (0,1,2) önce, sağdaki model cevap (3) sonra. */
/* ------------------------------------------------------------------ */

const DIFFICULTY_LABELS: Record<Question["difficulty"], string> = {
  1: "Kolay",
  2: "Orta",
  3: "Zor",
};

/** Sıralı girişteki yer; CSS gecikmeyi --stagger-card ile çarpıyor. */
const rise = (index: number) => ({ "--i": index }) as CSSProperties;

export type ResultPanelProps = {
  question: Question;
  /** null ise soru pas geçilmiş demektir. */
  evaluation: Evaluation | null;
  /** Sorunun kayıtlı ilerlemesi; ilk kez soruluyorsa null. */
  progress: QuestionProgress | null;
  quotaRemaining: number;
  onRate: (rating: Rating) => void;
  onAskAi: () => void;
};

export function ResultPanel({
  question,
  evaluation,
  progress,
  quotaRemaining,
  onRate,
  onAskAi,
}: ResultPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const passed = evaluation === null;
  const box = progress?.box ?? 1;
  const attempts = progress?.attempts.length ?? 0;
  const followUps = question.followUps ?? [];

  // Pas geçilen soruya yapay zekâ harcanmaz; kota kullanıcının cebinden çıkıyor.
  const blockedReason = passed
    ? "pas geçilen soruya harcanmaz"
    : quotaRemaining <= 0
      ? "hakkın kalmadı"
      : null;

  /*
    Tur ilerleyince odak, ekrana yeni gelen bölüme taşınır. Kol dönüş
    boyunca disabled olduğu için odak gövdeye düşüyordu: klavyedeki
    kullanıcı her çevirişten sonra değerlendirme düğmelerine ulaşmak için sayfanın
    başından Tab'lamak zorunda kalıyordu.

    Odaklanan, ilk alan değil bölümün kendisi (tabIndex -1): ekran
    okuyucu önce soruyu okur, sonraki Tab yazı alanına girer — ve
    dokunmatik cihazda klavye kendiliğinden açılmaz.

    preventScroll: fareyle çalışan kullanıcı için sayfa kendiliğinden
    kaymasın; odak zaten görünür alanın içinde.
  */
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={panelRef} className={styles.panel} tabIndex={-1}>
      {/* Soru iki sütunun üzerinde, tam genişlikte kalır. */}
      <section className={styles.card} style={rise(0)}>
        <div className={styles.meta}>
          {/* Kutu uygulamanın çekirdek mekanizması; "Kutu N" yerine aşama
              olarak, meta satırının başında gösterilir. */}
          <StageBadge box={box} attemptCount={attempts} />
          <span className={styles.metaBadge}>{CATEGORY_LABELS[question.category]}</span>
          <span className={styles.metaBadge}>
            {DIFFICULTY_LABELS[question.difficulty]}
          </span>
          <span className={styles.metaBadge}>{question.topic}</span>
        </div>
        <h2 className={styles.prompt}>{question.prompt}</h2>
      </section>

      {/*
        DOM sırası dar ekranın sırası: skor → model cevap →
        öz-değerlendirme → devam soruları. Geniş ekranda yerleşimi
        grid alanları belirliyor, sıra değişmiyor.
      */}
      <div className={styles.columns}>
        <ScoreCard
          question={question}
          evaluation={evaluation}
          className={`${styles.card} ${styles.colScore}`}
          style={rise(0)}
        />

        <ModelAnswer
          markdown={question.modelAnswer}
          className={`${styles.card} ${styles.colModel}`}
          style={rise(3)}
        />

        <SelfRating
          box={box}
          passed={passed}
          onRate={onRate}
          className={`${styles.card} ${styles.colRating}`}
          style={rise(1)}
        />

        {followUps.length > 0 && (
          <FollowUps
            items={followUps}
            className={`${styles.card} ${styles.colFollow}`}
            style={rise(2)}
          />
        )}
      </div>

      <div className={styles.statusBar}>
        <span className={styles.statusText}>
          {nextReviewInLabel(box)} · {attempts > 0 ? `${attempts} deneme` : "ilk kez"} ·{" "}
          {CATEGORY_LABELS[question.category]}
        </span>

        <div className={styles.statusActions}>
          {/* Kalan hak tek yerde duruyor: üst çubuktaki sayaç.
              Burada yalnızca düğmenin neden kapalı olduğu yazar. */}
          {blockedReason && <span className={styles.aiNote}>{blockedReason}</span>}
          <button
            type="button"
            className={styles.aiButton}
            disabled={blockedReason !== null}
            onClick={onAskAi}
          >
            Yapay zekâya sor
          </button>
        </div>
      </div>
    </div>
  );
}
