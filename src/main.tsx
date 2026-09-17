import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./dashboard/App";
import "./dashboard/styles.css";
import "./dashboard/readable.css";
import "./dashboard/OverviewPanels.css";
import "./dashboard/OverviewMotion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
