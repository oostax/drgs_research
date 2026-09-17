import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import App from "./App";
import { branchComparisons } from "./analysisModel";
import { defaults, view } from "./model";
import { shareEffects } from "./ShareAnalysis";
import { productChanges } from "./DetailCharts";
import { employeePortfolios } from "./EmployeeDetails";
import type { Evidence, Manifest } from "./types";

vi.mock("./Select", () => ({
  Select: ({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) => <select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>,
}));
const data: Manifest = JSON.parse(fs.readFileSync("public/dashboard/manifest.json", "utf8"));
beforeEach(() => {
  window.history.replaceState({}, "", "/?page=analysis&metric=sales&quarter=3");
  vi.stubGlobal("fetch", vi.fn(async (path: string) => path.endsWith("manifest.json") ? { ok: true, json: async () => data } : { ok: true, arrayBuffer: async () => { const bytes = gunzipSync(fs.readFileSync(`public${path}`)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } }));
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Анализ: подробности и сохранение контекста", () => {
  it("разделяет объём сложных и анализ доли с вкладом продуктов в общую базу", async () => {
    window.history.replaceState({}, "", "/?page=analysis&metric=complex&quarter=3&group=pilot");
    render(<App />);
    const volume = await screen.findByRole("article", { name: "Из чего складывается объём" });
    expect(within(volume).getByText("Количество сложных предложений")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Показатель" }), { target: { value: "complexShare" } });
    const share = screen.getByRole("article", { name: "За счёт чего меняется доля" });
    expect(within(share).getByText("Что изменило долю")).toBeTruthy();
    expect(within(share).getAllByRole("button", { name: /^Состав портфеля/ })).toHaveLength(3);
    expect(screen.queryByRole("article", { name: "Из чего складывается объём" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Продукты", exact: true }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Вклад в общую долю")).toBeTruthy();
    const period = view(data, { ...defaults, metric: "complexShare", group: "pilot", quarter: 3 }, "pilot").periods[2];
    const product = period.complexProducts[0];
    const row = within(panel).getByRole("button", { name: product.name, exact: true }).closest("tr")!;
    const contribution = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(product.count / period.complexShare.denominator! * 100);
    expect(within(row).getByText(`${contribution} п. п.`)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Показатель" }), { target: { value: "complex" } });
    expect(screen.queryByText("Что изменило долю")).toBeNull();
    expect(screen.getByRole("article", { name: "Из чего складывается объём" })).toBeTruthy();
  });
  it("раскладывает изменение доли и не рассчитывает вклад при неполной базе", () => {
    const stat = (numerator: number, denominator: number) => ({ status: "ready" as const, numerator, denominator, value: denominator ? numerator / denominator * 100 : null });
    // The complex count rises while its share falls as the whole portfolio doubles.
    const result = shareEffects(stat(30, 200), stat(20, 100))!;
    expect(result.numerator).toBe(10);
    expect(result.denominator).toBe(-15);
    expect(result.total).toBe(-5);
    for (const periods of Object.values(data.views).map(v => v.periods)) {
      for (let q = 1; q < periods.length; q++) {
        const effect = shareEffects(periods[q].complexShare, periods[q - 1].complexShare);
        if (effect) expect(effect.numerator + effect.denominator).toBeCloseTo(effect.total, 10);
      }
    }
    expect(shareEffects(stat(30, 200))).toBeNull();
    expect(shareEffects(stat(30, 200), stat(0, 0))).toBeNull();
    expect(shareEffects(stat(30, 200), { ...stat(20, 100), assignedOnly: true })).toBeNull();
    expect(shareEffects({ ...stat(30, 200), status: "missing" }, stat(20, 100))).toBeNull();
  });
  it("показывает все кварталы в таблице, пагинацию и отсутствие копии KPI", async () => {
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "Анализ", exact: true });
    expect(container.querySelector(".analysis-summary")).toBeNull();
    expect((screen.getByRole("combobox", { name: "Сортировка графика" }) as HTMLSelectElement).value).toBe("growth");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("row")).toHaveLength(11);
    for (const q of ["I", "II", "III"]) expect(within(panel).getByRole("button", { name: `Выбрать ${q} квартал` })).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Далее" }));
    expect(within(panel).getByText(/11–20 из/)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Строк на странице" }), { target: { value: "20" } });
    expect(within(panel).getAllByRole("row")).toHaveLength(21);
    expect(within(panel).getByText(/1–20 из/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Поиск в детализации" }), { target: { value: "Татарстан" } });
    expect(within(panel).getAllByRole("row")).toHaveLength(3);
    expect(within(panel).getByText(/1–2 из/)).toBeTruthy();
  });
  it("переходит от продукта к точным исходным записям", async () => {
    render(<App />);
    const card = await screen.findByRole("article", { name: "Структура портфеля" });
    fireEvent.click(within(card).getByRole("button", { name: "Торговый эквайринг" }));
    expect(screen.getByRole("tab", { name: "Продукты", exact: true }).getAttribute("aria-selected")).toBe("true");
    const panel = screen.getByRole("tabpanel");
    const products = within(panel).getAllByRole("button", { name: "Торговый эквайринг", exact: true });
    fireEvent.click(products.find(p => !p.hasAttribute("disabled"))!);
    expect(screen.queryByRole("tab", { name: "Исходные записи" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Продукты", exact: true }).getAttribute("aria-selected")).toBe("true");
    await screen.findByText(/Пилот · найдено записей: 2\s098/);
    expect(within(screen.getByRole("tabpanel")).getAllByRole("row")).toHaveLength(41);
    fireEvent.click(screen.getByRole("button", { name: "К продуктам" }));
    expect(screen.getByRole("tab", { name: "Продукты", exact: true }).getAttribute("aria-selected")).toBe("true");
  });
  it("отделяет рост и снижение от отсутствующей базы, сбрасывает страницу при отборе", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Анализ", exact: true });
    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getByRole("button", { name: "Далее" }));
    const comparisons = branchComparisons(data, { ...defaults, page: "analysis", metric: "sales", quarter: 3 });
    const series = comparisons.flatMap(row => row.series.map(s => ({ ...s, name: row.branch.name })));
    for (const [label, accepts] of [
      ["Рост", (n: number | null) => n != null && n > 0],
      ["Снижение", (n: number | null) => n != null && n < 0],
      ["Нет сравнения", (n: number | null) => n == null],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}\\s`) }));
      const expected = series.filter(s => accepts(s.difference));
      expect(within(panel).getAllByRole("row")).toHaveLength(Math.min(10, expected.length) + 1);
      const visibleNames = within(panel).getAllByRole("link").filter(link => link.className === "branch-link").map(link => link.textContent!);
      expect(visibleNames.every(name => expected.some(row => name.startsWith(row.name)))).toBe(true);
      expect(within(panel).getByRole("button", { name: "Назад" }).hasAttribute("disabled")).toBe(true);
    }
  });
  it("при смене роли убирает недоступную вкладку продуктов и нормализует показатель", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Продукты", exact: true }));
    fireEvent.change(screen.getByRole("combobox", { name: "Роль пилота" }), { target: { value: "akm" } });
    expect(screen.queryByRole("tab", { name: "Продукты", exact: true })).toBeNull();
    expect(screen.getByRole("tab", { name: "ГОСБ", exact: true }).getAttribute("aria-selected")).toBe("true");
    expect(new URLSearchParams(window.location.search).get("metric")).toBe("process");
    expect(new URLSearchParams(window.location.search).get("group")).toBe("pilot");
  });
  it("переключает вкладки с клавиатуры", async () => {
    render(<App />);
    const tab = await screen.findByRole("tab", { name: "ГОСБ", exact: true });
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Продукты", exact: true }).getAttribute("aria-selected")).toBe("true");
  });
  it("показывает состав портфеля сотрудника и открывает его исходные записи", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Сотрудники пилота", exact: true }));
    const employee = await screen.findByRole("button", { name: "Зверева Елена Владимировна", exact: true });
    const row = employee.closest("tr")!;
    expect(within(screen.getByRole("tabpanel")).queryByRole("columnheader", { name: "Записей" })).toBeNull();
    expect(row.querySelector(".employee-main-value")!.textContent).toBe("336");
    const composition = row.querySelector(".employee-composition")!.textContent;
    fireEvent.change(screen.getByRole("textbox", { name: "Поиск в детализации" }), { target: { value: "Зверева" } });
    expect(employee.closest("tr")!.querySelector(".employee-composition")!.textContent).toBe(composition);
    fireEvent.click(within(row).getByRole("button", { name: /^Исходные записи:/ }));
    await screen.findByText(/Пилот · найдено записей: 336/);
    expect(screen.getByRole("button", { name: "К сотрудникам" })).toBeTruthy();
  });
  it("считает уникальных клиентов и не относит неизвестный тип к обычным продуктам", () => {
    const fact = { employeeId: "1", product: "Лизинг", inn: "123" } as Evidence;
    const info = employeePortfolios([{ ...fact, complex: true }, { ...fact, complex: false }, { ...fact, inn: undefined, product: "Другой" }]).get("1")!;
    expect(info).toMatchObject({ total: 3, complex: 1, ordinary: 1, unknown: 1, clients: 1, missingInn: 1, products: 2, leading: ["Лизинг", 2] });
  });
  it("отбирает сложные продукты, сохраняя доли от полного портфеля", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Продукты", exact: true }));
    const panel = screen.getByRole("tabpanel");
    const complexRow = within(panel).getAllByRole("button", { name: "Лизинг СБЛ", exact: true })[0].closest("tr")!;
    const share = complexRow.querySelector(".detail-share")!.textContent;
    expect(within(complexRow).getByText("Сложный")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "Тип продуктов" })).getByRole("button", { name: /^Сложные/ }));
    expect(within(panel).queryByRole("button", { name: "Торговый эквайринг", exact: true })).toBeNull();
    const visible = within(panel).getAllByRole("row").slice(1);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every(row => row.classList.contains("analysis-complex-product"))).toBe(true);
    expect(within(panel).getAllByRole("button", { name: "Лизинг СБЛ", exact: true })[0].closest("tr")!.querySelector(".detail-share")!.textContent).toBe(share);
  });
  it("раскрывает продукты, которые изменили результат выбранного ГОСБ", async () => {
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "Анализ", exact: true });
    expect(container.querySelector(".detail-quarter-bars")).toBeNull();
    const button = screen.getAllByRole("button", { name: /^Разобрать изменения:/ })[0];
    fireEvent.click(button);
    expect(screen.getByRole("region", { name: /^Разбор изменений:/ })).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(button);
    expect(screen.queryByRole("region", { name: /^Разбор изменений:/ })).toBeNull();
  });
  it("сводит вклады продуктов к изменению итога и не рассчитывает их по неполной расшифровке", () => {
    const periods = view(data, { ...defaults, branch: "8610" }, "pilot").periods;
    const changes = productChanges(periods[2], periods[1], true)!;
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.reduce((sum, item) => sum + item.difference, 0)).toBe(periods[2].complex.value! - periods[1].complex.value!);
    expect(productChanges({ ...periods[2], complexProducts: [] }, periods[1], true)).toBeNull();
    expect(productChanges(periods[2], { ...periods[1], complex: { status: "missing", value: null } }, true)).toBeNull();
    const previous = { ...periods[1], sales: { status: "ready" as const, value: 10 }, products: [{ name: "Ушедший", count: 10, complex: false }] };
    const current = { ...periods[2], sales: { status: "ready" as const, value: 15 }, products: [{ name: "Новый", count: 15, complex: false }] };
    expect(productChanges(current, previous, false)).toEqual([
      { name: "Новый", before: 0, after: 15, difference: 15 },
      { name: "Ушедший", before: 10, after: 0, difference: -10 },
    ]);
  });
  it("раскрывает продукты Башкортостана по известным привязкам, сохраняя ограничение сравнения", async () => {
    const c = { ...defaults, branch: "8598", group: "nonpilot" as const };
    const periods = view(data, c, "nonpilot").periods;
    expect(periods[1].sales.assignedOnly).toBe(true);
    expect(productChanges(periods[2], periods[1], false)).toBeNull();
    const changes = productChanges(periods[2], periods[1], false, true)!;
    expect(changes.reduce((sum, item) => sum + item.before, 0)).toBe(1459);
    expect(changes.reduce((sum, item) => sum + item.after, 0)).toBe(1328);
    expect(changes.reduce((sum, item) => sum + item.difference, 0)).toBe(-131);
    expect(productChanges({ ...periods[2], products: [] }, periods[1], false, true)).toBeNull();
    expect(productChanges(periods[2], { ...periods[1], sales: { status: "missing", value: null } }, false, true)).toBeNull();
    window.history.replaceState({}, "", "/?page=analysis&metric=sales&quarter=3&group=nonpilot&branch=8598");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Разобрать изменения:/ }));
    const breakdown = screen.getByRole("region", { name: /Разбор изменений: Башкортостан/ });
    expect(within(breakdown).getByRole("heading", { name: "Сравнение доступных предложений" })).toBeTruthy();
    expect(within(breakdown).getByText(/II кв.: учтены только предложения с известным ГОСБ/)).toBeTruthy();
    expect(breakdown.querySelectorAll(".analysis-driver-row")).toHaveLength(6);
    expect(screen.queryByText(/Для точного разбора нужна/)).toBeNull();
  });
  it("не подставляет ноль вместо отсутствующего квартала непилота", () => {
    const rows = branchComparisons(data, { ...defaults, page: "analysis" });
    const moscow = rows.find(r => r.branch.id === "9038")!;
    const series = moscow.series.find(s => s.group === "nonpilot")!;
    expect(series.stat.value).toBeGreaterThan(0);
    expect(series.difference).toBeNull();
    expect(series.change).toBeNull();
  });
});
