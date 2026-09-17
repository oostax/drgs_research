import type { Context, Employee, Evidence, Manifest } from "./types";
import { format, metricNames, roleNames } from "./model";
import { Icon } from "./Icons";

const noun = (n: number, forms: [string, string, string]) => forms[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2];

export function employeePortfolios(records: Evidence[]) {
  const groups = new Map<string, Evidence[]>();
  for (const record of records) {
    const list = groups.get(record.employeeId) ?? [];
    list.push(record);
    groups.set(record.employeeId, list);
  }
  return new Map([...groups].map(([id, list]) => {
    const products = new Map<string, number>();
    for (const record of list) if (record.product) products.set(record.product, (products.get(record.product) ?? 0) + 1);
    const leading = [...products].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))[0];
    const complex = list.filter(r => r.complex === true).length;
    const ordinary = list.filter(r => r.complex === false).length;
    return [id, { total: list.length, complex, ordinary, unknown: list.length - complex - ordinary, clients: new Set(list.map(r => r.inn).filter(Boolean)).size, missingInn: list.filter(r => !r.inn).length, products: products.size, leading }];
  }));
}

export type EmployeePortfolio = ReturnType<typeof employeePortfolios> extends Map<string, infer P> ? P : never;

export function EmployeePortfolioTable({ employees, data, c, open }: {
  employees: { p: Employee; n: number | null; rs: Evidence[]; portfolio?: EmployeePortfolio }[];
  data: Manifest; c: Context; open: (employee: Employee) => void;
}) {
  const percent = (n: number, total: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n / total * 100)}%`;
  const withoutFot = c.metric !== "sales" || c.scope === "without";
  return <div className="employee-portfolios">
    <div className="employee-portfolio-key"><span><i />Остальные продукты</span><span><i />Сложные продукты</span><span>Состав личного портфеля{withoutFot ? " без ФОТ" : " с ФОТ"}</span></div>
    <div className="table-scroll" tabIndex={0} aria-label="Портфели сотрудников пилота">
      <table className="employee-portfolio-table"><thead><tr><th>Сотрудник / ГОСБ</th><th className="numeric">{c.metric === "sales" ? "Предложения" : metricNames[c.metric]}</th><th>Состав портфеля</th><th>Клиенты и продукты</th><th aria-label="Исходные записи" /></tr></thead>
        <tbody>{employees.map(({ p, n, rs, portfolio: info }) => <tr key={p.id}>
          <td className="employee-identity-cell"><button className="employee-link" onClick={() => open(p)}>{p.name}</button><span className="employee-branch">{data.branches.find(b => b.id === p.branch)?.name}</span><small className="cell-note">{roleNames[p.role]} · Таб. №{p.rawId}</small></td>
          <td className="numeric employee-result-cell" data-label={c.metric === "sales" ? "Предложения" : metricNames[c.metric]}><strong className="employee-main-value">{format(n, c.metric)}</strong>{c.metric !== "sales" && info && <small className="cell-note">из {format(info.total)} предложений</small>}</td>
          <td className="employee-composition-cell">{info?.total ? <div className="employee-composition">
            <div className="employee-complex-label"><span><Icon name="complex" size={16} />Сложные <b>{format(info.complex)}</b></span><strong>{info.unknown ? "—" : percent(info.complex, info.total)}</strong></div>
            <div className="employee-mix-bar" aria-hidden="true"><span style={{ width: `${info.ordinary / info.total * 100}%` }} /><span style={{ width: `${info.complex / info.total * 100}%` }} /><span style={{ width: `${info.unknown / info.total * 100}%` }} /></div>
            {info.unknown > 0 && <small className="cell-note">Тип не определён: {format(info.unknown)}</small>}
            {info.leading && <div className="employee-leading"><span title={info.leading[0]}>Основной: {info.leading[0]}</span><b>{percent(info.leading[1], info.total)}</b></div>}
          </div> : <span className="table-status">Нет предложений в срезе</span>}</td>
          <td className="employee-breadth-cell">{info?.total ? <div className="employee-breadth"><span><b>{format(info.clients)}</b> {noun(info.clients, ["клиент", "клиента", "клиентов"])} по ИНН</span><span><b>{format(info.products)}</b> {noun(info.products, ["продукт", "продукта", "продуктов"])}</span>{info.missingInn > 0 && <small className="cell-note">Без ИНН: {format(info.missingInn)} предложений</small>}</div> : <span className="table-status">—</span>}</td>
          <td className="employee-action-cell"><button className="employee-records" onClick={() => open(p)} disabled={!rs.length} aria-label={`Исходные записи: ${p.name}`}>Записи<Icon name="arrow" size={16} /></button></td>
        </tr>)}</tbody>
      </table>
      {!employees.length && <p className="employee-empty">По заданным условиям сотрудники не найдены.</p>}
    </div>
    <p className="employee-portfolio-footnote">Под полосой — продукт с наибольшим числом предложений и его доля в личном портфеле. Клиенты посчитаны по уникальным ИНН; один клиент может встречаться у разных сотрудников.</p>
  </div>;
}
