/* ------------------------------------------------------------------ */
/* Model cevap — Markdown'ın kullandığımız kadarını bloklara ayırır     */
/*                                                                     */
/* Şemada modelAnswer Markdown; bütün bir Markdown motoru bağlamak      */
/* yerine içerikte gerçekten geçen üç yapı ayrıştırılıyor: çitli kod    */
/* blokları, giriş cümlesiyle açılan not paragrafları ve düz paragraf.  */
/* Saf katman: DOM yok, React yok.                                      */
/* ------------------------------------------------------------------ */

export type AnswerBlock =
  /** ```lang ... ``` — kod bloğu, kendi kopyala düğmesiyle çizilir. */
  | { kind: "code"; lang: string | null; code: string }
  /** "Her durumda çalışmaz: ..." gibi, giriş cümlesi vurgulanan paragraf. */
  | { kind: "note"; lead: string; body: string }
  | { kind: "text"; text: string };

export type InlineToken =
  | { kind: "plain"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string };

/**
 * Not kutusuna dönüşmek için giriş cümlesinin uzunluk sınırı.
 * Uzun bir cümlenin ortasındaki iki nokta paragrafı kutuya çevirmesin.
 */
const MAX_LEAD_LENGTH = 48;

/** Çitli kod bloğu: açılış çiti, isteğe bağlı dil, gövde, kapanış çiti. */
const FENCE = /^```([a-z0-9+#-]*)\n([\s\S]*?)\n?^```/gim;

/**
 * Markdown metnini sırayla bloklara ayırır. Tanınmayan her şey düz
 * paragraf olarak geçer — ayrıştırıcı hiçbir içeriği yutmaz.
 */
export function parseModelAnswer(markdown: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let cursor = 0;

  // lastIndex paylaşılan regex'te turlar arası taşıyor; her çağrıda sıfırlanır.
  FENCE.lastIndex = 0;

  for (let match = FENCE.exec(markdown); match; match = FENCE.exec(markdown)) {
    pushParagraphs(blocks, markdown.slice(cursor, match.index));
    blocks.push({
      kind: "code",
      lang: match[1] ? match[1] : null,
      code: match[2].replace(/\s+$/, ""),
    });
    cursor = match.index + match[0].length;
  }

  pushParagraphs(blocks, markdown.slice(cursor));
  return blocks;
}

/** Boş satırla ayrılmış parçaları paragraf ya da not bloğu olarak ekler. */
function pushParagraphs(blocks: AnswerBlock[], chunk: string): void {
  for (const raw of chunk.split(/\n{2,}/)) {
    const text = raw.trim();
    if (!text) continue;
    blocks.push(toParagraph(text));
  }
}

/**
 * Paragrafın başında kısa bir giriş cümlesi + iki nokta varsa not bloğu
 * olur. Giriş cümlesi içinde nokta ya da satır başı varsa cümle değil,
 * paragrafın kendisidir — dokunulmaz.
 */
function toParagraph(text: string): AnswerBlock {
  const colon = text.indexOf(":");
  if (colon > 0 && colon <= MAX_LEAD_LENGTH) {
    const lead = text.slice(0, colon).trim();
    const body = text.slice(colon + 1).trim();
    if (body && !/[.\n]/.test(lead)) {
      return { kind: "note", lead, body };
    }
  }
  return { kind: "text", text };
}

/** Satır içi `kod` ve **kalın** parçaları. Geri kalan her şey düz metin. */
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*/g;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;

  INLINE.lastIndex = 0;

  for (let match = INLINE.exec(text); match; match = INLINE.exec(text)) {
    if (match.index > cursor) {
      tokens.push({ kind: "plain", text: text.slice(cursor, match.index) });
    }
    tokens.push(
      match[1] !== undefined
        ? { kind: "code", text: match[1] }
        : { kind: "strong", text: match[2] },
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) tokens.push({ kind: "plain", text: text.slice(cursor) });
  return tokens;
}
