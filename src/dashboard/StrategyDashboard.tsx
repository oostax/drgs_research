import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./StrategyDashboard.css";

const SOURCE = "/strategy/client-understanding.html";
const views = [
  { label: "Новый формат", short: "Новый формат" },
  { label: "Текущие результаты", short: "Результаты" },
  { label: "Что дальше?", short: "Что дальше?" },
];

export function StrategyNavigation() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "pulse:strategy" && event.data.event === "view") {
        setCurrent(Number(event.data.view) || 0);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  return (
    <div className="model-nav-shell strategy-nav-shell">
      <nav className="model-navigation strategy-navigation" aria-label="Подразделы глубокого понимания клиента">
        {views.map((view, index) => (
          <a
            key={view.label}
            href={`#strategy-${index + 1}`}
            style={{ "--item-index": index } as CSSProperties}
            aria-current={current === index ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setCurrent(index);
              window.dispatchEvent(new CustomEvent("strategy:navigate", { detail: index }));
            }}
          >
            <span className="model-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="model-step-label" data-short={view.short}>{view.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export function StrategyDashboard() {
  const [loaded, setLoaded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const navigate = (event: Event) => {
      const view = (event as CustomEvent<number>).detail;
      frame.current?.contentWindow?.postMessage({ type: "pulse:strategy", command: "view", view }, window.location.origin);
    };
    window.addEventListener("strategy:navigate", navigate);
    return () => window.removeEventListener("strategy:navigate", navigate);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      frame.current?.contentWindow?.postMessage(
        { type: "pulse:strategy", command: event.key === "ArrowRight" ? "next" : "prev" },
        window.location.origin,
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section className="strategy-dashboard" aria-label="Глубокое понимание клиента">
      {!loaded && (
        <div className="strategy-dashboard-loading" role="status">
          <span className="spinner" />
          <p>Загрузка материалов</p>
        </div>
      )}
      <iframe
        ref={frame}
        className={`strategy-dashboard-frame${loaded ? " is-ready" : ""}`}
        src={SOURCE}
        title="Глубокое понимание клиента"
        onLoad={() => {
          setLoaded(true);
          frame.current?.contentWindow?.postMessage({ type: "pulse:strategy", command: "view", view: 0 }, window.location.origin);
        }}
        sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
      />
    </section>
  );
}
