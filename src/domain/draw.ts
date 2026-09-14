import { BOX_INTERVALS_DAYS, MAX_BOX } from "./leitner";
import type { QuestionProgress } from "./progress";
import type { Category, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Çekiliş — kazanan animasyondan önce burada belirlenir               */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Hiç sorulmamış sorunun sabit ağırlığı.
 * Kutu 1'deki günü gelmiş sorudan (16) biraz yüksek, ama iyice gecikmiş
 * sorular (48'e kadar) onu geçebilir — yeni içerik kuyruğu tıkamasın.
 */
export const NEW_QUESTION_WEIGHT = 20;

/** Gecikme katsayısının alt ve üst sınırı. */
const MIN_OVERDUE = 1;
const MAX_OVERDUE = 3;

/** Arka arkaya aynı soruyu görmemek için elenen son soru sayısı. */
export const COOLDOWN_SIZE = 3;

/**
 * Sonlu olmayan değer tabana çekilir.
 * NaN sessiz bir zehirdir: `total <= 0` kontrolüne yakalanmaz, kümülatif
 * toplamı bozar ve çekiliş farkına varılmadan hep son soruyu döndürmeye
 * başlar. Bozuk veri en fazla ağırlığı yanlış yapsın, seçimi kilitlemesin.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Sorunun çekilişteki ağırlığı. Büyük sayı = daha sık gelir.
 *
 * `question` şu an hesaba girmiyor; imzada duruyor ki zorluk ya da kategori
 * ağırlığı eklendiğinde çağıran tarafların değişmesi gerekmesin.
 */
export function weightOf(
  _question: Question,
  progress: QuestionProgress | undefined,
  now: Date,
): number {
  if (!progress) return NEW_QUESTION_WEIGHT;

  const interval = BOX_INTERVALS_DAYS[progress.box - 1];
  const elapsedDays =
    (now.getTime() - Date.parse(progress.lastSeenAt)) / MS_PER_DAY;

  // Bozuk tarih bütün seçimi NaN'a çevirmesin diye tabana düşülür.
  const ratio = Number.isFinite(elapsedDays) ? elapsedDays / interval : MIN_OVERDUE;
  const overdue = clamp(ratio, MIN_OVERDUE, MAX_OVERDUE);

  // Küçük kutu = yeni öğrenilen = daha sık. Gecikme bunu 3 katına kadar açar.
  return 2 ** (MAX_BOX - progress.box) * overdue;
}

export type DrawInput = {
  questions: readonly Question[];
  /** questionId -> ilerleme. Eksik anahtar "hiç sorulmadı" demektir. */
  progress: Readonly<Record<string, QuestionProgress>>;
  /**
   * Yalnızca buradaki kategorilerden soru çekilir.
   * Boş dizi "hiçbiri" demektir ve çekiliş null döner — arayüz bu durumda
   * "en az bir kategori seç" diyebilsin. `string` değil `Category`:
   * yanlış yazılmış bir kategori adı havuzu sessizce boşaltmasın.
   */
  activeCategories: readonly Category[];
  /** Eskiden yeniye sıralı geçmiş; yalnızca sondaki COOLDOWN_SIZE tanesi elenir. */
  recentIds: readonly string[];
  now: Date;
  /** [0,1) aralığında sayı döndürür. Math.random çağıranda kalır, burada değil. */
  rng: () => number;
};

/**
 * Aktif kategorilerden, son sorulanları atlayarak ağırlıklı bir soru seçer.
 * Havuz hiçbir şekilde doldurulamıyorsa null döner.
 */
export function drawQuestion({
  questions,
  progress,
  activeCategories,
  recentIds,
  now,
  rng,
}: DrawInput): Question | null {
  const byCategory = questions.filter((q) =>
    activeCategories.includes(q.category),
  );

  const cooling = new Set(recentIds.slice(-COOLDOWN_SIZE));
  const fresh = byCategory.filter((q) => !cooling.has(q.id));

  // Soğutma havuzu tükettiyse tekrar göstermek hiç göstermemekten iyidir.
  const pool = fresh.length > 0 ? fresh : byCategory;
  if (pool.length === 0) return null;

  return pickWeighted(pool, progress, now, rng);
}

/** Ağırlıklı seçim: rng'den gelen tek sayı kümülatif toplamda gezdirilir. */
function pickWeighted(
  pool: readonly Question[],
  progress: Readonly<Record<string, QuestionProgress>>,
  now: Date,
  rng: () => number,
): Question {
  const weights = pool.map((q) => weightOf(q, progress[q.id], now));
  const total = weights.reduce((sum, w) => sum + w, 0);

  // Ağırlıklar bir şekilde sıfırlandıysa bile çekiliş bir soru döndürmeli.
  if (total <= 0) return pool[0];

  let cursor = clamp(rng(), 0, 1) * total;
  for (let i = 0; i < pool.length; i++) {
    cursor -= weights[i];
    if (cursor < 0) return pool[i];
  }

  // rng tam 1 döndürdüyse döngü imleci tüketmeden biter; son soru doğrusu.
  return pool[pool.length - 1];
}
