---
ontology: true
type: roadmap
status: completed
domain: pilot-analytics
summary: Четыре завершённых этапа реализации
tags: [gsd, dashboard]
related: [../README, REQUIREMENTS, ../docs/VERIFICATION]
relatedTo: [phases/03-appeals-payroll/03-01-PLAN, ../docs/SUPPLEMENTAL_ANALYSIS]
---

# Дорожная карта

## Phase 1: pilot-dashboard

**Goal:** Три связанные страницы на проверенных агрегатах.
**Status:** Complete with documented source limitations
**Requirements:** DATA-01, DATA-02, DATA-03, CALC-01, CALC-02, CALC-03, UI-01, UI-02, UI-03, QA-01

- [x] 01-01-PLAN.md — Сопоставление и расчёты.
- [x] 01-02-PLAN.md — Макет OpenDesign.
- [x] 01-03-PLAN.md — Три страницы.
- [x] 01-04-PLAN.md — Сквозная проверка и документация.

Результаты каждого этапа находятся в phases/01-pilot-dashboard/01-0N-SUMMARY.md. Критерий первой версии выполнен: работающий интерфейс, воспроизводимая подготовка и отчёт сверки с явными ограничениями.

Получение будущих источников и уточнение истории продолжаются отдельными задачами качества данных, перечисленными в TASKS.md.

## Phase 2: readable-dashboard

**Status:** In Progress
**Goal:** Читаемые показатели и постоянно доступные параметры без наложений.
**Requirements:** UI-04, UI-05, UI-06

- [ ] 02-01-PLAN.md — фильтры, графики, анимации и сквозная проверка.

## Phase 3: appeals-payroll

**Status:** Data adapter implemented; UI pending
**Goal:** Добавить квартальные обращения по ТБ и фактические ФОТ/получателей без искажения фильтров и полноты периодов.

- [ ] 03-01-PLAN.md — профиль источников, определения, прямые чарты Fikri, реализация и проверка.

Анализ и квартальный адаптер выполнены 03.09.2026: docs/SUPPLEMENTAL_ANALYSIS.md. Две пары алиасов ГОСБ объяснили все расхождения пилота, восстановлены связи со сведениями о сотрудниках. Год не блокирует квартальную группировку d. 15 тестов пройдены; пропуски сохраняются. Подключение карточек и оригинальной графики Fikri ещё не завершено. Незавершённая Phase 2 сохранена отдельно.
