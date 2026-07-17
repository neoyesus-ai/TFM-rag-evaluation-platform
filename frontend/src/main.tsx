import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";
import "./institutional.css";
import "./components/layout/layout.css";
import "./components/dashboard/operational-dashboard.css";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "No se encontró el elemento root.",
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
