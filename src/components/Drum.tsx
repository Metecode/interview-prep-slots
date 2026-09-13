import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import styles from "./Drum.module.css";

/* ------------------------------------------------------------------ */
/* Tambur — ne göstereceğini bilmez, nasıl göstereceğini bilir         */
/* ------------------------------------------------------------------ */

/** Prizmanın yüz sayısı. Geometrinin tamamı buna bağlı. */
export const FACES = 16;

const STEP = 360 / FACES;

/** Hedefi aşma miktarı ve aşmanın tamamlandığı ilerleme oranı. */
const OVERSHOOT_DEG = 7;
const OVERSHOOT_AT = 0.9;

/** Ana dönüş ve sonundaki yerine oturma eğrileri. */
const EASE_SPIN = "cubic-bezier(.26,.84,.34,1)";
const EASE_SETTLE = "cubic-bezier(.2,.72,.3,1)";

/** Özel CSS değişkenlerini stil nesnesine yazabilmek için. */
type CssVars = CSSProperties & Record<`--${string}`, string | number>;

export type DrumHandle = {
  /** Çalışan dönüşü sona atar; onSettle normal akıştaki gibi bir kez çağrılır. */
  finish(): void;
};

export type DrumProps = {
  /** Yüzlere yazılacak metinler; uzunluğu FACES olmalı. Eksiği boş kalır. */
  labels: string[];
  /** Duracağı yüzün indeksi. */
  targetIndex: number;
  /** Her artışında yeni bir dönüş tetiklenir. */
  spinKey: number;
  durationMs: number;
  /** Hedefe varmadan atılacak tam tur sayısı. */
  turns: number;
  onSettle?: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Açıyı [0, 360) aralığına indirir. Negatif girdide de pozitif döner. */
function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Tek satır yüksekliğini piksel olarak okur.
 * `--row` doğrudan okunsaydı "3.5rem" gibi çözülmemiş bir metin dönerdi.
 * Ölçüm pencereden değil bir yüzden alınır: pencere üç satır yüksekliğinde
 * ve bölme yapmak "3" sabitini CSS'in yanı sıra buraya da kopyalardı.
 */
function readRowHeight(faceEl: HTMLElement): number {
  const height = Number.parseFloat(getComputedStyle(faceEl).height);
  return Number.isFinite(height) ? height : 0;
}

/** Yarıçap, bir yüzün yarısının prizma merkezine olan uzaklığından çıkar. */
function radiusFor(rowHeight: number): number {
  return rowHeight / 2 / Math.tan(Math.PI / FACES);
}

function transformAt(radius: number, angleDeg: number): string {
  return `translateZ(${-radius}px) rotateX(${-angleDeg}deg)`;
}

export const Drum = forwardRef<DrumHandle, DrumProps>(function Drum(
  { labels, targetIndex, spinKey, durationMs, turns, onSettle },
  ref,
) {
  const drumRef = useRef<HTMLDivElement>(null);
  /** Yarıçap hesabı için tek satırın gerçek yüksekliğini ölçtüğümüz yüz. */
  const faceRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  /**
   * Tamburun oturduğu son açı, [0, 360) aralığında.
   * Dönüş buradan devam eder; sıfırdan başlamak turns 1 iken görünür bir
   * sıçrama yapardı.
   */
  const currentAngleRef = useRef(0);

  /** En son dönüşün anahtarı. null ise henüz hiç çevrilmedi. */
  const lastSpunKeyRef = useRef<number | null>(null);

  /**
   * Dönüşü yalnızca spinKey tetikler, ama parametreler dönüş anındaki
   * değerleriyle okunmalı. Ref'te tutmak bunu lint'i susturmadan sağlar:
   * yeni bir prop eklendiğinde burada da görünür olur.
   */
  const latest = useRef({ targetIndex, durationMs, turns, onSettle });
  latest.current = { targetIndex, durationMs, turns, onSettle };

  // Yalnızca dönüş bittiğinde değişir — animasyon kareleri state'e bağlı değil.
  const [settledIndex, setSettledIndex] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    finish() {
      // finish() onfinish'i tetikler, bitiş işleri tek yerde kalır.
      animationRef.current?.finish();
    },
  }), []);

  // useLayoutEffect: yarıçap ilk boyamadan önce yazılmazsa 16 yüz bir kare
  // boyunca üst üste yassı görünür.
  useLayoutEffect(() => {
    const drum = drumRef.current;
    const face = faceRef.current;
    if (!drum || !face) return;

    // Yarıçap her dönüş başında okunur; mobil kırılımda --row değişmişse
    // resize dinlemeden yakalanır.
    const radius = radiusFor(readRowHeight(face));
    drum.style.setProperty("--radius", `${radius}px`);

    const isFirstMount = lastSpunKeyRef.current === null;
    // Aynı spinKey ile efekt yeniden çalışırsa (StrictMode'un çift çağrısı
    // dahil) dönüş tekrarlanmaz, yalnızca geometri tazelenir.
    const alreadySpun = lastSpunKeyRef.current === spinKey;
    lastSpunKeyRef.current = spinKey;

    if (isFirstMount) {
      // İlk bağlanışta dönüş yok: tambur hedefte durur ve onSettle çağrılmaz,
      // yoksa daha çevrilmeden tur bitmiş sayılır.
      const restAngle = normalizeAngle(latest.current.targetIndex * STEP);
      currentAngleRef.current = restAngle;
      drum.style.transform = transformAt(radius, restAngle);
      setSettledIndex(latest.current.targetIndex);
      return;
    }

    if (alreadySpun) {
      drum.style.transform = transformAt(radius, currentAngleRef.current);
      return;
    }

    const spinTarget = latest.current.targetIndex;
    const from = currentAngleRef.current;
    // Hedefe kalan açı her zaman ileri yönde: tambur geri sarmaz.
    const remaining = normalizeAngle(spinTarget * STEP - normalizeAngle(from));
    const to = from + remaining + 360 * latest.current.turns;

    // Hem onfinish hem elle finish() aynı ana denk gelebilir; tur bir kez kapanır.
    let hasSettled = false;
    const settle = () => {
      if (hasSettled) return;
      hasSettled = true;
      // Saklarken normalize edilir, yoksa açı turlar boyunca sonsuza büyür.
      currentAngleRef.current = normalizeAngle(to);
      setSettledIndex(spinTarget);
      latest.current.onSettle?.();
    };

    setSettledIndex(null);

    if (prefersReducedMotion()) {
      drum.style.transform = transformAt(radius, normalizeAngle(to));
      settle();
      return;
    }

    const animation = drum.animate(
      [
        { transform: transformAt(radius, from), easing: EASE_SPIN, offset: 0 },
        {
          transform: transformAt(radius, to + OVERSHOOT_DEG),
          easing: EASE_SETTLE,
          offset: OVERSHOOT_AT,
        },
        { transform: transformAt(radius, to), offset: 1 },
      ],
      { duration: latest.current.durationMs, fill: "forwards" },
    );

    animationRef.current = animation;
    animation.onfinish = settle;

    return () => {
      // Sökülürken ya da yeni dönüş başlarken eskisi bırakılmaz.
      animation.cancel();
      if (animationRef.current === animation) animationRef.current = null;
    };
  }, [spinKey]);

  return (
    <div
      className={styles.window}
      // 16 yüzün tamamını okumak gürültü olur; metin zaten soru kartında.
      aria-hidden="true"
    >
      <div
        ref={drumRef}
        className={styles.drum}
        style={{ "--step": `${STEP}deg` } as CssVars}
      >
        {Array.from({ length: FACES }, (_, i) => (
          <div
            key={i}
            ref={i === 0 ? faceRef : undefined}
            className={i === settledIndex ? `${styles.face} ${styles.mid}` : styles.face}
            style={{ "--i": i } as CssVars}
          >
            <span className={styles.label}>{labels[i] ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
