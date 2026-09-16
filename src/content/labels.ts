import type { Category } from "../domain/question";

/* ------------------------------------------------------------------ */
/* Kategori görünen adları — makara etiketleri burada tutulur          */
/* ------------------------------------------------------------------ */

export const CATEGORY_LABELS: Record<Category, string> = {
  "java-spring": "Java/Spring",
  javascript: "JavaScript",
  sql: "SQL",
  react: "React",
  koleksiyonlar: "Koleksiyonlar",
  algoritma: "Algoritma",
  "tasarim-kaliplari": "Tasarım Kalıpları",
  "kafka-redis": "Kafka/Redis",
  docker: "Docker",
  dotnet: ".NET",
  cybersecurity: "Siber Güvenlik",
};
