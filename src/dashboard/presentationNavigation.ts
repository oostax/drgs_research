import type { Context, PresentationSection, SalesModelView } from "./types";

export const slideTitles = [
  "Меняем модель продаж", "Предпосылки изменений", "Суть изменений и ожидаемые результаты",
  "Что меняем", "Перезакрепление клиентской базы", "Новый порядок закрепления клиентской базы",
  "Работа со смежными подразделениями", "Компании продаж", "Проводим пилот",
];
export const presentationSections: { id: PresentationSection; label: string; short?: string }[] = [
  { id: "title", label: "Приветствие" },
  { id: "smo", label: "Кредитование СМО", short: "СМО" },
  { id: "sales-model", label: "Модель продаж" },
  { id: "strategy", label: "Страт. диалог" },
  { id: "academy", label: "Академия гибридных лидеров", short: "Академия" },
  { id: "tb-tasks", label: "Задачи ТБ" },
];
export const salesModelViews: { id: SalesModelView; label: string; short: string }[] = [
  { id: "premises", label: "Предпосылки изменений", short: "Предпосылки" },
  { id: "results", label: "Результаты", short: "Результаты" },
  { id: "next", label: "Дальнейшие шаги", short: "Далее" },
];
export function normalizeSlide(value: number): number {
  return Number.isFinite(value) ? Math.min(slideTitles.length, Math.max(1, Math.trunc(value))) : 1;
}
export type PresentationDestination = { label: string; patch: Partial<Context> };
/** One sequence for arrow buttons and swipes; analytical filters are never replaced. */
export function adjacentPresentation(c: Context, direction: -1 | 1): PresentationDestination | null {
  if (c.section === "sales-model") {
    if (c.modelView === "premises" && direction === 1) return { label: "Результаты", patch: { modelView: "results", page: "overview" } };
    if (c.modelView === "results") return direction === 1
      ? { label: "Дальнейшие шаги", patch: { modelView: "next" } }
      : { label: "Предпосылки изменений", patch: { modelView: "premises", slide: slideTitles.length } };
    if (c.modelView === "next" && direction === -1) return { label: "Результаты", patch: { modelView: "results", page: "overview" } };
  }
  const section = presentationSections[presentationSections.findIndex(item => item.id === c.section) + direction];
  if (!section) return null;
  return {
    label: section.label,
    patch: { section: section.id, slide: 1, ...(section.id === "sales-model" ? { modelView: direction === 1 ? "premises" : "next" } as const : {}) },
  };
}
