# Mülakat Slot

Teknik mülakatlardaki teorik/kategorik soruları çalışmak için açık kaynak
web uygulaması. Slot makinesi mekaniğiyle rastgele soru gelir, kullanıcı
cevabını yazar, kavram bazlı geri bildirim alır.

## Mimari kararlar — bunları değiştirme, önce sor

- **Local-first.** Uygulama hesapsız ve backend'siz tam çalışır. Giriş
  yalnızca senkron ve AI kotası için. Faz 1'de backend yok.
- **Değerlendirme katmanlı.** v1: alias kelime eşleşmesi + kullanıcının
  öz-değerlendirmesi. İsteğe bağlı: AI (Faz 3, henüz yok).
  AI hiçbir zaman zorunlu yol değil.
  Tarayıcıda embedding ile kavram eşleştirme denendi ve çıkarıldı:
  e5-small ile alakasız çapalar 0.88, doğru kavramlar 0.88-0.91 skor
  alıyordu — Türkçede eşik koyacak kadar ayrışmıyor. Kod silinmedi,
  `domain/evaluate.ts`'te kullanılmıyor olarak duruyor; Faz 3'te AI
  rubriği için benzer bir skorlama/eşikleme yapısı gerekecek.
- **Kutuyu kullanıcı belirler.** Leitner kutusu öz-değerlendirmeyle
  güncellenir, AI skoruyla değil.
- **Kazanan animasyondan önce belirlenir.** Soru ağırlıklı çekilişle
  seçilir, makara animasyonu yalnızca sonucu gösterir. Animasyonun
  sonucu belirlemesine izin veren bir değişiklik ağırlıklandırmayı bozar.
- **`src/domain/` saf kalır.** React importu yok, DOM erişimi yok,
  yan etki yok. Test edilebilirliği ve ileride paylaşılabilirliği buna bağlı.
- **İçerik ve ilerleme ayrı.** Sorular repo'dan gelir ve değişir;
  ilerleme kullanıcınındır ve kalır. Tek tipte birleştirme.

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · Zod · Vitest · idb-keyval
shadcn/ui bileşenleri ihtiyaç oldukça tek tek eklenir, toplu kurulmaz.

## Kod kuralları

- Okunabilirlik zekice kısaltmadan önce gelir. Bu repo'ya başkaları
  katkı verecek.
- Türkçe yorum yazılır, kod ve tip isimleri İngilizce.
- Bir dosya tek bir işi yapar. 200 satırı aşan modül bölünmeye aday.
- Zod şemaları tek kaynak; tipler `z.infer` ile türetilir, elle yazılmaz.
- Yeni bağımlılık eklemeden önce sor.
- `domain/` içindeki her saf fonksiyonun Vitest testi olur.

## Erişilebilirlik ve hareket

- Her etkileşimli öğe klavyeyle kullanılabilir olmalı.
- `prefers-reduced-motion` her animasyonda kontrol edilir.
- Animasyon atlanabilir olmalı; kullanıcı 40. soruda beklemek istemez.

## Bu repo'da yapılmayacaklar

- Three.js veya WebGL. Makine CSS 3D ve SVG ile çizilir.
- localStorage'a JWT yazma.
- Soru içeriğini başka sitelerden kopyalama. İçerik özgün yazılır,
  `source` alanında türetildiği konu belirtilir.

## Çalışma bölümü

Mimari ve yeni modüller sohbette yazılır. Claude Code mekanik işleri
yapar: kurulum, test düzeltme, tip hataları, lint, dosya taşıma,
içerik dosyalarını şemaya uydurma.
