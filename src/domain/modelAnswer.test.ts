import { describe, expect, it } from "vitest";

import { parseInline, parseModelAnswer } from "./modelAnswer";

describe("parseModelAnswer", () => {
  it("düz metni tek paragraf olarak döndürür", () => {
    expect(parseModelAnswer("Tek cümle.")).toEqual([
      { kind: "text", text: "Tek cümle." },
    ]);
  });

  it("boş satırla ayrılmış parçaları ayrı paragraf yapar", () => {
    const blocks = parseModelAnswer("Birinci paragraf.\n\nİkinci paragraf.");
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({ kind: "text", text: "İkinci paragraf." });
  });

  it("çitli kod bloğunu dili ve gövdesiyle ayırır", () => {
    const blocks = parseModelAnswer("Önce.\n\n```bash\ndocker ps\n```\n\nSonra.");
    expect(blocks).toEqual([
      { kind: "text", text: "Önce." },
      { kind: "code", lang: "bash", code: "docker ps" },
      { kind: "text", text: "Sonra." },
    ]);
  });

  it("dili yazılmamış kod bloğunda lang null kalır", () => {
    const blocks = parseModelAnswer("```\nSELECT 1\n```");
    expect(blocks).toEqual([{ kind: "code", lang: null, code: "SELECT 1" }]);
  });

  it("kod bloğu içindeki boş satırlar korunur", () => {
    const blocks = parseModelAnswer("```js\nbir();\n\niki();\n```");
    expect(blocks[0]).toEqual({ kind: "code", lang: "js", code: "bir();\n\niki();" });
  });

  it("kısa giriş cümlesiyle açılan paragrafı not bloğuna çevirir", () => {
    const blocks = parseModelAnswer("Her durumda çalışmaz: varsayılan ağda DNS yok.");
    expect(blocks).toEqual([
      { kind: "note", lead: "Her durumda çalışmaz", body: "varsayılan ağda DNS yok." },
    ]);
  });

  it("giriş cümlesi uzunsa paragrafı bölmez", () => {
    const long = `${"a".repeat(60)}: devamı`;
    expect(parseModelAnswer(long)).toEqual([{ kind: "text", text: long }]);
  });

  it("iki nokta cümle ortasındaysa paragrafı bölmez", () => {
    const text = "Bir cümle bitti. Sonra: devam etti.";
    expect(parseModelAnswer(text)).toEqual([{ kind: "text", text }]);
  });

  it("iki noktadan sonra metin yoksa paragraf olarak kalır", () => {
    expect(parseModelAnswer("Başlık:")).toEqual([{ kind: "text", text: "Başlık:" }]);
  });

  it("art arda çağrıldığında aynı sonucu verir (regex durumu taşmaz)", () => {
    const input = "```sql\nSELECT 1\n```";
    expect(parseModelAnswer(input)).toEqual(parseModelAnswer(input));
  });
});

describe("parseInline", () => {
  it("işaret yoksa tek düz parça döndürür", () => {
    expect(parseInline("sade metin")).toEqual([{ kind: "plain", text: "sade metin" }]);
  });

  it("ters tırnak içini kod olarak ayırır", () => {
    expect(parseInline("port `-p` ile açılır")).toEqual([
      { kind: "plain", text: "port " },
      { kind: "code", text: "-p" },
      { kind: "plain", text: " ile açılır" },
    ]);
  });

  it("çift yıldızı kalın olarak ayırır", () => {
    expect(parseInline("**IP ile** erişir")).toEqual([
      { kind: "strong", text: "IP ile" },
      { kind: "plain", text: " erişir" },
    ]);
  });

  it("art arda çağrıldığında aynı sonucu verir (regex durumu taşmaz)", () => {
    const input = "`a` ve `b`";
    expect(parseInline(input)).toEqual(parseInline(input));
  });
});
