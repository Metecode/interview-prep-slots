import { useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Drum, FACES } from "./components/Drum";
import type { DrumHandle } from "./components/Drum";
import { Lever } from "./components/Lever";

/* ------------------------------------------------------------------ */
/* GEÇİCİ deneme sayfası — Machine bileşeni gelince bu dosya silinecek  */
/* ------------------------------------------------------------------ */

const LABELS = [
  "Index", "Join", "Transaction", "Deadlock",
  "Hook", "Effect", "Memo", "Context",
  "Stream", "Consumer", "Partition", "Cache",
  "Heap", "Graph", "Proxy", "Builder",
];

const page: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  maxWidth: "26rem",
  margin: "0 auto",
  padding: "3rem 1.25rem",
};

const machine: CSSProperties = {
  display: "flex",
  gap: "1rem",
  alignItems: "center",
};

const row: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-end",
};

const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  flex: 1,
  fontSize: "0.8rem",
  color: "var(--page-muted)",
};

const input: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--page-line)",
  borderRadius: "6px",
  padding: "0.5rem",
  color: "inherit",
  font: "inherit",
};

const button: CSSProperties = {
  ...input,
  cursor: "pointer",
  padding: "0.55rem 1rem",
};

export default function App() {
  const drumRef = useRef<DrumHandle>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [turns, setTurns] = useState(3);
  const [durationMs, setDurationMs] = useState(2600);

  function spin() {
    const next = Math.floor(Math.random() * FACES);
    setTargetIndex(next);
    setSpinKey((key) => key + 1);
    console.log("spin ->", next, LABELS[next]);
  }

  return (
    <main style={page}>
      <h1 style={{ fontSize: "1rem", margin: 0, color: "var(--page-muted)" }}>
        Drum denemesi
      </h1>

      <div style={machine}>
        <div style={{ flex: 1 }}>
          <Drum
            ref={drumRef}
            labels={LABELS}
            targetIndex={targetIndex}
            spinKey={spinKey}
            durationMs={durationMs}
            turns={turns}
            onSettle={() => console.log("settle ->", targetIndex, LABELS[targetIndex])}
          />
        </div>
        <div style={{ width: "5.5rem", flexShrink: 0 }}>
          <Lever onPull={spin} />
        </div>
      </div>

      <div style={row}>
        <label style={field}>
          Tur sayısı
          <input
            style={input}
            type="number"
            min={0}
            max={12}
            value={turns}
            onChange={(e) => setTurns(Number(e.target.value))}
          />
        </label>

        <label style={field}>
          Süre (ms)
          <input
            style={input}
            type="number"
            min={100}
            step={100}
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
          />
        </label>
      </div>

      <div style={row}>
        <button style={button} type="button" onClick={spin}>
          Çevir
        </button>
        {/* useImperativeHandle'ı elle denemek için. */}
        <button
          style={button}
          type="button"
          onClick={() => drumRef.current?.finish()}
        >
          Atla
        </button>
      </div>
    </main>
  );
}
