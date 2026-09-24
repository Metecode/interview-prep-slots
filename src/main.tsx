import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { bootstrap } from "./auth/authClient";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { requestPersistentStorage } from "./platform";
import "./index.css";

/*
  Oturum açılışta bir kez sessizce yenilenir. Render bunu BEKLEMEZ:
  uygulama hesapsız tam çalışıyor, kimlik yalnızca senkron için.
  Beklemek herkesi boş ekranda bir ağ gidiş dönüşü kadar tutardı.
*/
void bootstrap();

// İlerleme yalnızca bu cihazda duruyor olabilir; tarayıcı yer açarken
// silmesin. Sonuç yalnızca loglanır, render beklemez.
void requestPersistentStorage();

const root = document.getElementById("root");
if (!root) throw new Error("#root bulunamadı");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
