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

## Backend (`backend/`)

- **Sadece senkron ve AI kotası için.** Uygulama backend'siz tam çalışır
  (bkz. yukarıdaki Local-first kararı). Faz 1'de iş endpoint'i yok, sadece
  çalışan iskelet: `GET /api/health`.
- **Stack.** Spring Boot 4.x, Java 21, Maven (wrapper ile — geliştirme
  Windows'ta olduğu için Maven komutları `.\mvnw.cmd` ile çalıştırılır,
  yerel Maven kurulumuna güvenilmez). Proje Spring Initializr'dan
  kuruldu; artifactId `mulakatslot`, ana sınıf `MulakatslotApplication`.
- **Paket yapısı özelliğe göre.** `com.meteucar.mulakatslot` altında
  `config`, `user`, `question`, `progress`, `health`. `controller/`,
  `service/`, `repository/` gibi katman klasörleri YOK — her paket kendi
  entity/repository/controller'ını (varsa) barındırır. `config` paketi
  henüz boş — adım 3'te security config oraya gelecek.
- **Spring Security yok, Actuator yok.** Security Faz 3'te (adım 3)
  gelecek; şimdi eklemek her endpoint'i kilitler ve iskeleti test etmeyi
  zorlaştırır. `/api/health` Actuator olmadan elle yazıldı.
- **`question.payload` ve `question_progress.attempts` JSONB kalır.**
  `keyConcepts`, `anchors`, `followUps` gibi iç içe alanlara SQL sorgusu
  atmayacağız; bu yüzden ilişkisel olarak parçalanmadılar. `category` ve
  `topic` ayrı kolon çünkü onlarla filtreleyeceğiz. Hibernate 7'de JSONB
  eşlemesi `@JdbcTypeCode(SqlTypes.JSON)` ile yapılır, elle
  serialize/deserialize etme.
- **`spring.jpa.open-in-view: false`.** Varsayılan `true` sessizce
  connection pool'u view render edilene kadar meşgul eder. Kapalı kalsın;
  gerekiyorsa servis katmanında DTO'yu transaction içinde hazırla.
- **Şemayı Flyway yönetir.** `ddl-auto: validate` — Hibernate şema
  üretmez, sadece Flyway migration'larıyla eşleşip eşleşmediğini doğrular.
  Var olan bir migration dosyasına (`V1__...` dahil) asla dokunma; yeni
  değişiklik yeni `V2__...` dosyasıyla gelir. İlk deploy'dan sonra
  uygulanmış migration'a dokunulmaz. Öncesinde düzenlenebilir.
- **Testler gerçek PostgreSQL'e karşı çalışır (Testcontainers).** H2
  KULLANILMAZ — JSONB ve UUID davranışı H2'de farklı, testler yeşil çıkıp
  canlıda patlayabilir. `TestcontainersConfiguration` (`@ServiceConnection`
  ile) ortak Postgres konteynerini sağlar; yeni entegrasyon testleri
  `@Import(TestcontainersConfiguration.class)` ile ona bağlanır — Spring
  Boot bu konteyneri test sınıfları arasında context cache üzerinden
  paylaşır, her sınıf ayrı konteyner açmaz.
- **DB bilgileri ortam değişkeninden gelir**, `application.yml`'e
  hardcode edilmez. Yerelde `docker-compose.yml` için `.env` kullan
  (`.env.example`'dan kopyala); `.env` ve `.idea/` git'e girmez.
- **Spring Boot 4 + Jackson 3.** Jackson core/databind paketleri
  `tools.jackson.*` altında, `com.fasterxml.jackson.*` değil.
  Yalnızca anotasyonlar `com.fasterxml.jackson.annotation`'da kalır.
  `JsonProcessingException` yerine `JacksonException` (unchecked).
  Boot 3 örneklerinden kod kopyalarken paketleri kontrol et.
  Boot 4 modüler yapıda: web, test ve güvenlik otomatik
  yapılandırmaları ayrı modüllere taşındı, paket adları değişti.
  Boot 3 örneğinden gelen her import'u gerçek bağımlılıkta doğrula.
  Özellikle: test anotasyonları (`AutoConfigureMockMvc`
  `org.springframework.boot.webmvc.test.autoconfigure`'da,
  `WebMvcTest` aynı paketde — `org.springframework.boot.test.autoconfigure.web.servlet`
  değil), Spring Security yapılandırması, Jackson.

## Çalışma bölümü

Mimari ve yeni modüller sohbette yazılır. Claude Code mekanik işleri
yapar: kurulum, test düzeltme, tip hataları, lint, dosya taşıma,
içerik dosyalarını şemaya uydurma.
