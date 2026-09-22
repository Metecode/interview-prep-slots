import styles from "./AuthArea.module.css";
import { SignInControl } from "./SignInControl";
import { UserMenu } from "./UserMenu";
import { useAuth } from "../auth/useAuth";

/* ------------------------------------------------------------------ */
/* Üst çubuktaki oturum alanı                                          */
/* ------------------------------------------------------------------ */

/**
 * Üç durumun tek yeri. Giriş bir duvar değil: anonim kullanıcı için de
 * uygulamanın tamamı açık, buradaki düğme yalnızca bir teklif.
 */
export function AuthArea() {
  const { status, user, login, logout } = useAuth();

  // Açılışta yenileme sonuçlanana kadar hiçbir şey gösterilmez: bir an
  // "Giriş yap" yazıp kullanıcı adına dönmek titreme olarak okunuyor.
  // Yer tutucu sabit genişlikte — yazı geldiğinde satır kaymasın.
  if (status === "unknown") {
    return <div className={styles.placeholder} aria-hidden="true" />;
  }

  if (status === "authenticated" && user) {
    return <UserMenu user={user} onLogout={() => void logout()} />;
  }

  return <SignInControl onLogin={login} />;
}
