import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { QuarterNumber } from "./QuarterNumber";

// Test our transition policy; actual digit motion is verified in the browser.
vi.mock("@number-flow/react", () => ({
  useIsSupported: () => true,
  continuous: {},
  default: ({ value, animated, suffix }: { value: number; animated: boolean; suffix: string }) =>
    <span data-animated={String(animated)}>{value}{suffix}</span>,
}));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  document.documentElement.dataset.input = "pointer";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.documentElement.dataset.input; });

it("does not roll on mount, rolls on a quarter change, and accepts rapid retargets", () => {
  const { container, rerender } = render(<QuarterNumber value={7365} text="7 365" quarter={3} />);
  expect(container.querySelector('[data-animated="false"]')).toBeTruthy();
  rerender(<QuarterNumber value={7106} text="7 106" quarter={2} />);
  expect(container.querySelector('[data-animated="true"]')).toBeTruthy();
  rerender(<QuarterNumber value={8602} text="8 602" quarter={1} />);
  expect(container.querySelector('[aria-label="8 602"]')).toBeTruthy();
  expect(container.querySelector('[data-animated="true"]')?.textContent).toBe("8602");
});
it("never invents a starting zero after missing data", () => {
  const { container, rerender } = render(<QuarterNumber value={null} text="—" quarter={1} />);
  expect(container.textContent).toBe("—");
  rerender(<QuarterNumber value={100} text="100" quarter={2} />);
  expect(container.querySelector('[data-animated="false"]')).toBeTruthy();
});
it("rolls filter updates within the same quarter and retargets rapid changes", () => {
  const { container, rerender } = render(<QuarterNumber value={7365} text="7 365" quarter={3} />);
  rerender(<QuarterNumber value={1544} text="1 544" quarter={3} />);
  expect(container.querySelector('[data-animated="true"]')?.textContent).toBe("1544");
  rerender(<QuarterNumber value={42572} text="42 572" quarter={3} />);
  expect(container.querySelector('[data-animated="true"]')?.textContent).toBe("42572");
  rerender(<QuarterNumber value={42572} text="42 572" quarter={3} />);
  expect(container.querySelector('[data-animated="false"]')).toBeTruthy();
});
it("keeps keyboard changes instant", () => {
  const { container, rerender } = render(<QuarterNumber value={100} text="100" quarter={1} />);
  document.documentElement.dataset.input = "keyboard";
  rerender(<QuarterNumber value={120} text="120" quarter={2} />);
  expect(container.querySelector('[data-animated="false"]')).toBeTruthy();
});
it("keeps reduced-motion values as plain exact text", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const { container, rerender } = render(<QuarterNumber value={22.36729} text="22,4%" quarter={3} digits={1} suffix="%" />);
  expect(container.textContent).toBe("22,4%");
  rerender(<QuarterNumber value={20.70571} text="20,7%" quarter={2} digits={1} suffix="%" />);
  expect(container.textContent).toBe("20,7%");
  expect(container.querySelector("[data-animated]")).toBeNull();
});
