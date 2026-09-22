import { useId, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

import { parseInline, parseModelAnswer } from "../../domain/modelAnswer";
import { CodeBlock } from "./CodeBlock";
import styles from "./ModelAnswer.module.css";

/* ------------------------------------------------------------------ */
/* Model cevap — referans çözüm                                        */
/* ------------------------------------------------------------------ */

/** Satır içi `kod` ve **kalın** parçalarını çizer. */
function Inline({ text }: { text: string }): ReactNode {
  return parseInline(text).map((token, index) => {
    if (token.kind === "code") {
      return (
        <code key={index} className={styles.inlineCode}>
          {token.text}
        </code>
      );
    }
    if (token.kind === "strong") return <strong key={index}>{token.text}</strong>;
    return <span key={index}>{token.text}</span>;
  });
}

export type ModelAnswerProps = {
  markdown: string;
  className: string;
  style: CSSProperties;
};

export function ModelAnswer({ markdown, className, style }: ModelAnswerProps) {
  /*
    Başlık id'si useId ile üretilir, sabit yazılmaz: sahne geçişi sırasında
    çıkan ve giren panel bir an birlikte DOM'da duruyor (bkz. Stage.tsx) ve
    sabit id o anda iki kez geçiyordu. Yinelenen id'de aria-labelledby'nin
    hangi başlığı gösterdiği belirsiz.
  */
  const titleId = useId();

  // Ayrıştırma saf ve ucuz ama her render'da tekrarlanmasın.
  const blocks = useMemo(() => parseModelAnswer(markdown), [markdown]);

  return (
    <section className={className} style={style} aria-labelledby={titleId}>
      <div className={styles.modelHead}>
        <h3 className={styles.modelTitle} id={titleId}>
          Model cevap
        </h3>
        <span className={styles.modelBadge}>Referans</span>
      </div>

      <div className={styles.blocks}>
        {blocks.map((block, index) => {
          if (block.kind === "code") {
            return <CodeBlock key={index} lang={block.lang} code={block.code} />;
          }
          if (block.kind === "note") {
            return (
              <p key={index} className={styles.note}>
                {/* Giriş cümlesi iki noktasıyla birlikte, satır içinde kalıyor:
                    başlığa çevrilince gövde cümlenin ortasından, küçük
                    harfle başlıyor gibi okunuyordu. */}
                <strong className={styles.noteLead}>{block.lead}:</strong>{" "}
                <Inline text={block.body} />
              </p>
            );
          }
          return (
            <p key={index} className={styles.paragraph}>
              <Inline text={block.text} />
            </p>
          );
        })}
      </div>
    </section>
  );
}
