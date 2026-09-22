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
  `config`, `auth`, `user`, `question`, `progress`, `health`. `controller/`,
  `service/`, `repository/` gibi katman klasörleri YOK — her paket kendi
  entity/repository/controller'ını (varsa) barındırır. `config` yalnızca
  çapraz kesen yapılandırmayı tutar (güvenlik zincirleri, JWT anahtarı);
  token üretimi ve uçları `auth` paketinde.
- **Actuator yok.** `/api/health` Actuator olmadan elle yazıldı.
  Spring Security adım 3'te geldi (bkz. Kimlik doğrulama); eklenirken
  açık uçlar tek tek `permitAll` ile sayıldı, varsayılan "hepsi kilitli"
  bırakılmadı.
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
  Starter adları da: `spring-boot-starter-web` yerine `-webmvc`,
  oauth2 starter'ları `spring-boot-starter-security-oauth2-client` ve
  `-security-oauth2-resource-server` (öneksiz eski adlar deprecated).
  Boot 3 örneğinden gelen her import'u gerçek bağımlılıkta doğrula.
  Özellikle: test anotasyonları (`AutoConfigureMockMvc`
  `org.springframework.boot.webmvc.test.autoconfigure`'da,
  `WebMvcTest` aynı paketde — `org.springframework.boot.test.autoconfigure.web.servlet`
  değil), Spring Security yapılandırması, Jackson.

## Kimlik doğrulama

- **İki tür token, iki ayrı yer.** Access token JWT'dir (HS256, 15 dakika,
  `iss=mulakat-slot`, `sub` kullanıcının UUID'si) ve yalnızca yanıt
  gövdesinde döner; frontend onu bellekte tutar. Refresh token 32 bayt
  SecureRandom'dur (30 gün) ve yalnızca cookie'de yaşar.
- **Access token neden cookie'de değil.** Tarayıcı cookie'yi her isteğe
  kendiliğinden ekler; başka bir sitenin tetiklediği istek de kimlik
  taşır. Authorization başlığını tarayıcı kendiliğinden eklemediği için
  bu yolda CSRF mümkün değil — `/api/**` için CSRF'i bu yüzden kapattık.
  Cookie ile çalışan tek uçlar `/api/auth/refresh` ve `/api/auth/logout`;
  onları refresh cookie'sindeki `SameSite=Strict` koruyor.
- **Refresh cookie:** HttpOnly, Secure, SameSite=Strict, Path=/api/auth.
  Secure yalnızca yerel geliştirmede `COOKIE_SECURE=false` ile kapatılır.
- **Düz refresh token asla saklanmaz.** Veritabanında yalnızca SHA-256
  özeti var. Token 32 bayt rastgele veri olduğu için yavaş bir KDF
  (bcrypt/argon2) gerekmiyor; sözlük saldırısı söz konusu değil.
- **Rotasyon ve yeniden kullanım tespiti.** Her yenilemede eski token
  iptal edilir, yenisi verilir. İptal edilmiş bir token tekrar gelirse bu
  kopyalanma işaretidir: o kullanıcının TÜM token'ları iptal edilir,
  meşru oturum da dahil — hangisinin saldırganda olduğunu bilmiyoruz.
  `RefreshTokenService.rotate` bu yüzden `noRollbackFor` ile işaretli;
  varsayılan davranışta hata transaction'ı geri alır ve iptaller kaybolurdu.
  İptal edilen satır silinmez, tespit iptal kaydının kalmasına bağlı.
- **Eşzamanlı yenileme yarış durumu.** Refresh cookie'si tarayıcının tüm
  sekmeleri arasında paylaşılıyor; iki sekme (ya da React StrictMode'un
  çift efekti) aynı anda yenileyebiliyor. Naif kurgu ya iki geçerli token
  üretiyordu ya da ikinci istek iptal edilmiş token görüp meşru kullanıcının
  tüm oturumlarını kapatıyordu. Üç parçalı çözüm:
  1. **Satır kilidi.** `rotate` token'ı
     `findForRotationByTokenHash` ile `PESSIMISTIC_WRITE` alarak okur,
     eşzamanlı rotasyonlar sıraya girer. Çıkış ve diğer okumalar kilitsiz.
  2. **İptal sebebi.** `refresh_token.revoked_reason` (`rotated`, `logout`,
     `reuse_detected`). Rotasyon normal akışın parçası, diğerleri değil.
  3. **Tolerans penceresi.** `REUSE_GRACE` = 10 saniye. Sebebi `rotated`
     olan bir iptal bu pencerede tekrar gelirse eşzamanlı istek sayılır:
     toplu iptal yok, sadece 401, log `debug`. İkinci istek tekrar
     denediğinde cookie'de birincinin yazdığı yeni token var, kayıp yok.
     Pencere dışındaki ya da sebebi `logout`/`reuse_detected` olan her
     tekrar gerçek yeniden kullanımdır: toplu iptal, 401, log `warn`.
  Frontend tarafında adım 6'da refresh çağrıları ayrıca tek uçuşa
  indirilecek (aynı anda en fazla bir istek, diğerleri onu bekler);
  buradaki sunucu tarafı önlem o olmadığında da doğru davranmak için.
- **Zaman bir bağımlılık.** `Clock` bean'i (`ClockConfig`) enjekte edilir,
  `OffsetDateTime.now()` doğrudan çağrılmaz. Tolerans penceresi saniyelerle
  ölçülüyor; testler gerçek zamanı bekleyemez.
- **Temizlik işi.** `RefreshTokenCleanupJob` günde bir, süresi dolalı 7
  günü geçmiş satırları siler. İptal edilmiş satırlar hemen silinmez —
  yeniden kullanım tespiti o kayda bakıyor.
- **Kutuyu kullanıcı belirler kararının karşılığı:** kimlik yalnızca
  senkron içindir. Uygulama hesapsız tam çalışır; `GET /api/health` ve
  `GET /api/questions` token istemez.
- **401'de yönlendirme yok.** Spring'in varsayılanı login sayfasına
  yönlendirmek; bir API'de bu fetch tarafında sessiz hataya dönüşüyor.
  Her yerde `{ "error": "unauthorized" }` dönülür
  (`JsonAuthenticationEntryPoint`).
- **İki filtre zinciri, iki oturum modeli.** `/oauth2/**` ve `/login/**`
  zincirinde session var, çünkü OAuth state/PKCE iki istek arasında
  saklanmak zorunda. Başarı anında success handler session'ı kapatır.
  Diğer her şey STATELESS.
- **Geliştirmede tek origin.** Vite `/api`, `/oauth2`, `/login` yollarını
  8080'e proxy'ler ve `changeOrigin: false` bırakır: Host başlığı
  `localhost:5173` kalsın ki Spring GitHub'a gönderdiği `redirect_uri`'yi
  o adresle üretsin. Backend'de bunun karşılığı
  `server.forward-headers-strategy: framework`. Farklı portlar tarayıcı
  için iki ayrı site olurdu ve SameSite=Strict cookie gönderilmezdi.
- **E-posta alınmaz.** GitHub kapsamı `read:user`; eşleştirme `github_id`
  üzerinden yapılır çünkü kullanıcı adı değişebilir, sayısal kimlik
  değişmez. Her girişte kullanıcı adı tazelenir.
- **Kısa `JWT_SECRET` ile uygulama açılmaz.** En az 32 bayt şart;
  kontrol `JwtConfig`'te, sessizce zayıf imzaya düşmek yerine açılış durur.
- **`iss` doğrulanır.** Decoder `JwtValidators.createDefaultWithIssuer`
  ile `mulakat-slot` şartını koyar ve algoritma HS256'ya sabitlenmiştir.
  Aynı anahtarı kullanan başka bir servisin ürettiği token kabul edilmez.
- **`/error` herkese açık.** Bir uç hata verdiğinde konteyner isteği
  `/error`'a ERROR dispatch'iyle iletir ve güvenlik zinciri bunu da
  değerlendirir. Kapalı bırakılırsa herkese açık bir ucun 404'ü ya da
  500'ü 401'e dönüşür ve gerçek hata kaybolur.
- **Süresi dolmuş Bearer başlığı herkese açık uçlarda da 401 döndürür.**
  Authorization başlığı varsa doğrulama filtresi onu denemek zorunda ve
  başarısızlık yetkilendirme kurallarından önce gelir; `permitAll` devreye
  girmez. Yani `GET /api/questions` başlıksız 200, süresi dolmuş başlıkla
  401. Frontend 401 gördüğünde `/api/auth/refresh` ile yenileyip isteği
  bir kez tekrarlamalı (adım 6).
- **Bilinmeyen yollar da kimlik ister.** `anyRequest().authenticated()`
  bilinçli: token'sız bir istek olmayan bir uca gittiğinde 404 değil 401
  alır, böylece hangi uçların var olduğu sızmaz. 404'ü görmek için
  geçerli token gerekir.

## İlerleme senkronu

- **IndexedDB birincil, sunucu ikinci kopya.** Local-first kararının
  karşılığı: backend erişilemezken uygulama tam çalışır, senkron sessizce
  başarısız olur. `GET /api/progress`, `PUT /api/progress` (kısmi liste,
  tam değişim değil) ve `POST /api/progress/merge` (ilk girişte bir kez,
  birleşmiş tam sonucu döner).
- **box ve lastSeenAt için yeni kazanır, attempts HER ZAMAN birleşir.**
  attempts kullanıcının yazdığı cevapları tutuyor; en değerli veri o.
  "Eski kayıt" diye atılsaydı iki cihazda çalışan biri denemelerini
  kalıcı olarak kaybederdi. Birleştirme `at` alanına göre tekilleştirir,
  sıralar ve son `MAX_ATTEMPTS` tanesini tutar; `at`'i olmayan deneme
  atlanır (tekilleştirme de sıralama da ona dayanıyor). `at`,
  `Date#toISOString()` ile yazıldığı için sözlük sırası zaman sırasıdır.
- **Üç sayaç.** `applied` box+lastSeenAt yazıldı, `merged` kayıt eskiydi
  ama geçmiş birleşti, `ignored` hiçbir şey değişmedi. Üçü de normal
  sonuç, hata değil.
- **Geçersiz kayıt 400 değil, atlanan kayıttır.** Tek bozuk kayıt tüm
  senkronu düşürmesin. Bilinmeyen `questionId` de atlanır (içerik
  sürümleri arasında fark olabilir), sayısı loglanır. `lastSeenAt` bu
  yüzden DTO'da `String`: Jackson ayrıştırsaydı bozuk bir tarih tüm
  isteği 400'e çevirirdi. Şimdiden 1 günden fazla ileri tarihler
  reddedilir — istemci saati yanlışsa sunucudaki doğruyu ezmesin.
- **Yanıtta `lastSeenAt` UTC.** `toInstant().toString()` ile yazılır;
  sürücünün döndürdüğü yerel offset (`+03:00`) Zod'un `.datetime()`
  şemasından geçmez.
- **Kilit ilerleme satırında değil, `app_user` satırında.** Senkron yeni
  satır da ekliyor ve var olmayan satır kilitlenemez: iki sekme aynı
  soruyu ilk kez aynı anda gönderdiğinde satır kilidi hiçbir şeyi
  kilitlemez, ikisi de INSERT eder ve biri birincil anahtar çakışmasıyla
  düşer. `AppUserRepository.findForUpdateById` PESSIMISTIC_WRITE alır,
  kullanıcı başına senkronlar sıraya girer. "İdempotent, kilide gerek
  yok" yalnızca AYNI veri için doğruydu.
- **Karar ile yazma ayrı.** `ProgressMerger` saf: veritabanı, entity,
  repository ve Spring bilmez, yalnızca hangi durumun kazanacağına karar
  verir. `ProgressSyncService` transaction, kilit, okuma ve entity'ye
  yazmayı üstlenir. Birleştirme kuralları bu yüzden Testcontainers'sız
  test ediliyor (`ProgressMergerTest`); uçlar ve eşzamanlılık
  Testcontainers'ta kalıyor.
- **Yeni satır `entityManager.persist` ile girer.** Mevcut satırlar dirty
  checking ile güncelleniyor; `repository.save` ile karışık iki yaklaşım
  olmasın diye yeni satır da persistence context'e bırakılır, yazma anını
  flush belirler.
- **Frontend kuyruk TUTMAZ.** Hata durumunda sessiz kalınır: yerel veri
  zaten yazıldı, bir sonraki senkron `lastSeenAt` ile yakalar. Kuyruk
  tutulsaydı çevrimdışı kullanıcının kuyruğu sınırsız büyürdü.
  Zamanlayıcıyla periyodik senkron yok; üç tetik var: giriş (bir kez
  merge), RATE (tek soru) ve `visibilitychange: hidden`. Misafirde hiç
  istek atılmaz.
- **"Bir kez birleştir" güvencesi modül seviyesinde**, hook'ta değil —
  StrictMode efektleri iki kez çalıştırıyor (`authClient.bootstrap` da
  aynı sebeple orada). Yan faydası: React test kütüphanesi olmadan test
  edilebiliyor.
- **Merge sonucu yerele `{ ...local, ...merged }` yazılır.** Sunucu
  tanımadığı `questionId`'leri atlıyor; dönen listeyi olduğu gibi
  yazsaydık o sorulara ait yerel ilerleme silinirdi. Sunucunun bildiği
  her kayıt zaten yanıtta olduğu için üstte o kazanır.
- **Senkron oturuma yazılır, doğrudan diske değil.** `SYNC_PROGRESS`
  reducer eylemiyle; IndexedDB'ye yazmayı App'teki mevcut efekt zaten
  üstleniyor, doğrudan yazsaydı bir sonraki render onu bellekteki eski
  haliyle ezerdi.
- **Arayüzde senkron göstergesi YOK.** Tasarım turunda eklenecek.

## Çalışma bölümü

Mimari ve yeni modüller sohbette yazılır. Claude Code mekanik işleri
yapar: kurulum, test düzeltme, tip hataları, lint, dosya taşıma,
içerik dosyalarını şemaya uydurma.
