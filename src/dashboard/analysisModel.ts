import type { Context, Manifest } from "./types";
import { delta, selectedGroups, value } from "./model";

export function branchComparisons(data: Manifest, c: Context) {
  return data.branches.filter(b => (c.branch === "all" || b.id === c.branch) && (c.group !== "pilot" || b.pilot))
    .map(branch => ({ branch, series: selectedGroups(data, { ...c, branch: branch.id }).map(group => {
      const context = { ...c, branch: branch.id };
      const stat = value(data, context, group, c.metric);
      const previous = c.quarter > 1 && c.metric !== "coverage" ? value(data, context, group, c.metric, c.quarter - 1) : null;
      const change = previous ? delta(stat, previous, c.metric) : null;
      return { group, stat, change, difference: change && stat.value != null && previous?.value != null ? stat.value - previous.value : null };
    }) }));
}

/** A download remains local; quote values and neutralize spreadsheet formulas. */
export function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map(row => row.map(cell => {
    let text = cell == null ? "" : String(cell);
    if (typeof cell === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
