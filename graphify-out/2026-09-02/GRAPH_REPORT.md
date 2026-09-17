# Graph Report - drgs_research  (2026-09-02)

## Corpus Check
- 103 files · ~470,723 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 647 nodes · 987 edges · 71 communities (58 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- src/types.ts
- compilerOptions
- Результаты пилота
- dependencies
- preprocess.py
- fmt
- compilerOptions
- Model Router
- Bounded Rationality
- tsconfig.json
- Circle of Competence
- Cynefin Classification
- Effectuation
- First Principles
- Five Whys Plus
- Jobs to Be Done
- Kepner-Tregoe Analysis
- Lindy Effect
- Map Territory
- Margin of Safety
- Model Combination
- OODA Loop
- Opportunity Cost
- Pre-Mortem Analysis
- Probabilistic Thinking
- Red Team
- Reversibility
- Scientific Method (Hypothesis Differential)
- Second-Order Consequence Chains
- Socratic Questioning
- Steel-Manning
- Systems Mapping and Leverage
- Theory of Constraints
- Thought Experiment
- TRIZ
- Via Negativa
- Design System: Результаты пилота
- src/App.tsx
- filters.ts
- management.ts
- DECISIONS.md
- 01-CONTEXT.md
- REQUIREMENTS.md
- Реестр задач
- PROJECT.md
- Дорожная карта
- STATE.md
- dashboard/App.tsx
- build_dashboard.py
- Контракт данных
- Результаты пилота
- Отчёт сверки — 02.09.2026
- devDependencies
- Сопоставление и расчёты
- Макет OpenDesign
- Три страницы
- Сквозная проверка и документация
- 01-VERIFICATION.md
- 02-CONTEXT.md
- Select.tsx
- Компактность и читаемость — 2 сентября 2026
- check_weekly_sources.py
- useWeekPlayback.test.tsx

## God Nodes (most connected - your core abstractions)
1. `fmt()` - 18 edges
2. `format()` - 17 edges
3. `compilerOptions` - 16 edges
4. `value()` - 15 edges
5. `selectedGroups()` - 14 edges
6. `statusText()` - 13 edges
7. `delta()` - 12 edges
8. `main()` - 11 edges
9. `ImportRules` - 11 edges
10. `MeetingsCard()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Harness()` --calls--> `useWeekPlayback()`  [EXTRACTED]
  src/dashboard/useWeekPlayback.test.tsx → src/dashboard/useWeekPlayback.ts
- `confidenceSummary()` --calls--> `fmt()`  [EXTRACTED]
  src/lib/management.ts → src/lib/format.ts
- `AnalysisControls()` --calls--> `fmt()`  [EXTRACTED]
  src/App.tsx → src/lib/format.ts
- `EvidencePanel()` --calls--> `fmt()`  [EXTRACTED]
  src/App.tsx → src/lib/format.ts
- `App()` --calls--> `pct()`  [EXTRACTED]
  src/App.tsx → src/lib/format.ts

## Import Cycles
- None detected.

## Communities (71 total, 13 thin omitted)

### Community 0 - "src/types.ts"
Cohesion: 0.08
Nodes (26): data, comparisonKeys, data, snapshotPeriods, viewKeys, AnalyticsDataset, AnalyticsViewKey, ComparisonKey (+18 more)

### Community 1 - "compilerOptions"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, ES2022, src/dashboard, src/dashboard/**/*.test.ts, src/dashboard/**/*.test.tsx, src/main.tsx, WebWorker (+18 more)

### Community 2 - "Результаты пилота"
Cohesion: 0.20
Nodes (9): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Product Principles, Product Purpose, Users (+1 more)

### Community 3 - "dependencies"
Cohesion: 0.11
Nodes (19): d3-geo, @number-flow/react, dependencies, d3-geo, @number-flow/react, @radix-ui/react-popover, @radix-ui/react-select, react (+11 more)

### Community 4 - "preprocess.py"
Cohesion: 0.21
Nodes (23): Path, expected_manager(), main(), median(), scoped(), build_funnel_metrics(), compare(), complex_deal_group() (+15 more)

### Community 5 - "fmt"
Cohesion: 0.22
Nodes (16): AnalysisControls(), App(), CompactDiagnostics(), ContributionRows(), expandLabel(), ManagerDetail(), ManagerScatter(), MoodSurveySection() (+8 more)

### Community 6 - "compilerOptions"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, composite, module, moduleResolution, noEmit, skipLibCheck, include

### Community 7 - "Model Router"
Cohesion: 0.25
Nodes (7): Invoking a Model (Skill IDs), Model Router, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 8 - "Bounded Rationality"
Cohesion: 0.29
Nodes (6): Bounded Rationality, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 11 - "Circle of Competence"
Cohesion: 0.29
Nodes (6): Circle of Competence, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 12 - "Cynefin Classification"
Cohesion: 0.29
Nodes (6): Cynefin Classification, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 13 - "Effectuation"
Cohesion: 0.29
Nodes (6): Effectuation, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 14 - "First Principles"
Cohesion: 0.29
Nodes (6): First Principles, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 15 - "Five Whys Plus"
Cohesion: 0.29
Nodes (6): Five Whys Plus, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 16 - "Jobs to Be Done"
Cohesion: 0.29
Nodes (6): Jobs to Be Done, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 17 - "Kepner-Tregoe Analysis"
Cohesion: 0.29
Nodes (6): Kepner-Tregoe Analysis, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 18 - "Lindy Effect"
Cohesion: 0.29
Nodes (6): Lindy Effect, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 19 - "Map Territory"
Cohesion: 0.29
Nodes (6): Map Territory, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 20 - "Margin of Safety"
Cohesion: 0.29
Nodes (6): Margin of Safety, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 21 - "Model Combination"
Cohesion: 0.29
Nodes (6): Model Combination, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 22 - "OODA Loop"
Cohesion: 0.29
Nodes (6): OODA Loop, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 23 - "Opportunity Cost"
Cohesion: 0.29
Nodes (6): Opportunity Cost, Output, Procedure, Verification, When NOT to Use, When to Use

### Community 24 - "Pre-Mortem Analysis"
Cohesion: 0.29
Nodes (6): Output, Pre-Mortem Analysis, Procedure, Verification, When NOT to Use, When to Use

### Community 25 - "Probabilistic Thinking"
Cohesion: 0.29
Nodes (6): Output, Probabilistic Thinking, Procedure, Verification, When NOT to Use, When to Use

### Community 26 - "Red Team"
Cohesion: 0.29
Nodes (6): Output, Procedure, Red Team, Verification, When NOT to Use, When to Use

### Community 27 - "Reversibility"
Cohesion: 0.29
Nodes (6): Output, Procedure, Reversibility, Verification, When NOT to Use, When to Use

### Community 28 - "Scientific Method (Hypothesis Differential)"
Cohesion: 0.29
Nodes (6): Output, Procedure, Scientific Method (Hypothesis Differential), Verification, When NOT to Use, When to Use

### Community 29 - "Second-Order Consequence Chains"
Cohesion: 0.29
Nodes (6): Output, Procedure, Second-Order Consequence Chains, Verification, When NOT to Use, When to Use

### Community 30 - "Socratic Questioning"
Cohesion: 0.29
Nodes (6): Output, Procedure, Socratic Questioning, Verification, When NOT to Use, When to Use

### Community 31 - "Steel-Manning"
Cohesion: 0.29
Nodes (6): Output, Procedure, Steel-Manning, Verification, When NOT to Use, When to Use

### Community 32 - "Systems Mapping and Leverage"
Cohesion: 0.29
Nodes (6): Output, Procedure, Systems Mapping and Leverage, Verification, When NOT to Use, When to Use

### Community 33 - "Theory of Constraints"
Cohesion: 0.29
Nodes (6): Output, Procedure, Theory of Constraints, Verification, When NOT to Use, When to Use

### Community 34 - "Thought Experiment"
Cohesion: 0.29
Nodes (6): Output, Procedure, Thought Experiment, Verification, When NOT to Use, When to Use

### Community 35 - "TRIZ"
Cohesion: 0.29
Nodes (6): Output, Procedure, TRIZ, Verification, When NOT to Use, When to Use

### Community 36 - "Via Negativa"
Cohesion: 0.29
Nodes (6): Output, Procedure, Verification, Via Negativa, When NOT to Use, When to Use

### Community 37 - "Design System: Результаты пилота"
Cohesion: 0.20
Nodes (9): Colors, Components, Design System: Результаты пилота, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes (+1 more)

### Community 38 - "src/App.tsx"
Cohesion: 0.11
Nodes (16): data, DriverView, managerScopeOptions, pairOptions, periodLabel, pilotManagerKeys, productScopeOptions, reliabilityText (+8 more)

### Community 39 - "filters.ts"
Cohesion: 0.29
Nodes (9): EvidencePanel(), managerInScope(), normalizeManager(), registryRecordInView(), snapshotInView(), pilot, record, ProductScope (+1 more)

### Community 41 - "management.ts"
Cohesion: 0.24
Nodes (10): pct(), buildDeepSignals(), buildSignals(), confidenceSummary(), contribution(), AnalyticsView, ComparisonSummary, DeepSignal (+2 more)

### Community 46 - "Реестр задач"
Cohesion: 0.40
Nodes (4): Дальнейшие задачи по источникам, Переработка по пользовательскому аудиту, Реализация, Реестр задач

### Community 51 - "Дорожная карта"
Cohesion: 0.50
Nodes (3): Phase 1: pilot-dashboard, Phase 2: readable-dashboard, Дорожная карта

### Community 52 - "STATE.md"
Cohesion: 0.40
Nodes (4): Current Position, Результат, Следующее действие, Текущая работа

### Community 53 - "dashboard/App.tsx"
Cohesion: 0.06
Nodes (76): Analysis(), App(), Change, Filters(), Link(), mainMetrics, metadata, MethodDialog() (+68 more)

### Community 55 - "build_dashboard.py"
Cohesion: 0.16
Nodes (16): Counter, cell(), colnum(), date(), ident(), inn(), main(), norm() (+8 more)

### Community 57 - "Контракт данных"
Cohesion: 0.25
Nodes (7): Будущие ФОТ и обращения, Встречи и покрытие — уточнение пользователя от 02.09.2026, Контракт данных, Недельная разбивка в карточке продаж, Состав групп — уточнение пользователя от 02.09.2026, Состояния показателя, Текущие источники

### Community 58 - "Результаты пилота"
Cohesion: 0.40
Nodes (4): Запуск, Обновление данных, Результаты пилота, Устройство проекта

### Community 59 - "Отчёт сверки — 02.09.2026"
Cohesion: 0.15
Nodes (11): Источники и определения, Контроль предложений без ФОТ после исправления, Повторная проверка состава — 02.09.2026, Проверка, Число КМ с предложениями, Автоматические проверки, Браузерные сценарии, Источники и состав (+3 more)

### Community 60 - "devDependencies"
Cohesion: 0.07
Nodes (28): jsdom, devDependencies, jsdom, @rollup/rollup-darwin-x64, @testing-library/react, @types/d3-geo, @types/geojson, @types/react (+20 more)

### Community 68 - "Select.tsx"
Cohesion: 0.25
Nodes (5): Props, SearchSelect(), Select(), SelectOption, options

### Community 69 - "Компактность и читаемость — 2 сентября 2026"
Cohesion: 0.50
Nodes (3): Компактность и читаемость — 2 сентября 2026, Применимость показателей по ролям, Ровно шесть показателей на главной

## Knowledge Gaps
- **311 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+306 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `useWeekPlayback()` connect `dashboard/App.tsx` to `useWeekPlayback.test.tsx`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _311 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08374384236453201 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11462450592885376 - nodes in this community are weakly interconnected._