import { useId, useState } from "react";

import { ChevronIcon } from "./ChevronIcon";
import { Collapse } from "./Collapse";
import { CATEGORY_LABELS } from "../content/labels";
import { CATEGORIES } from "../domain/question";
import type { Category } from "../domain/question";
import styles from "./CategoryPicker.module.css";

/* ------------------------------------------------------------------ */
/* Kategori seçimi — çekiliş havuzunu daraltır                         */
/* ------------------------------------------------------------------ */

export type CategoryPickerProps = {
  active: Category[];
  /** true iken hiçbir çip tıklanamaz (ör. makara dönerken). */
  disabled: boolean;
  onToggle: (category: Category) => void;
};

/** Kapalı özet metni: hepsi seçiliyse tek kelime, değilse ilk iki etiket + kalan sayı. */
function summarize(active: Category[]): string {
  if (active.length === CATEGORIES.length) return "tümü seçili";
  if (active.length === 0) return "hiçbiri seçili değil";

  const labels = CATEGORIES.filter((category) => active.includes(category)).map(
    (category) => CATEGORY_LABELS[category],
  );
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

export function CategoryPicker({ active, disabled, onToggle }: CategoryPickerProps) {
  // Kalıcı olması gerekmiyor: her açılışta kapalı başlar.
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className={styles.picker}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {CATEGORIES.length} kategori · {summarize(active)}
        </span>
        <ChevronIcon className={styles.chevron} />
      </button>

      <Collapse open={open} id={listId}>
        <ul className={styles.list}>
          {CATEGORIES.map((category) => {
            const selected = active.includes(category);
            return (
              <li key={category}>
                {/* button: klavye ile Tab/Enter/Space doğal olarak çalışır. */}
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => onToggle(category)}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              </li>
            );
          })}
        </ul>
      </Collapse>
    </div>
  );
}
