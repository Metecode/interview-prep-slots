import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Oturum istemcisi — React bilmez, saf modül                          */
/* ------------------------------------------------------------------ */

/*
  Access token yalnızca bu modülün içindeki bir değişkende yaşar:
  localStorage'a yazılmaz (bkz. CLAUDE.md "localStorage'a JWT yazma"),
  React state'ine de konmaz — render döngüsünün dışında kalsın,
  sekme kapanınca da kaybolsun. Kalıcı olan tek şey refresh cookie'si
  ve onu JavaScript hiç görmüyor (HttpOnly).
*/

const REFRESH_URL = "/api/auth/refresh";
const LOGOUT_URL = "/api/auth/logout";
const LOGIN_URL = "/oauth2/authorization/github";

const authUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
});

/** Backend'in RefreshResponse kaydıyla birebir. */
const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * "unknown" yalnızca açılıştaki ilk yenileme sonuçlanana kadar sürer.
 * Arayüz bu durumda hiçbir şey göstermez: "Giriş yap" yazıp yarım saniye
 * sonra kullanıcı adına dönen bir titreme olmasın.
 */
export type AuthStatus = "unknown" | "anonymous" | "authenticated";

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
};

const ANONYMOUS: AuthState = { status: "anonymous", user: null };

let accessToken: string | null = null;
let state: AuthState = { status: "unknown", user: null };

const listeners = new Set<() => void>();

/* ------------------------------------------------------------------ */
/* Abonelik — useSyncExternalStore ile okunur                          */
/* ------------------------------------------------------------------ */

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Aynı durum için hep aynı nesne döner; useSyncExternalStore kimliğe
 * bakarak yeniden render'a karar veriyor, her çağrıda yeni nesne
 * üretmek sonsuz döngü olurdu.
 */
export function getSnapshot(): AuthState {
  return state;
}

function setState(next: AuthState): void {
  state = next;
  for (const listener of listeners) listener();
}

function setAnonymous(): void {
  accessToken = null;
  // Zaten anonimsek dinleyicileri boşuna uyandırma.
  if (state.status === "anonymous") return;
  setState(ANONYMOUS);
}

/**
 * Yenileme başarısız bitti ama sebebi 401 değil (ağ, 5xx, bozuk yanıt).
 *
 * Açılıştaki ilk yenileme buraya düşerse durum "unknown"da BIRAKILAMAZ:
 * arayüz o durumda boş yer tutucu gösteriyor, yani backend kapalıyken
 * giriş düğmesi hiç görünmezdi. Bilmiyoruz demekle giremiyoruz demek
 * arasında, kullanıcı açısından fark yok — anonim kabul edilir.
 *
 * Oturum zaten açıkken gelen geçici hata ise oturumu düşürmez: elde
 * çalışan bir access token var, kullanıcı çevrimiçi olunca devam eder.
 */
function settleUnknown(): void {
  if (state.status === "unknown") setState(ANONYMOUS);
}

/* ------------------------------------------------------------------ */
/* Yenileme — tek uçuş                                                 */
/* ------------------------------------------------------------------ */

/*
  Aynı anda birden fazla yenileme isteği atmak sunucuda rotasyon yarışına
  dönüşüyor (bkz. CLAUDE.md "Eşzamanlı yenileme yarış durumu"): sunucu
  tarafında satır kilidi ve tolerans penceresi var ama doğru davranış
  istemcinin hiç yarıştırmaması. Devam eden bir istek varsa aynı Promise
  paylaşılır.
*/
let inFlight: Promise<boolean> | null = null;

/**
 * Cookie'deki refresh token'ı yeni bir access token'a çevirir.
 * Dönen değer "oturum açık mı" sorusunun cevabıdır; hata fırlatmaz.
 */
export function refresh(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runRefresh(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(REFRESH_URL, { method: "POST", credentials: "same-origin" });
  } catch (error) {
    // Ağ hatası oturumun bittiği anlamına gelmez: çevrimdışı olabiliriz.
    // Açık bir oturum varsa dokunulmuyor, kullanıcı boş yere çıkmış
    // görünmesin; yalnızca açılıştaki belirsizlik anonime bağlanıyor.
    console.warn("Oturum yenilenemedi (ağ):", error);
    settleUnknown();
    return false;
  }

  if (response.status === 401) {
    setAnonymous();
    return false;
  }

  if (!response.ok) {
    // 5xx de geçici olabilir; ağ hatasıyla aynı kefede.
    // (Vite geliştirme proxy'si backend kapalıyken buraya 500 düşürüyor.)
    console.warn("Oturum yenilenemedi (sunucu):", response.status);
    settleUnknown();
    return false;
  }

  const parsed = refreshResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    console.warn("Yenileme yanıtı şemaya uymuyor:", parsed.error.issues);
    settleUnknown();
    return false;
  }

  accessToken = parsed.data.accessToken;
  setState({ status: "authenticated", user: parsed.data.user });
  return true;
}

/* ------------------------------------------------------------------ */
/* İstek — 401'de bir kez yenileyip bir kez tekrar dener               */
/* ------------------------------------------------------------------ */

/** Çağıranın init nesnesini bozmadan Authorization başlığını ekler. */
function withAuth(init: RequestInit): RequestInit {
  if (!accessToken) return init;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

/**
 * Backend'e giden her istek buradan geçer.
 *
 * Süresi dolmuş bir token'la gelen istek herkese açık uçlarda bile 401
 * alıyor (bkz. CLAUDE.md), o yüzden yenileme her 401'de denenir.
 * Tekrar denenen istek de 401 dönerse yeniden yenilemeye KALKILMAZ:
 * token az önce tazelendiği için sorun token'ın süresi değil, yetki.
 * Aksi halde iki uç birbirini tetikleyip sonsuz döngü kurardı.
 *
 * Not: istek gövdesi tekrar için aynen kullanılıyor. Tek seferlik
 * okunabilen bir gövde (stream) verilirse tekrar başarısız olur;
 * uygulama içinde gövdeler düz metin/JSON.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const first = await fetch(input, withAuth(init));
  if (first.status !== 401) return first;

  const refreshed = await refresh();
  // Yenileme tutmadıysa ilk yanıt neyse o dönülür; 401 ise refresh()
  // durumu zaten anonymous'a çekti.
  if (!refreshed) return first;

  const retry = await fetch(input, withAuth(init));
  if (retry.status === 401) setAnonymous();
  return retry;
}

/* ------------------------------------------------------------------ */
/* Giriş / çıkış                                                       */
/* ------------------------------------------------------------------ */

/**
 * OAuth akışı fetch ile yürümez: GitHub'a gidip geri dönen bir tarayıcı
 * yolculuğu, tam sayfa geçişi gerekiyor.
 */
export function login(): void {
  window.location.assign(LOGIN_URL);
}

/**
 * Sunucudaki refresh token'ı iptal eder ve yerel durumu temizler.
 * İstek düşse bile yerel temizlik yapılır: kullanıcı "çıkış yap" dedi,
 * ekranda hâlâ girmiş görünmesi kabul edilemez.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(LOGOUT_URL, { method: "POST", credentials: "same-origin" });
  } catch (error) {
    console.warn("Çıkış isteği gönderilemedi:", error);
  } finally {
    setAnonymous();
  }
}

/* ------------------------------------------------------------------ */
/* Açılış                                                              */
/* ------------------------------------------------------------------ */

let bootstrapped: Promise<boolean> | null = null;

/**
 * Uygulama açılırken bir kez çağrılır: cookie varsa oturum sessizce
 * geri gelir, yoksa durum anonymous olur. İki kez çağrılsa da (StrictMode)
 * tek istek atılır — hem tek uçuş hem de burada tutulan söz sayesinde.
 */
export function bootstrap(): Promise<boolean> {
  bootstrapped ??= refresh();
  return bootstrapped;
}
