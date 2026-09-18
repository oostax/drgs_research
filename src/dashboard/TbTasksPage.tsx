import { Icon } from "./Icons";
import "./SalesModelDeck.css";
import "./TbTasksPage.css";

const tasks = [
  ["target", "Использовать текущие возможности Кредитования СМО", "наращивать маржу"],
  ["reset", "Подготовиться к переходу на новую модель", ""],
  ["process", "Поддерживать трансформационные проекты", ""],
  ["offer", "Вовлекаться в развитие новых компетенций сотрудников", "Академия гибридных лидеров"],
] as const;

export function TbTasksPage() {
  return (
    <section className="tb-tasks-page" aria-label="Задачи ТБ">
      <div className="deck-standard deck-premises tb-tasks-stage">
        <div className="premise-ambient" aria-hidden="true"><i /><i /><i /></div>
        <h2>Задачи ТБ</h2>
        <div className="premise-grid tb-tasks-grid">
          {tasks.map(([icon, title, subtitle]) => (
            <article className="premise-item tb-task-item" key={title}>
              <span className="premise-loop-icon" aria-hidden="true"><Icon name={icon} size={32} /></span>
              <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
