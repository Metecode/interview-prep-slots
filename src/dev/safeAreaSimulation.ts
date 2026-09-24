/* ------------------------------------------------------------------ */
/* Güvenli alan simülasyonu — yalnızca geliştirmede                    */
/* ------------------------------------------------------------------ */

/*
  iPhone'da ana ekrandan açılan uygulamada (black-translucent) durum
  çubuğu ve ev göstergesi sayfanın üstüne biniyor; masaüstünde env()
  0 döndüğü için bu hiç görülmüyor. URL'de ?safe=iphone varsa --safe-*
  değişkenleri sabit değerlerle ezilir ve kenarlara yarı saydam bir
  şerit çizilir: durum çubuğunun altında ne kaldığı gözle görülür.

  Üretime girmez: main.tsx bu modülü yalnızca import.meta.env.DEV
  altında dinamik import ile yüklüyor, derleme o dalı tamamen atıyor.
*/

export type SafeAreaInsets = {
  top: string;
  right: string;
  bottom: string;
  left: string;
};

/** Dikey tutuşta çentikli/Dynamic Island'lı iPhone ölçüleri. */
const PRESETS: Record<string, SafeAreaInsets> = {
  iphone: { top: "59px", right: "0px", bottom: "34px", left: "0px" },
};

/** Sorgu dizesinden simüle edilecek boşlukları okur; yoksa null. */
export function simulatedSafeArea(search: string): SafeAreaInsets | null {
  const preset = new URLSearchParams(search).get("safe");
  if (preset === null) return null;
  return PRESETS[preset] ?? null;
}

/** Şerit, durum çubuğunun ya da ev göstergesinin kapladığı yeri boyar. */
function drawStrip(edge: "top" | "bottom", height: string): void {
  const strip = document.createElement("div");
  strip.setAttribute("aria-hidden", "true");
  Object.assign(strip.style, {
    position: "fixed",
    left: "0",
    right: "0",
    [edge]: "0",
    height,
    background: "rgba(255, 0, 80, 0.35)",
    pointerEvents: "none",
    zIndex: "2147483647",
  });
  document.body.appendChild(strip);
}

export function applySafeAreaSimulation(): void {
  const insets = simulatedSafeArea(window.location.search);
  if (!insets) return;

  const root = document.documentElement.style;
  root.setProperty("--safe-top", insets.top);
  root.setProperty("--safe-right", insets.right);
  root.setProperty("--safe-bottom", insets.bottom);
  root.setProperty("--safe-left", insets.left);

  drawStrip("top", insets.top);
  drawStrip("bottom", insets.bottom);
}
