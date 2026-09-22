import { useSyncExternalStore } from "react";

import { getSnapshot, login, logout, subscribe } from "./authClient";
import type { AuthStatus, AuthUser } from "./authClient";

/* ------------------------------------------------------------------ */
/* Oturum durumunu React'e bağlayan tek kanca                          */
/* ------------------------------------------------------------------ */

export type UseAuth = {
  status: AuthStatus;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
};

/**
 * Durum React'in dışında tutuluyor; useSyncExternalStore onu okumanın
 * güvenli yolu. login ve logout modül fonksiyonları olduğu için kimlikleri
 * sabit, bağımlılık dizilerinde sorun çıkarmaz.
 */
export function useAuth(): UseAuth {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { status: state.status, user: state.user, login, logout };
}
