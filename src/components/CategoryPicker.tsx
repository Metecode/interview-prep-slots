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

export function CategoryPicker({ active, disabled, onToggle }: CategoryPickerProps) {
  return (
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
  );
}
