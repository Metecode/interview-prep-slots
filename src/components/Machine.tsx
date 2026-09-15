import { useMemo, useRef } from "react";

import { Drum, FACES } from "./Drum";
import type { DrumHandle } from "./Drum";
import { Lever } from "./Lever";
import { CATEGORY_LABELS } from "../content/labels";
import type { Category, Question } from "../domain/question";
import styles from "./Machine.module.css";

/* ------------------------------------------------------------------ */
/* Makine — kasa, iki tambur ve kolu birleştirir.                      */
/* Reducer'a bağlanmaz: prop alır, olay yayar.                         */
/* ------------------------------------------------------------------ */

/** Kazanan yüzün indeksi. Ağırlıklı çekiliş domain/draw.ts'te yapılır;   */
/** burada yalnızca duruşta ortaya oturacak yüz sabittir.                */
const WINNING_INDEX = 6;

const NORMAL_TIMING = {
  first: { durationMs: 1300, turns: 3 },
  second: { durationMs: 1600, turns: 4 },
};

const FAST_TIMING = {
  first: { durationMs: 300, turns: 1 },
  second: { durationMs: 400, turns: 1 },
};

export type MachineProps = {
  /** Çekilen soru; spinning'e girerken gelir. */
  question: Question | null;
  /** Tamburların etiket havuzunu türetmek için tüm içerik. */
  allQuestions: readonly Question[];
  /** Havuz yalnızca bu kategorilerdeki sorulardan kurulur. */
  activeCategories: Category[];
  /** Her artışında yeni bir dönüş tetiklenir. */
  spinKey: number;
  spinning: boolean;
  /** false ise kol devre dışı. */
  canSpin: boolean;
  fastMode: boolean;
  onPull: () => void;
  onSettle: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Havuzdan rastgele bir değer seçer. Önce tam yasak listesi denenir;
 * havuz buna yetmiyorsa yalnızca bitişik komşular korunur, o da
 * yetmiyorsa ne varsa alınır. Kural üç kademede gevşediği için küçük
 * havuzlarda bile tek geçişte biter, sonsuz döngü olmaz.
 */
function pickFace(
  pool: readonly string[],
  banned: ReadonlySet<string>,
  adjacent: ReadonlySet<string>,
): string {
  const strict = pool.filter((value) => !banned.has(value));
  const loose = strict.length > 0 ? strict : pool.filter((value) => !adjacent.has(value));
  const source = loose.length > 0 ? loose : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * FACES uzunluğunda etiket dizisi üretir. Kazanan yüz sabittir; diğer 15 yüz
 * havuzdan, art arda tekrarı ve kazanan komşuluğunu engelleyerek doldurulur.
 * Havuzda 3'ten az farklı değer varsa yasak listesi kendiliğinden boşa
 * düşer (pickFace tek geçişte çalışır, sonsuz döngü riski yoktur).
 */
function buildFaces(pool: readonly string[], winnerLabel: string): string[] {
  const effectivePool = pool.length > 0 ? pool : [winnerLabel];
  const faces = new Array<string>(FACES);
  faces[WINNING_INDEX] = winnerLabel;

  for (let step = 1; step < FACES; step++) {
    const idx = (WINNING_INDEX + step) % FACES;

    // İki komşuluk mesafesindeki dolu yüzlerin hiçbiri seçilemez: pencerede
    // aynı anda üç satır göründüğü için tekrar ancak böyle engellenir.
    // Doldurma kazananın etrafını dolandığından yalnızca geriye bakmak
    // yetmez — son yüzün komşusu zaten dolu olan ilk yüzdür.
    // Kazanan da bu komşulardan biri olduğu için hemen öncesi ve sonrası
    // kendiliğinden ondan farklı kalır.
    const banned = new Set<string>();
    const adjacent = new Set<string>();
    for (const offset of [-2, -1, 1, 2]) {
      const neighbor = faces[(idx + offset + FACES) % FACES];
      if (neighbor === undefined) continue;
      banned.add(neighbor);
      // Yan yana iki aynı etiket en göze batanı; havuz daralırsa en son bu verilir.
      if (offset === -1 || offset === 1) adjacent.add(neighbor);
    }

    faces[idx] = pickFace(effectivePool, banned, adjacent);
  }

  return faces;
}

export function Machine({
  question,
  allQuestions,
  activeCategories,
  spinKey,
  spinning,
  canSpin,
  fastMode,
  onPull,
  onSettle,
}: MachineProps) {
  const leftDrumRef = useRef<DrumHandle>(null);
  const rightDrumRef = useRef<DrumHandle>(null);
  const leftSlotRef = useRef<HTMLDivElement>(null);
  const rightSlotRef = useRef<HTMLDivElement>(null);

  // Havuzlar içeriğe ve seçili kategorilere bağlı, dönüşe değil: spinKey
  // her arttığında yeniden hesaplanmaları gereksiz olurdu.
  const pool = useMemo(
    () => allQuestions.filter((q) => activeCategories.includes(q.category)),
    [allQuestions, activeCategories],
  );

  // Tek kategori seçiliyse pool tek kategoriye, dolayısıyla leftPool tek
  // değere iner — bu durumda 16 yüzün hepsi aynı olur. Doğru davranış:
  // kullanıcı zaten tek kategori seçmiş. buildFaces/pickFace'teki üç
  // kademeli gevşetme (bkz. aşağıda) bunu sonsuz döngüye girmeden karşılar.
  const leftPool = useMemo(
    () =>
      Array.from(new Set(pool.map((q) => q.category))).map(
        (category) => CATEGORY_LABELS[category],
      ),
    [pool],
  );
  const rightPool = useMemo(() => Array.from(new Set(pool.map((q) => q.topic))), [pool]);

  // question null iken tamburlar son durumlarını korur; o an için bir
  // kazanan etiketi gerekmez ama dizi yine de FACES uzunluğunda olmalı,
  // bu yüzden havuzdan bir yedek seçilir.
  const winnerLeft = question ? CATEGORY_LABELS[question.category] : (leftPool[0] ?? "");
  const winnerRight = question ? question.topic : (rightPool[0] ?? "");

  // Yüzlerin rastgele dağılımı yalnızca dönüş başına bir kez üretilir;
  // bağımlılık bilerek yalnızca spinKey — havuz ve kazanan aynı dönüş
  // içinde zaten sabit kalır.
  const leftFaces = useMemo(
    () => buildFaces(leftPool, winnerLeft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spinKey],
  );
  const rightFaces = useMemo(
    () => buildFaces(rightPool, winnerRight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spinKey],
  );

  const timing = fastMode ? FAST_TIMING : NORMAL_TIMING;

  /** Tamburun oturduğu anda pencereye küçük bir tık verir. */
  function bumpTick(el: HTMLDivElement | null) {
    if (!el || prefersReducedMotion()) return;
    el.classList.remove(styles.tick);
    // Sınıfı kaldırıp yeniden eklemek arada reflow gerektirir,
    // yoksa tarayıcı animasyonu yeniden başlamış saymaz.
    void el.offsetWidth;
    el.classList.add(styles.tick);
  }

  /** Dönerken tamburlara tıklanınca animasyon atlanır. */
  function handleBayClick() {
    if (!spinning) return;
    leftDrumRef.current?.finish();
    rightDrumRef.current?.finish();
  }

  return (
    <div className={styles.stage}>
      <div className={styles.machine}>
        <div className={styles.contact} aria-hidden="true" />

        <div className={styles.reelsColumn}>
          {/* Hangi tamburun ne gösterdiği belirsizdi; iki sütuna eşlenen etiket. */}
          <div className={styles.reelLabels} aria-hidden="true">
            <span className={styles.reelLabel}>KATEGORİ</span>
            <span className={styles.reelLabel}>KONU</span>
          </div>

          <div className={styles.bay} onClick={handleBayClick}>
            <div ref={leftSlotRef} className={styles.drumSlot}>
              <Drum
                ref={leftDrumRef}
                labels={leftFaces}
                targetIndex={WINNING_INDEX}
                spinKey={spinKey}
                durationMs={timing.first.durationMs}
                turns={timing.first.turns}
                onSettle={() => bumpTick(leftSlotRef.current)}
              />
            </div>
            <div ref={rightSlotRef} className={styles.drumSlot}>
              <Drum
                ref={rightDrumRef}
                labels={rightFaces}
                targetIndex={WINNING_INDEX}
                spinKey={spinKey}
                durationMs={timing.second.durationMs}
                turns={timing.second.turns}
                onSettle={() => {
                  bumpTick(rightSlotRef.current);
                  onSettle();
                }}
              />
            </div>

            {/* Yalnızca duruşta görünür; üçgenler CSS geçişiyle dışarıdan içeri kayar. */}
            <div
              className={
                spinning ? styles.payline : `${styles.payline} ${styles.paylineSettled}`
              }
              aria-hidden="true"
            >
              <span className={styles.paylineFill} />
              <span className={`${styles.paylineTriangle} ${styles.paylineTriangleLeft}`} />
              <span className={`${styles.paylineTriangle} ${styles.paylineTriangleRight}`} />
            </div>
          </div>
        </div>

        <div className={styles.leverColumn}>
          <div className={styles.leverSlot}>
            <Lever disabled={spinning || !canSpin} onPull={onPull} />
          </div>
        </div>
      </div>
    </div>
  );
}
