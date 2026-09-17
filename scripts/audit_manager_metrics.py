#!/usr/bin/env python3
"""Independently reconcile every generated manager metric with source rows."""
from __future__ import annotations

import collections
import json
import statistics

from preprocess import (
    COMPARISON_KEYS,
    FOT_PRODUCT,
    JULY,
    MANAGER_SCOPES,
    OUTPUT,
    PRODUCT_SCOPES,
    SOURCES,
    STAGE_ORDER,
    entity_type,
    normalize_manager,
    read_july,
    read_offers,
)


def scoped(rows: dict, manager_scope: str, product_scope: str, pilot_keys: set[str]):
    result = {}
    for offer_id, row in rows.items():
        is_pilot = normalize_manager(row["manager"]) in pilot_keys
        if manager_scope == "pilot" and not is_pilot:
            continue
        if manager_scope == "nonPilot" and is_pilot:
            continue
        if product_scope == "withoutFot" and row["product"] == FOT_PRODUCT:
            continue
        result[offer_id] = row
    return result


def median(values: list[float]):
    return round(statistics.median(values), 1) if values else 0


def expected_manager(name: str, base: dict, target: dict, pilot_by_name: dict):
    base_ids = {offer_id for offer_id, row in base.items() if row["manager"] == name}
    target_ids = {offer_id for offer_id, row in target.items() if row["manager"] == name}
    retained_ids = base_ids & target_ids
    target_rows = [target[offer_id] for offer_id in target_ids]
    progressed = sum(
        STAGE_ORDER.get(target[offer_id]["stage"], 0)
        > STAGE_ORDER.get(base[offer_id]["stage"], 0)
        for offer_id in retained_ids
    )
    funnel = collections.Counter(entity_type(row["stage"]) for row in target_rows)
    stage_days = [row["stageDays"] for row in target_rows if row["stageDays"]]
    ages = [row["ageDays"] for row in target_rows if row["ageDays"]]
    completed_before = sum(entity_type(base[offer_id]["stage"]) == "completedDeal" for offer_id in base_ids)
    completed_after = funnel["completedDeal"]
    retained = len(retained_ids)
    before = len(base_ids)
    after = len(target_ids)
    meeting = pilot_by_name.get(normalize_manager(name))
    return {
        "name": name,
        "before": before,
        "after": after,
        "delta": after - before,
        "retained": retained,
        "progressed": progressed,
        "progressRate": round(progressed / retained, 4) if retained else 0,
        "newCount": len(target_ids - base_ids),
        "goneCount": len(base_ids - target_ids),
        "retentionRate": round(retained / before, 4) if before else 0,
        "leads": funnel["lead"],
        "activeDeals": funnel["activeDeal"],
        "completedDeals": completed_after,
        "completedDelta": completed_after - completed_before,
        "stoppedOver90": sum(row["stageDays"] > 90 for row in target_rows),
        "stuckRate": round(sum(row["stageDays"] > 90 for row in target_rows) / after, 4) if after else 0,
        "ageMedian": median(ages),
        "stageDaysMedian": median(stage_days),
        "reliability": "Высокая" if retained >= 100 else "Средняя" if retained >= 30 else "Ограниченная",
        "isPilot": bool(meeting),
        "meetings": meeting,
    }


def main():
    generated = json.loads(OUTPUT.read_text(encoding="utf-8"))
    raw = {period: read_offers(path) for period, path in SOURCES.items()}
    july = read_july(JULY)
    pilot_by_name = {normalize_manager(row["manager"]): row for row in july}
    pilot_keys = set(pilot_by_name)
    mismatches = []
    audited = 0

    for manager_scope in MANAGER_SCOPES:
        for product_scope in PRODUCT_SCOPES:
            view_key = f"{manager_scope}:{product_scope}"
            snapshots = {
                period: scoped(rows, manager_scope, product_scope, pilot_keys)
                for period, rows in raw.items()
            }
            for comparison_key in COMPARISON_KEYS:
                base_key, target_key = comparison_key.split("-")
                base, target = snapshots[base_key], snapshots[target_key]
                actual_rows = {
                    row["name"]: row
                    for row in generated["views"][view_key]["comparisons"][comparison_key]["managerPerformance"]
                }
                names = {
                    row["manager"]
                    for row in [*base.values(), *target.values()]
                    if row["manager"] != "Не указано"
                }
                if manager_scope == "pilot":
                    existing_keys = {normalize_manager(name) for name in names}
                    names |= {
                        row["manager"]
                        for row in july
                        if normalize_manager(row["manager"]) not in existing_keys
                    }
                if set(actual_rows) != names:
                    mismatches.append((view_key, comparison_key, "managerSet", len(names), len(actual_rows)))
                for name in names:
                    audited += 1
                    expected = expected_manager(name, base, target, pilot_by_name)
                    actual = actual_rows.get(name)
                    if not actual:
                        continue
                    for field, expected_value in expected.items():
                        actual_value = actual.get(field)
                        if actual_value != expected_value:
                            mismatches.append((view_key, comparison_key, name, field, expected_value, actual_value))
                    # При равной частоте порядок продуктов не определён. Проверяем
                    # фактические счётчики и корректность границы top-4, а не порядок tie.
                    product_counts = collections.Counter(
                        row["product"] for row in target.values() if row["manager"] == name
                    )
                    actual_top = actual.get("topProducts", [])
                    top_counts = [item[1] for item in actual_top]
                    if (
                        len(actual_top) > 4
                        or top_counts != sorted(top_counts, reverse=True)
                        or any(product_counts.get(product) != count for product, count in actual_top)
                    ):
                        mismatches.append((view_key, comparison_key, name, "topProducts", "invalid", actual_top))
                    elif actual_top:
                        shown = {product for product, _ in actual_top}
                        omitted_counts = [
                            count for product, count in product_counts.items() if product not in shown
                        ]
                        if omitted_counts and max(omitted_counts) > top_counts[-1]:
                            mismatches.append((view_key, comparison_key, name, "topProductsBoundary"))
                    if not (
                        actual["before"] + actual["newCount"] - actual["goneCount"] == actual["after"]
                        and actual["retained"] + actual["newCount"] == actual["after"]
                        and actual["retained"] + actual["goneCount"] == actual["before"]
                    ):
                        mismatches.append((view_key, comparison_key, name, "portfolioBalance"))
                    for field in ("progressRate", "retentionRate", "stuckRate"):
                        if not 0 <= actual[field] <= 1:
                            mismatches.append((view_key, comparison_key, name, field, "outside 0..1", actual[field]))

    result = {
        "managerRowsAudited": audited,
        "views": len(MANAGER_SCOPES) * len(PRODUCT_SCOPES),
        "comparisons": len(MANAGER_SCOPES) * len(PRODUCT_SCOPES) * len(COMPARISON_KEYS),
        "pilotManagers": len(pilot_keys),
        "mismatches": len(mismatches),
    }
    print(json.dumps(result, ensure_ascii=False))
    if mismatches:
        print(json.dumps(mismatches[:100], ensure_ascii=False, indent=2))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
