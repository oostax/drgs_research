import { type CSSProperties } from "react";
import { Icon } from "./Icons";
import "./NextStepsSlide.css";

const tasks = [
  ["payroll", "Вводим новую роль: КМ с фокусом на ФОТ"],
  ["hierarchy", "Меняем методику нормирования численности"],
  ["target", "Меняем мотивацию сотрудников"],
  ["process", "Меняем стандарты работ"],
];

function Task({ icon, children, index = 0 }: { icon: string; children: React.ReactNode; index?: number }) {
  return <div className="next-task" style={{ "--task-index": index } as CSSProperties}>
    <span className="next-task-icon"><Icon name={icon} size={28}/></span>
    <p>{children}</p>
  </div>;
}

export function NextStepsSlide() {
  return <section className="next-steps-slide" aria-label="Дальнейшие шаги модели продаж">
    <section className="next-period next-period-preparation" aria-labelledby="next-2026">
      <h1 id="next-2026" className="next-period-title">Задачи до конца <span>2026</span></h1>
      <div className="next-preparation-cards">
        <section className="next-card" aria-labelledby="next-ca">
          <header><span className="next-card-icon"><Icon name="offer" size={28}/></span><h2 id="next-ca">ЦА</h2></header>
          <div className="next-task-list">
            {tasks.map(([icon, text], index) => <Task key={text} icon={icon} index={index}>{text}</Task>)}
          </div>
        </section>
        <section className="next-card" aria-labelledby="next-tb">
          <header><span className="next-card-icon"><Icon name="hierarchy" size={28}/></span><h2 id="next-tb">ТБ <small>(не в пилоте)</small></h2></header>
          <div className="next-task-list">
            <Task icon="reset">Подготовиться к переходу на новую модель: провести моделирование перезакрепления клиентов</Task>
          </div>
        </section>
      </div>
    </section>
    <section className="next-period next-period-launch" aria-labelledby="next-2027">
      <h2 id="next-2027" className="next-period-title">Январь <span>2027</span></h2>
      <section className="next-card" aria-labelledby="next-all">
        <header><span className="next-card-icon"><Icon name="sales" size={28}/></span><h3 id="next-all">Все ТБ</h3></header>
        <div className="next-task-list">
          <Task icon="sales">Переход на новую модель всех ТБ (ГОСБ 1–3 категории)</Task>
        </div>
      </section>
    </section>
  </section>;
}
