<div align="center">

# 🎰 Slot

**Teknik mülakat sorularını slot makinesiyle çalış.**

Kategorini seç, kolu çek, gelen soruyu kendi cümlelerinle cevapla.

[**Canlı Demo**](https://slot.meteucar.com/) · [Hata Bildir](https://github.com/Metecode/slot-study/issues/new) · [Soru Öner](https://github.com/Metecode/slot-study/issues/new)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/Kod-MIT-green)
![License: CC BY-SA 4.0](https://img.shields.io/badge/İçerik-CC%20BY--SA%204.0-lightgrey)

<!-- Ekran görüntüsü / GIF: docs/demo.gif -->
<img src="docs/demo.gif" alt="Slot demo" width="720" />

</div>

---

## Neden?

Teknik mülakatların önemli bir kısmı kısa, kavramsal sorulardan oluşur: *"Virtual DOM nedir?"*, *"Transaction propagation türleri neler?"*, *"Hangi index türlerini biliyorsun?"* Bu soruları okuyarak ezberlemek kolay; sesli ya da yazılı olarak **kendi cümlelerinle** anlatmak ise ayrı bir beceri.

Slot, bu pratiği hızlı ve eğlenceli hale getirmek için yapıldı: rastgele bir soru gelir, sen cevaplarsın, sonra örnek cevapla karşılaştırırsın.

## Nasıl Çalışır?

1. **Kategori seç** — Java/Spring, SQL, frontend, algoritmalar… birden fazlasını birlikte seçebilirsin.
2. **Kolu çek** — Makaralar döner ve bir soru belirir.
3. **Cevabını yaz** — Aklındakini kendi cümlelerinle anlat.
4. **Değerlendir** — Cevabın anahtar kavramlarla eşleştirilir, örnek cevabı görür ve kendini puanlarsın.
5. **Kutunu belirle** — Öz-değerlendirmene göre soru Leitner kutusunda ilerler; zorlandığın sorular daha sık gelir.
6. **İstersen AI'a sor** — *"Kendi yapay zekâna sor"* butonu, soru ve cevabını içeren hazır bir prompt'u panoya kopyalar; dilediğin asistana yapıştırırsın.

## Özellikler

- 🎰 **Slot makinesi animasyonu** — Makaralar ve çekilebilir kol ile soru seçimi
- 🗂️ **Çoklu kategori** — Birden fazla konudan karışık soru
- ✅ **Anahtar kavram eşleşmesi** — Cevabındaki kritik terimleri yakalar
- 🪞 **Öz-değerlendirme** — Örnek cevapla karşılaştırıp kendini puanla
- 📦 **Leitner sistemi** — Aralıklı tekrar; kutuyu otomatik skor değil, sen belirlersin
- 🔒 **Local-first** — Hesap gerekmez, ilerlemen tarayıcında (IndexedDB) tutulur
- 🔄 **İsteğe bağlı senkron** — GitHub ile giriş yaparsan ilerlemen cihazlar arasında senkronlanır
- 🤖 **AI'a bağımlı değil** — Uygulamanın değeri sorular ve örnek cevaplarda; AI değerlendirmesi isteğe bağlı ve senin tercih ettiğin araçla

## Mimari

Slot **local-first** çalışır: uygulama hesapsız ve backend'siz eksiksiz kullanılabilir. Backend yalnızca giriş yapan kullanıcılar için ilerlemenin ikinci bir kopyasını tutar.

```
Tarayıcı (IndexedDB)  ── birincil kopya, her zaman yazılır
        │
        │  senkron: giriş · soru puanlama · sekme kapanışı
        ▼
Spring Boot API  ──►  PostgreSQL  ── ikinci kopya, yalnızca giriş yapanlar
```

- **Çevrimdışı dayanıklılık** — Backend'e ulaşılamazsa senkron sessizce başarısız olur; yerel veri zaten yazılmıştır.
- **Kayıpsız birleştirme** — İki cihazda çalışıldığında kutu ve son görülme için yeni olan kazanır, yazılan cevaplar ise her zaman birleştirilir.
- **Güvenli oturum** — GitHub OAuth; kısa ömürlü JWT access token bellekte, refresh token HttpOnly cookie'de. Rotasyon ve yeniden kullanım tespiti var.

## Teknoloji

| Katman | Araçlar |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Zod |
| Yerel depolama | IndexedDB (idb-keyval) |
| Backend | Spring Boot 4, Java 21, Spring Security (OAuth2 + JWT) |
| Veritabanı | PostgreSQL, Flyway |
| Test | Vitest, JUnit, Testcontainers |
| Altyapı | Docker, GitHub Actions |

## Başlarken

### Yalnızca frontend

Backend olmadan da uygulama eksiksiz çalışır.

**Gereksinimler:** Node.js 20+

```bash
git clone https://github.com/Metecode/slot-study.git
cd slot-study
npm install
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır.

### Backend ile birlikte

**Gereksinimler:** Java 21, Docker

```bash
cp .env.example .env          # veritabanı ve JWT ayarlarını doldur
docker compose up -d          # PostgreSQL
cd backend
./mvnw spring-boot:run        # Windows: .\mvnw.cmd spring-boot:run
```

Vite, `/api` isteklerini `localhost:8080`'e proxy'ler; frontend'i ayrıca yapılandırmana gerek yok.

## Yol Haritası

- [x] **Faz 1** — Local-first web uygulaması, slot mekaniği, anahtar kavram eşleşmesi
- [x] **Faz 2** — GitHub ile giriş, cihazlar arası ilerleme senkronu, kendi sunucusunda yayın
- [ ] Android ve iOS uygulamaları

## Katkıda Bulunma

En değerli katkı **yeni sorular ve daha iyi örnek cevaplar**. Bir soru önermek, hatalı bir cevabı düzeltmek ya da yeni kategori eklemek için issue açabilir veya pull request gönderebilirsin.

1. Repoyu fork'la
2. Yeni bir dal aç: `git checkout -b soru/redis-eviction`
3. Değişikliklerini commit'le
4. Pull request aç

## Lisans

Bu proje iki ayrı lisans altındadır:

- **Kaynak kod** — [MIT](LICENSE)
- **Soru ve cevap içeriği** (`src/content/`) — [CC BY-SA 4.0](src/content/LICENSE)

İçeriği kullanabilir, değiştirebilir ve paylaşabilirsin; kaynak göstermen ve türetilen içeriği aynı lisansla paylaşman yeterli.

---

<div align="center">

[Mete Uçar](https://meteucar.com) tarafından geliştirildi.

İşine yaradıysa ⭐ vererek destek olabilirsin.

</div>