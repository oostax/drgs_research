import { useState } from "react";
import "./StrategyDashboard.css";

const SOURCE = "/strategy/client-understanding.html";

export function StrategyDashboard() {
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="strategy-dashboard" aria-label="Глубокое понимание клиента">
      {!loaded && (
        <div className="strategy-dashboard-loading" role="status">
          <span className="spinner" />
          <p>Загрузка материалов</p>
        </div>
      )}
      <iframe
        className={`strategy-dashboard-frame${loaded ? " is-ready" : ""}`}
        src={SOURCE}
        title="Глубокое понимание клиента"
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
      />
    </section>
  );
}
