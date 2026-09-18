import type { AcademyView } from "./types";

export const academyViews: { id: AcademyView; label: string; short: string }[] = [
  { id: "essence", label: "Суть", short: "Суть" },
  { id: "results", label: "Текущие результаты", short: "Текущие результаты" },
  { id: "next", label: "Дальнейшие шаги", short: "Дальнейшие шаги" },
];
export function normalizeAcademyView(value?: string): AcademyView {
  return academyViews.find(view => view.id === value)?.id ?? "essence";
}
