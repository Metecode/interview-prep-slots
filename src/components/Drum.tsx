import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./Drum.module.css";

/* ------------------------------------------------------------------ */
/* Tambur — dikey kayan şerit                                          */
/*                                                                     */
/* 3B prizma sürümü kaldırıldı: WebKit (iOS Safari ve iOS Chrome)      */
/* preserve-3d içeren pencereyi render etmiyor ve motoru güvenilir     */
/* biçimde ayırt etmenin yolu yok. İki kod yolu tutmak yerine tek yol: */
/* masaüstünde de aynı şerit çalışıyor, dolayısıyla masaüstünde test   */
/* edilen şey mobilde de aynı şey.                                     */
/*                                                                     */
/* Silindir hissi perspektiften değil, .window::after'daki üst-alt     */
/* karartma gradyanından geliyor.                                      */
/* ------------------------------------------------------------------ */

/** Machine'in kaç farklı etiket sağlayacağı. */
export const FACES = 16;

const OVERSHOOT_ROWS = 0.3;
const OVERSHOOT_AT = 0.9;
const EASE_SPIN = "cubic-bezier(.26,.84,.34,1)";
const EASE_SETTLE = "cubic-bezier(.2,.72,.3,1)";

/**
 * Şeritte ortaya gelen yüzün indeksi. Pencere üç satır gösterir;
 * 0 üstte, 1 ortada, 2 altta. Şerit hiç kaydırılmadığında ortada
 * duran yüz budur.
 */
const CENTER = 1;

export type DrumHandle = {
  /** Çalışan dönüşü sona atar; onSettle yine bir kez çağrılır. */
  finish(): void;
};

export type DrumProps = {
  /** Havuzdaki etiketler. Şerit bunlardan doldurulur. */
  labels: string[];
  /** Duracağı etiketin labels içindeki indeksi. */
  targetIndex: number;
  /** Her artışında yeni bir dönüş tetiklenir. */
  spinKey: number;
  durationMs: number;
  /** Hedefe varmadan kaç tur atılacağı. Tur = FACES satır. */
  turns: number;
  onSettle?: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Şeridi kurar. Dinlenme etiketi CENTER'a konur ki dönüş başlarken
 * ekrandaki yazı değişmesin; kazanan, turların sonundaki konuma yazılır.
 */
function buildStrip(
  labels: string[],
  targetIndex: number,
  turns: number,
  restLabel: string,
): { items: string[]; winnerPos: number } {
  const pool = labels.length > 0 ? labels : [""];
  const winnerPos = CENTER + Math.max(1, turns) * FACES;
  const items: string[] = [];

  // Altta bir satır fazlası olsun, kayarken boşluk görünmesin.
  for (let i = 0; i <= winnerPos + 1; i++) {
    items.push(pool[i % pool.length] ?? "");
  }

  items[CENTER] = restLabel;
  items[winnerPos] = pool[targetIndex] ?? "";
  return { items, winnerPos };
}

/** Tek satır yüksekliğini piksel olarak okur. --row doğrudan okunamaz, çözülmemiş metin döner. */
function readRowHeight(el: HTMLElement): number {
  const h = Number.parseFloat(getComputedStyle(el).height);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

export const Drum = forwardRef<DrumHandle, DrumProps>(function Drum(
  { labels, targetIndex, spinKey, durationMs, turns, onSettle },
  ref,
) {
  const stripRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  /** Şu an ortada duran etiket. Sonraki dönüşün başlangıcı bu olur. */
  const restLabelRef = useRef<string>(labels[targetIndex] ?? "");
  const lastSpunKeyRef = useRef<number | null>(null);

  const latest = useRef({ targetIndex, durationMs, turns, onSettle, labels });
  latest.current = { targetIndex, durationMs, turns, onSettle, labels };

  // GEÇİCİ TEŞHİS: readRowHeight gerçek cihazda ne okuyor, canlıda görmek için.
  const [debugRow, setDebugRow] = useState<number | null>(null);

  /**
   * Şerit yalnızca spinKey değişince yeniden kurulur. Dönüş bittikten
   * sonra yerinde bırakılır — sıfırlamak, kazananın bir kare boyunca
   * kaybolmasına yol açardı.
   */
  const { items, winnerPos } = useMemo(
    () =>
      buildStrip(
        latest.current.labels,
        latest.current.targetIndex,
        latest.current.turns,
        restLabelRef.current,
      ),
    [spinKey],
  );

  useImperativeHandle(
    ref,
    () => ({
      finish() {
        animationRef.current?.finish();
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const face = faceRef.current;
    if (!strip || !face) return;

    const row = readRowHeight(face);
    setDebugRow(row); // GEÇİCİ TEŞHİS
    if (row === 0) return;

    const end = -(winnerPos - CENTER) * row;
    const isFirstMount = lastSpunKeyRef.current === null;
    const alreadySpun = lastSpunKeyRef.current === spinKey;
    lastSpunKeyRef.current = spinKey;

    // İlk bağlanışta dönüş yok: kazanan doğrudan ortada durur.
    // Aynı spinKey ile efekt tekrar çalışırsa (StrictMode) da dönüş tekrarlanmaz.
    if (isFirstMount || alreadySpun) {
      strip.style.transform = `translateY(${end}px)`;
      restLabelRef.current = items[winnerPos] ?? "";
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      restLabelRef.current = items[winnerPos] ?? "";
      latest.current.onSettle?.();
    };

    if (prefersReducedMotion()) {
      strip.style.transform = `translateY(${end}px)`;
      settle();
      return;
    }

    const animation = strip.animate(
      [
        { transform: "translateY(0px)", easing: EASE_SPIN, offset: 0 },
        {
          transform: `translateY(${end - OVERSHOOT_ROWS * row}px)`,
          easing: EASE_SETTLE,
          offset: OVERSHOOT_AT,
        },
        { transform: `translateY(${end}px)`, offset: 1 },
      ],
      { duration: latest.current.durationMs, fill: "forwards" },
    );

    animationRef.current = animation;
    animation.onfinish = settle;

    return () => {
      animation.cancel();
      if (animationRef.current === animation) animationRef.current = null;
      // İptal edilse bile şerit hedefte kalsın, pencere boş görünmesin.
      strip.style.transform = `translateY(${end}px)`;
    };
  }, [spinKey, items, winnerPos]);

  return (
    <div className={styles.window} aria-hidden="true">
      {/* GEÇİCİ TEŞHİS: row===0 ise yüzler hâlâ DOM'da ama transform hiç
          uygulanmıyor demektir; bu metin en azından render olduğunu kanıtlar. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          color: "#0f0",
          fontSize: 10,
          zIndex: 99,
          background: "rgba(0,0,0,0.6)",
          padding: "1px 3px",
        }}
      >
        row {debugRow ?? "?"}
      </div>
      <div ref={stripRef} className={styles.strip}>
        {items.map((label, i) => (
          <div
            key={i}
            ref={i === 0 ? faceRef : undefined}
            className={
              i === winnerPos ? `${styles.face} ${styles.mid}` : styles.face
            }
          >
            <span className={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
