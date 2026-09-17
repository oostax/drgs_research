import fs from 'node:fs';
function replace(file, before, after, count = 1) {
  const path = `src/dashboard/${file}`;
  const text = fs.readFileSync(path, 'utf8');
  if (text.includes(after)) return;
  const actual = text.split(before).length - 1;
  if (actual !== count) throw new Error(`${file}: expected ${count} matching anchors, found ${actual}`);
  fs.writeFileSync(path, text.split(before).join(after));
}
function prepend(file, text) {
  const path = `src/dashboard/${file}`;
  const old = fs.readFileSync(path, 'utf8');
  if (!old.includes(text.trim())) fs.writeFileSync(path, text + old);
}
replace('types.ts', 'export type Context = {', 'export type AcademyView = "essence" | "results" | "next";\nexport type Context = {\n  academyView?: AcademyView;');
replace('model.ts', '    smoView: valid("smoView", ["market", "structure", "risk"] as const, "market"),', '    smoView: valid("smoView", ["market", "structure", "risk"] as const, "market"),\n    ...(p.get("section") === "academy" || p.has("academyView") ? { academyView: valid("academyView", ["essence", "results", "next"] as const, "essence") } : {}),');
prepend('App.tsx', 'import { AcademyPage } from "./AcademyPage";\n');
replace('App.tsx', '  if (error)\n', '  if (c.section === "academy") return (\n    <>\n      <a className="skip-link" href="#main">Перейти к содержимому</a>\n      <DashboardHeader c={c} change={change} />\n      <main id="main" className="app-main section-academy"><AcademyPage c={c} change={change} /></main>\n    </>\n  );\n  if (error)\n');
replace('App.tsx', '|| (patch.smoView && patch.smoView !== c.smoView))', '|| (patch.smoView && patch.smoView !== c.smoView) || (patch.academyView && patch.academyView !== c.academyView))');
prepend('DashboardHeader.tsx', 'import { AcademyNavigation } from "./AcademyNavigation";\n');
replace('DashboardHeader.tsx', '      {c.section === "strategy" && <StrategyNavigation />}', '      {c.section === "strategy" && <StrategyNavigation />}\n      {c.section === "academy" && <AcademyNavigation c={c} change={change} />}');
replace('DashboardHeader.tsx', '...(section.id === "sales-model" ? { modelView: "premises", slide: 1 } : { slide: 1 })', '...(section.id === "sales-model" ? { modelView: "premises", slide: 1 } : { slide: 1 }), ...(section.id === "academy" ? { academyView: "essence" as const } : {})', 2);
prepend('presentationNavigation.ts', 'import { academyViews, normalizeAcademyView } from "./academyNavigation";\n');
replace('presentationNavigation.ts', '  if (c.section === "sales-model") {', '  if (c.section === "academy") {\n    const index = academyViews.findIndex(item => item.id === normalizeAcademyView(c.academyView));\n    const destination = academyViews[index + direction];\n    if (destination) return { label: destination.label, patch: { academyView: destination.id } };\n  }\n  if (c.section === "sales-model") {');
replace('presentationNavigation.ts', '...(section.id === "smo" ? { smoView:', '...(section.id === "academy" ? { academyView: direction === 1 ? "essence" : "next" } as const : {}), ...(section.id === "smo" ? { smoView:');
console.log('Academy integration applied.');
