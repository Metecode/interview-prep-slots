import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import styles from "./ErrorBoundary.module.css";

/* ------------------------------------------------------------------ */
/* Kaçak hata ağı — render sırasında bir yer patlarsa ekran boş kalmasın */
/*                                                                     */
/* Yalnızca render/lifecycle hatalarını yakalar (React kısıtı); olay    */
/* işleyicilerdeki hatalar buraya düşmez, onlar zaten try/catch ile     */
/* kendi yerinde ele alınıyor (bkz. storage/db.ts).                     */
/* ------------------------------------------------------------------ */

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Yakalanmamış render hatası:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={styles.wrap} role="alert">
        <p className={styles.text}>Bir şeyler ters gitti, ekran açılamadı.</p>
        <button
          type="button"
          className={styles.button}
          onClick={() => window.location.reload()}
        >
          Sayfayı yenile
        </button>
      </div>
    );
  }
}
