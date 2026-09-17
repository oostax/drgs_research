import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import App from "./App";

vi.mock("./Select", () => ({
  Select: ({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) =>
    <select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}));

const data = JSON.parse(fs.readFileSync("public/dashboard/manifest.json", "utf8"));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Карточки главной соответствуют роли", () => {
  it.each(["senior", "junior", "akm"])("выбор %s автоматически включает группу Пилот", async role => {
    window.history.replaceState({}, "", "/?page=overview&group=both&role=all");
    render(<App />);
    const control = await screen.findByRole("combobox", { name: "Роль пилота" });
    fireEvent.change(control, { target: { value: role } });
    expect(new URLSearchParams(window.location.search).get("group")).toBe("pilot");
    expect(new URLSearchParams(window.location.search).get("role")).toBe(role);
    fireEvent.change(control, { target: { value: "all" } });
    expect(new URLSearchParams(window.location.search).get("group")).toBe("pilot");
  });
  it.each([
    ["akm", ["Удовлетворённость", "Обращения клиентов"]],
    ["senior", ["Воронка сделок", "Сложные продукты", "Встречи и покрытие", "Удовлетворённость", "Обращения клиентов"]],
    ["junior", ["Воронка сделок", "Встречи и покрытие", "Удовлетворённость", "Обращения клиентов", "ФОТ и получатели"]],
    ["all", ["Воронка сделок", "Сложные продукты", "Встречи и покрытие", "Удовлетворённость", "Обращения клиентов", "ФОТ и получатели"]],
  ])("%s: скрывает карточки, а не только их значения", async (role, titles) => {
    window.history.replaceState({}, "", `/?page=overview&role=${role}&metric=sales`);
    const { container } = render(<App />);
    await screen.findByRole("article", { name: "Удовлетворённость" });
    expect(Array.from(container.querySelectorAll("article h2"), (el) => el.textContent)).toEqual(titles);
    expect(screen.queryByText("Распределение по стадиям")).toBeNull();
    expect(container.querySelector(".stage-card")).toBeNull();
    expect(container.querySelector(".hypothesis, .method-note, .app-footer")).toBeNull();
    expect(container.querySelectorAll("article")).toHaveLength(titles.length);
    expect(screen.queryByText("Не применяется")).toBeNull();
    if (role === "akm") {
      await waitFor(() => expect(new URLSearchParams(window.location.search).get("metric")).toBe("process"));
      for (const link of container.querySelectorAll<HTMLAnchorElement>("a[href*='page=analysis']")) {
        expect(["process", "leads", "appeals"]).toContain(new URL(link.href).searchParams.get("metric"));
      }
    }
  });
});
