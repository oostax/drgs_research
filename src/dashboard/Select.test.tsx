import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Select } from "./Select";

afterEach(cleanup);
const options = [
  { value: "all", label: "Все ГОСБ" },
  { value: "9500", label: "Санкт-Петербург · №9500", detail: "Пилот" },
  { value: "9600", label: "Ленинградская область · №9600", detail: "Пилот" },
];

describe("Поисковый селект", () => {
  it("ищет по номеру, выбирает Enter, закрывается и возвращает фокус", async () => {
    const onChange = vi.fn();
    render(<Select label="ГОСБ" value="all" options={options} onChange={onChange} searchable />);
    const trigger = screen.getByRole("button", { name: "ГОСБ Все ГОСБ" });
    fireEvent.click(trigger);
    const input = screen.getByRole("combobox", { name: "Поиск: ГОСБ" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.change(input, { target: { value: "9500" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("9500");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("показывает пустой результат и не выбирает случайное значение", () => {
    const onChange = vi.fn();
    render(<Select label="ГОСБ" value="all" options={options} onChange={onChange} searchable />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "несуществующий" } });
    expect(screen.getByRole("status").textContent).toBe("Ничего не найдено");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("поддерживает стрелки, Escape и текущий выбор при повторном открытии", async () => {
    const onChange = vi.fn();
    render(<Select label="ГОСБ" value="9500" options={options} onChange={onChange} searchable />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    const input = screen.getByRole("combobox");
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)?.textContent).toContain("Санкт-Петербург");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)?.textContent).toContain("Ленинградская");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toContain("option-1");
  });

  it("не открывает отключённый селект", () => {
    render(<Select label="Роль пилота" value="all" options={options} onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.hasAttribute("disabled")).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
