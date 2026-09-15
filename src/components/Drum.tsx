import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import styles from "./Drum.module.css";

/* ------------------------------------------------------------------ */
/* Tambur — ne göstereceğini bilmez, nasıl göstereceğini bilir         */
/*                                                                     */
/* WebKit'te (iOS Safari VE iOS Chrome — ikisi de motor olarak WebKit) */
/* preserve-3d içeren pencere hiç render olmuyor; masaüstünde sorun    */
/* yok. Motoru güvenilir biçimde ayırt etmenin yolu yok — CSS.supports */
/* WebKit'te "destekleniyor" der ama fiilen çalışmaz — o yüzden dar    */
/* ekranda (telefon varsayımıyla) 3B yerine düz dikey şerit moduna     */
/* geçiliyor. Mod yalnızca ilk render'da, aşağıdaki useState ile       */
/* belirlenir ve bileşen ömrü boyunca sabit kalır.                     */
/*                                                                      */
/* NOT: Bu useState bilerek ayrı bir "useDrumMode" hook'una             */
/* çıkarılmadı — öyle yapınca eslint-plugin-react-hooks'un              */
/* react-hooks/refs kuralı aşağıdaki `latest.current = ...` satırında   */
/* yanlış pozitif veriyor (yerel bir custom hook'un varlığı analizi     */
/* şaşırtıyor). Tekrar ayıklamadan önce lint'in hâlâ geçtiğini kontrol  */
/* et.                                                                  */
/* ------------------------------------------------------------------ */

/** Prizmanın (3d modda) / şeridin (flat modda) yüz sayısı. */
export const FACES = 16;

const STEP = 360 / FACES;

/** Hedefi aşma miktarı ve aşmanın tamamlandığı ilerleme oranı. */
const OVERSHOOT_DEG = 7;
const OVERSHOOT_AT = 0.9;
/** Flat modda derece yerine adım (satır) kullanılır; oran 3B ile aynı tutulur. */
const OVERSHOOT_STEPS = OVERSHOOT_DEG / STEP;

/** Ana dönüş ve sonundaki yerine oturma eğrileri. */
const EASE_SPIN = "cubic-bezier(.26,.84,.34,1)";
const EASE_SETTLE = "cubic-bezier(.2,.72,.3,1)";

/** tokens.css'teki mobil kırılımla aynı; flat moda geçiş eşiği de bu. */
const FLAT_BREAKPOINT = "(max-width: 560px)";

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

type DrumMode = "3d" | "flat";

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

/** Yarıçap, bir yüzün yarısının prizma merkezine olan uzaklığından çıkar. 3d modda kullanılır. */
function radiusFor(rowHeight: number): number {
  return rowHeight / 2 / Math.tan(Math.PI / FACES);
}

function transform3dAt(radius: number, angleDeg: number): string {
  return `translateZ(${-radius}px) rotateX(${-angleDeg}deg)`;
}

/**
 * Flat modda "adım" birimi bir satır yüksekliğidir. 3d'nin aksine geri
 * sarma/normalize yok: her dönüş 0'dan başlar, hedefe kadar olan mesafeyi
 * (bkz. flatTotalSteps) doğrudan kat eder.
 */
function transformFlatAt(rowHeight: number, steps: number): string {
  return `translateY(${-steps * rowHeight}px)`;
}

export const Drum = forwardRef<DrumHandle, DrumProps>(function Drum(
  { labels, targetIndex, spinKey, durationMs, turns, onSettle },
  ref,
) {
  const [mode] = useState<DrumMode>(() =>
    window.matchMedia(FLAT_BREAKPOINT).matches ? "flat" : "3d",
  );

  const drumRef = useRef<HTMLDivElement>(null);
  /** Satır yüksekliğini ölçtüğümüz yüz (her iki modda da index 0). */
  const faceRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  /**
   * 3d modda tamburun oturduğu son açı, [0, 360) aralığında.
   * Dönüş buradan devam eder; sıfırdan başlamak turns 1 iken görünür bir
   * sıçrama yapardı. Flat modda karşılığı yok: her dönüş 0'dan başlar.
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
  // Flat modda flatLabels içindeki indeksi, 3d modda 0..FACES-1 indeksi tutar.
  const [settledIndex, setSettledIndex] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    finish() {
      // finish() onfinish'i tetikler, bitiş işleri tek yerde kalır.
      animationRef.current?.finish();
    },
  }), []);

  /**
   * Flat modda dönüş toplamda targetIndex + turns*FACES adım ilerler
   * (her zaman 0'dan başlayıp geri sarmadan). Etiket şeridi bu mesafeyi
   * kaplayacak kadar tekrarlanmalı — labels[i % FACES] — yoksa şerit
   * dönüşün ortasında biter, pencere içeriksiz kalır.
   */
  const flatTotalSteps = targetIndex + turns * FACES;
  const displayLabels =
    mode === "flat"
      ? Array.from({ length: flatTotalSteps + 1 }, (_, i) => labels[i % FACES] ?? "")
      : labels;

  // useLayoutEffect: geometri ilk boyamadan önce yazılmazsa yüzler bir kare
  // boyunca üst üste/yanlış konumda görünür.
  useLayoutEffect(() => {
    const drum = drumRef.current;
    const face = faceRef.current;
    if (!drum || !face) return;

    const rowHeight = readRowHeight(face);

    const isFirstMount = lastSpunKeyRef.current === null;
    // Aynı spinKey ile efekt yeniden çalışırsa (StrictMode'un çift çağrısı
    // dahil) dönüş tekrarlanmaz, yalnızca geometri tazelenir.
    const alreadySpun = lastSpunKeyRef.current === spinKey;
    lastSpunKeyRef.current = spinKey;

    if (mode === "flat") {
      const targetSteps = latest.current.targetIndex + latest.current.turns * FACES;

      if (isFirstMount) {
        // İlk bağlanışta dönüş yok: tambur hedefte durur ve onSettle çağrılmaz.
        drum.style.transform = transformFlatAt(rowHeight, targetSteps);
        setSettledIndex(targetSteps);
        return;
      }

      if (alreadySpun) {
        drum.style.transform = transformFlatAt(rowHeight, targetSteps);
        return;
      }

      // Hem onfinish hem elle finish() aynı ana denk gelebilir; tur bir kez kapanır.
      let hasSettled = false;
      const settle = () => {
        if (hasSettled) return;
        hasSettled = true;
        setSettledIndex(targetSteps);
        latest.current.onSettle?.();
      };

      setSettledIndex(null);

      if (prefersReducedMotion()) {
        drum.style.transform = transformFlatAt(rowHeight, targetSteps);
        settle();
        return;
      }

      const animation = drum.animate(
        [
          { transform: transformFlatAt(rowHeight, 0), easing: EASE_SPIN, offset: 0 },
          {
            transform: transformFlatAt(rowHeight, targetSteps + OVERSHOOT_STEPS),
            easing: EASE_SETTLE,
            offset: OVERSHOOT_AT,
          },
          { transform: transformFlatAt(rowHeight, targetSteps), offset: 1 },
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
    }

    // --- 3d ---
    // Yarıçap her dönüş başında okunur; mobil kırılımda --row değişmişse
    // resize dinlemeden yakalanır.
    const radius = radiusFor(rowHeight);
    drum.style.setProperty("--radius", `${radius}px`);

    if (isFirstMount) {
      const restAngle = normalizeAngle(latest.current.targetIndex * STEP);
      currentAngleRef.current = restAngle;
      drum.style.transform = transform3dAt(radius, restAngle);
      setSettledIndex(latest.current.targetIndex);
      return;
    }

    if (alreadySpun) {
      drum.style.transform = transform3dAt(radius, currentAngleRef.current);
      return;
    }

    const spinTarget = latest.current.targetIndex;
    const from = currentAngleRef.current;
    // Hedefe kalan açı her zaman ileri yönde: tambur geri sarmaz.
    const remaining = normalizeAngle(spinTarget * STEP - normalizeAngle(from));
    const to = from + remaining + 360 * latest.current.turns;

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
      drum.style.transform = transform3dAt(radius, normalizeAngle(to));
      settle();
      return;
    }

    const animation = drum.animate(
      [
        { transform: transform3dAt(radius, from), easing: EASE_SPIN, offset: 0 },
        {
          transform: transform3dAt(radius, to + OVERSHOOT_DEG),
          easing: EASE_SETTLE,
          offset: OVERSHOOT_AT,
        },
        { transform: transform3dAt(radius, to), offset: 1 },
      ],
      { duration: latest.current.durationMs, fill: "forwards" },
    );

    animationRef.current = animation;
    animation.onfinish = settle;

    return () => {
      animation.cancel();
      if (animationRef.current === animation) animationRef.current = null;
    };
  }, [spinKey, mode]);

  const windowClassName =
    mode === "flat" ? styles.window : `${styles.window} ${styles.window3d}`;
  const drumClassName =
    mode === "flat" ? `${styles.drum} ${styles.drumFlat}` : `${styles.drum} ${styles.drum3d}`;
  const faceModeClassName = mode === "flat" ? styles.faceFlat : styles.face3d;

  return (
    <div
      className={windowClassName}
      // 16 yüzün tamamını okumak gürültü olur; metin zaten soru kartında.
      aria-hidden="true"
    >
      {/* GEÇİCİ TEŞHİS: flat render oluyor mu, yüzlerden bağımsız kanıt. */}
      {mode === "flat" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            color: "#fff",
            fontSize: 12,
            zIndex: 99,
          }}
        >
          {labels.length} yüz
        </div>
      )}
      <div
        ref={drumRef}
        className={drumClassName}
        style={mode === "3d" ? ({ "--step": `${STEP}deg` } as CssVars) : undefined}
      >
        {displayLabels.map((label, i) => (
          <div
            key={i}
            ref={i === 0 ? faceRef : undefined}
            className={
              i === settledIndex
                ? `${styles.face} ${faceModeClassName} ${styles.mid}`
                : `${styles.face} ${faceModeClassName}`
            }
            style={
              mode === "flat"
                ? // GEÇİCİ TEŞHİS: CSS modülünden bağımsız, elle görünürlük.
                  ({
                    "--i": i,
                    background: "#fff",
                    border: "1px solid red",
                    color: "#000",
                  } as CssVars)
                : ({ "--i": i } as CssVars)
            }
          >
            <span className={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
