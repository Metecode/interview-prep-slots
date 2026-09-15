import styles from "./Footer.module.css";

/* ------------------------------------------------------------------ */
/* Alt bilgi — lisans notu ve kaynak koduna bağlantı                    */
/* ------------------------------------------------------------------ */

const REPO_URL = "https://github.com/Metecode/interview-prep-slots";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>Açık kaynak · MIT</span>
        <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </footer>
  );
}
