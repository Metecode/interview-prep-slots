import { useId, useState } from "react";

import { ChevronIcon } from "./ChevronIcon";
import { Collapse } from "./Collapse";
import { CATEGORY_LABELS } from "../content/labels";
import type { Category } from "../domain/question";
import styles from "./CategoryPicker.module.css";

/* ------------------------------------------------------------------ */
/* Kategori seçimi — çekiliş havuzunu daraltır                         */
/* ------------------------------------------------------------------ */

export type CategoryPickerProps = {
  /** Gösterilecek kategoriler. İçinde soru olmayan kategori buraya hiç gelmez. */
  categories: Category[];
  active: Category[];
  /** true iken hiçbir çip tıklanamaz (ör. makara dönerken). */
  disabled: boolean;
  onToggle: (category: Category) => void;
  /** Tümünü seç / tümünü kaldır arasında geçiş yapar. */
  onToggleAll: () => void;
};

/**
 * Kapalı özet metni: hepsi seçiliyse tek kelime, değilse ilk iki etiket +
 * kalan sayı. Sayım yalnızca görünen kategoriler üzerinden yapılır —
 * seçimde kalmış ama içeriği olmayan bir kategori özeti şişirmesin.
 */
function summarize(active: Category[], categories: Category[]): string {
  const shown = categories.filter((category) => active.includes(category));
  if (shown.length === categories.length && categories.length > 0) return "tümü seçili";
  if (shown.length === 0) return "hiçbiri seçili değil";

  const labels = shown.map((category) => CATEGORY_LABELS[category]);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

export function CategoryPicker({
  categories,
  active,
  disabled,
  onToggle,
  onToggleAll,
}: CategoryPickerProps) {
  // Kalıcı olması gerekmiyor: her açılışta kapalı başlar.
  const [open, setOpen] = useState(false);
  const listId = useId();
  // Uzunluk karşılaştırması yetmez: seçimde, artık gösterilmeyen bir
  // kategori kalmış olabilir.
  const allSelected =
    categories.length > 0 && categories.every((category) => active.includes(category));

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.summary}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            {categories.length} kategori · {summarize(active, categories)}
          </span>
          <ChevronIcon className={styles.chevron} />
        </button>

        {/* Açık/kapalı fark etmeden erişilebilir olsun diye özet
            düğmesinin yanında, koleksiyonun içine gömülü değil. */}
        <button
          type="button"
          className={styles.selectAll}
          disabled={disabled}
          onClick={onToggleAll}
        >
          {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
        </button>
      </div>

      <Collapse open={open} id={listId}>
        <ul className={styles.list}>
          {categories.map((category) => {
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
