import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import { Icon } from "./Icons";

export type SelectOption = { value: string; label: string; detail?: string };
type Props = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  disabled?: boolean;
};

/** Small lists use Radix Select; long lists keep keyboard focus in a search input. */
export function Select({
  label,
  value,
  options,
  onChange,
  searchable = false,
  disabled,
}: Props) {
  const id = useId();
  if (searchable)
    return <SearchSelect {...{ label, value, options, onChange, disabled }} />;
  return (
    <div className="select-field">
      <span id={id} className="select-label">
        {label}
      </span>
      <SelectPrimitive.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          className="select-trigger"
          aria-labelledby={id}
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon>
            <Icon name="down" size={18} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="select-menu"
            position="popper"
            sideOffset={7}
            collisionPadding={16}
          >
            <SelectPrimitive.ScrollUpButton className="select-scroll">
              <Icon name="down" size={16} />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="select-options">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="select-option"
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="select-check">
                    <Icon name="check" size={17} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="select-scroll">
              <Icon name="down" size={16} />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

function SearchSelect({ label, value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const normalize = (v: string) =>
    v.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
  const filtered = useMemo(
    () =>
      options.filter((o) =>
        normalize(`${o.label} ${o.detail || ""} ${o.value}`).includes(
          normalize(query),
        ),
      ),
    [options, query],
  );
  const selected = options.find((o) => o.value === value);
  function opened(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
      );
    }
  }
  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }
  useEffect(() => {
    const row = list.current?.querySelector(
      `[data-index="${active}"]`,
    ) as HTMLElement | null;
    if (row && list.current) {
      const top = row.offsetTop,
        bottom = top + row.offsetHeight;
      if (top < list.current.scrollTop) list.current.scrollTop = top;
      else if (bottom > list.current.scrollTop + list.current.clientHeight)
        list.current.scrollTop = bottom - list.current.clientHeight;
    }
  }, [active, open, filtered.length]);
  return (
    <div className="select-field">
      <span id={`${id}-label`} className="select-label">
        {label}
      </span>
      <Popover.Root open={open} onOpenChange={opened}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="select-trigger"
            aria-labelledby={`${id}-label ${id}-value`}
            disabled={disabled}
          >
            <span id={`${id}-value`} className="select-value">
              {selected?.label || "Выберите значение"}
            </span>
            <Icon name="down" size={18} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="select-menu search-select-menu"
            align="start"
            sideOffset={7}
            collisionPadding={16}
            aria-label={`Выбор: ${label}`}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              input.current?.focus();
            }}
          >
            <div className="select-search">
              <Icon name="search" size={18} />
              <input
                ref={input}
                value={query}
                aria-label={`Поиск: ${label}`}
                placeholder={
                  label === "ГОСБ"
                    ? "Название или номер ГОСБ"
                    : "Поиск по названию"
                }
                role="combobox"
                aria-expanded="true"
                aria-controls={`${id}-list`}
                aria-autocomplete="list"
                aria-activedescendant={
                  filtered[active] ? `${id}-option-${active}` : undefined
                }
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((n) =>
                      Math.max(
                        0,
                        Math.min(
                          filtered.length - 1,
                          n + (e.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
                    );
                  }
                  if (e.key === "Home" && e.ctrlKey) {
                    e.preventDefault();
                    setActive(0);
                  }
                  if (e.key === "End" && e.ctrlKey) {
                    e.preventDefault();
                    setActive(Math.max(0, filtered.length - 1));
                  }
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && filtered[active]) {
                    e.preventDefault();
                    choose(filtered[active].value);
                  }
                  if (e.key === "Tab") setOpen(false);
                }}
              />
            </div>
            <div
              id={`${id}-list`}
              ref={list}
              role="listbox"
              aria-label={label}
              className="select-options search-select-options"
            >
              {filtered.map((o, i) => (
                <div
                  key={o.value}
                  id={`${id}-option-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  data-index={i}
                  data-active={i === active}
                  className="select-option"
                  onPointerMove={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.value)}
                >
                  <span>
                    {o.label}
                    {o.detail && <small>{o.detail}</small>}
                  </span>
                  {o.value === value && <Icon name="check" size={17} />}
                </div>
              ))}
              {!filtered.length && (
                <p className="select-empty" role="status">
                  Ничего не найдено
                </p>
              )}
            </div>
            <div className="select-help">
              Стрелки — выбор · Enter — применить
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
