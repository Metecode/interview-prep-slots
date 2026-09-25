import { useRef, useState } from "react";

import styles from "./AuthArea.module.css";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
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
  const { status, user, reachable, login, logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const signInButtonRef = useRef<HTMLButtonElement>(null);

  // Silme başarılıysa kullanıcı menüsü artık yok; odak onun yerine gelen
  // "Giriş yap"a taşınır, body'ye düşmesin.
  function handleDeleteClose(deleted: boolean) {
    setDeleteOpen(false);
    if (deleted) signInButtonRef.current?.focus();
  }

  return (
    <>
      {renderStatus()}
      {/* Oturum dallarının dışında: silme başarılı olunca durum anonime
          döner, diyalog sonucu gösterene kadar yerinde kalmalı. */}
      <DeleteAccountDialog open={deleteOpen} onClose={handleDeleteClose} />
    </>
  );

  function renderStatus() {
    // Açılışta yenileme sonuçlanana kadar hiçbir şey gösterilmez: bir an
    // "Giriş yap" yazıp kullanıcı adına dönmek titreme olarak okunuyor.
    // Yer tutucu sabit genişlikte — yazı geldiğinde satır kaymasın.
    if (status === "unknown") {
      return <div className={styles.placeholder} aria-hidden="true" />;
    }

    if (status === "authenticated" && user) {
      return <UserMenu user={user} onLogout={() => void logout()} onDeleteAccount={() => setDeleteOpen(true)} />;
    }

    // Backend kapalıyken de düğme görünür: kullanıcı neyin çalışmadığını
    // görmeli, düğmenin kaybolması "böyle bir özellik yok" gibi okunur.
    return <SignInControl offline={!reachable} onLogin={login} buttonRef={signInButtonRef} />;
  }
}
