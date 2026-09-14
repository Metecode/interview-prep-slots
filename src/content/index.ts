import { parseQuestionFile } from "../domain/question";
import type { Question } from "../domain/question";
import docker from "./tr/content-docker.json";
import javascript from "./tr/content-javascript.json";
import react from "./tr/content-react.json";
import sql from "./tr/content-sql.json";

/* ------------------------------------------------------------------ */
/* İçerik — repo'dan gelir, her dosya parseQuestionFile ile doğrulanır. */
/* Dosya içi tekrar eden id'yi parseQuestionFile zaten yakalıyor;       */
/* burada yalnızca dosyalar arası çakışma kontrol edilir.               */
/* ------------------------------------------------------------------ */

const FILES: ReadonlyArray<readonly [string, unknown]> = [
  ["tr/content-docker.json", docker],
  ["tr/content-javascript.json", javascript],
  ["tr/content-react.json", react],
  ["tr/content-sql.json", sql],
];

function loadQuestions(): Question[] {
  const questions: Question[] = [];
  const seenIds = new Set<string>();

  for (const [path, raw] of FILES) {
    const file = parseQuestionFile(path, raw);
    for (const question of file.questions) {
      if (seenIds.has(question.id)) {
        throw new Error(`${path}: dosyalar arası tekrar eden id "${question.id}"`);
      }
      seenIds.add(question.id);
      questions.push(question);
    }
  }

  return questions;
}

export const QUESTIONS: Question[] = loadQuestions();
