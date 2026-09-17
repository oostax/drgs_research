# Graph Report - drgs_research  (2026-08-31)

## Corpus Check
- 50 files · ~447,436 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 501 edges · 38 communities (37 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- types.ts
- compilerOptions
- Product
- package.json
- preprocess.py
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
- Design System — Пульс продаж
- App.tsx

## God Nodes (most connected - your core abstractions)
1. `fmt()` - 18 edges
2. `compilerOptions` - 16 edges
3. `main()` - 10 edges
4. `App()` - 9 edges
5. `pctPlain()` - 9 edges
6. `Product` - 9 edges
7. `normalize_manager()` - 8 edges
8. `read_offers()` - 7 edges
9. `signed()` - 7 edges
10. `share()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `confidenceSummary()` --calls--> `fmt()`  [EXTRACTED]
  src/lib/management.ts → src/lib/format.ts
- `AnalysisControls()` --calls--> `fmt()`  [EXTRACTED]
  src/App.tsx → src/lib/format.ts
- `EvidencePanel()` --calls--> `fmt()`  [EXTRACTED]
  src/App.tsx → src/lib/format.ts
- `App()` --calls--> `pct()`  [EXTRACTED]
  src/App.tsx → src/lib/format.ts
- `PeriodVessels()` --calls--> `fmt()`  [EXTRACTED]
  src/components/PeriodVessels.tsx → src/lib/format.ts

## Import Cycles
- None detected.

## Communities (38 total, 1 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.06
Nodes (45): EvidencePanel(), data, comparisonKeys, data, snapshotPeriods, viewKeys, managerInScope(), normalizeManager() (+37 more)

### Community 1 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2022, src, WebWorker, compilerOptions, allowJs, allowSyntheticDefaultImports (+14 more)

### Community 2 - "Product"
Cohesion: 0.20
Nodes (9): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Product, Product Principles, Product Purpose (+1 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (32): jsdom, dependencies, react, react-dom, typescript, vite, @vitejs/plugin-react, devDependencies (+24 more)

### Community 4 - "preprocess.py"
Cohesion: 0.19
Nodes (24): Counter, Path, expected_manager(), main(), median(), scoped(), build_funnel_metrics(), compare() (+16 more)

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

### Community 37 - "Design System — Пульс продаж"
Cohesion: 0.25
Nodes (7): Color, Components, Design System — Пульс продаж, Direction, Information density, Motion, Typography and layout

### Community 38 - "App.tsx"
Cohesion: 0.09
Nodes (32): AnalysisControls(), App(), CompactDiagnostics(), ContributionRows(), data, DriverView, expandLabel(), ManagerDetail() (+24 more)

## Knowledge Gaps
- **232 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+227 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fmt()` connect `App.tsx` to `types.ts`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _232 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06196078431372549 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09191583610188261 - nodes in this community are weakly interconnected._