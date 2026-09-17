#!/usr/bin/env python3
"""Builds the dashboard dataset exclusively from the supplied Excel snapshots."""
from __future__ import annotations

import collections
import csv
import datetime as dt
import hashlib
import gzip
import heapq
import json
import math
import statistics
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "generated" / "analytics.json"
REGISTRY_DIR = ROOT / "public" / "data"
SOURCES = {
    "Q1": Path("/Users/sergey/Downloads/1 квартал.xlsx"),
    "Q2": Path("/Users/sergey/Downloads/2 квартал.xlsx"),
    "Q3": Path("/Users/sergey/Downloads/3 квартал на 23-08-2026.xlsx"),
}
JULY = Path("/Users/sergey/Downloads/итоги за июль (1).xlsx")
MOOD = Path("/Users/sergey/Downloads/Настроение_КМ_2026-08-31-114752.csv")
AS_OF = {"Q1": "2026-03-31", "Q2": "2026-06-30", "Q3": "2026-08-23"}
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
COLS = {
    "A": "clientInn", "B": "client", "C": "offerId", "D": "dealId", "E": "product",
    "F": "amount", "G": "od", "H": "trigger", "I": "triggerCode", "J": "potential",
    "K": "stage", "L": "stageDate", "M": "stageDays", "N": "ageDays", "O": "essence",
    "P": "notes", "Q": "saleFormat", "R": "manager", "S": "leader", "T": "label", "U": "hashtag",
}
STAGE_ORDER = {"Выявление потребности": 1, "Обсуждение условий": 2, "Реализация сделки": 3, "Активация продукта": 4}
LEAD_STAGES = {"Выявление потребности", "Обсуждение условий"}
ACTIVE_DEAL_STAGE = "Реализация сделки"
COMPLETED_DEAL_STAGE = "Активация продукта"
THEMES = {
    "госфинансирование": ("гос", "бюджет", "нацпроект", "контракт"),
    "инвестиции": ("инвест", "строитель", "модерниз", "проектное финанс"),
    "зарплатный проект": ("зарплат", "фот", "сотрудник"),
    "оборотное финансирование": ("оборот", "ликвид", "кассов", "краткосроч"),
    "цифровизация": ("цифров", "ит-", "информацион", "автоматизац"),
}
FOT_PRODUCT = "Зарплатные проекты (объем ФОТ)"
COMPLEX_DEAL_GROUPS = (
    ("Коммерческие кредиты", (
        "Краткосрочное финансирование",
        "Овердрафт",
        "Мезонинные продукты в недвижимости",
        "Финансирование недвижимости",
        "Финансирование проектов и контрактов",
    )),
    ("Лизинг", ("Лизинг (кроме СБЛ)", "Лизинг СБЛ")),
    ("Факторинг", ("Факторинг",)),
    ("Непокрытые аккредитивы", ("Непокрытые аккредитивы",)),
    ("КОРы", ()),
)
COMPLEX_DEAL_PRODUCTS = frozenset(
    product for _, products in COMPLEX_DEAL_GROUPS for product in products
)
MANAGER_SCOPES = ("all", "pilot", "nonPilot")
PRODUCT_SCOPES = ("withoutFot", "withFot")
COMPARISON_KEYS = ("Q1-Q2", "Q2-Q3", "Q1-Q3")
QUALITY_FIELDS = tuple(COLS.values())
MOOD_QUESTIONS = (
    ("week", "Как прошла неделя", "Как прошла Ваша неделя?/Страница 1. Вопрос №1."),
    ("model", "Положительные изменения от новой модели", "Ощущаете ли Вы положительные изменения от внедрения новой Модели продаж?/Страница 2. Вопрос №1."),
    ("clientTime", "Больше времени на работу с клиентами", "Появилось ли у вас больше времени на работу с клиентами?/Страница 3. Вопрос №1."),
    ("leads", "Полезность полученных лидов", "Насколько полезными для вашей работы были лиды, которые вы получали в рабочем месте?/Страница 4. Вопрос №1."),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def safe_num(value: str | None) -> float:
    try:
        result = float(str(value or "0").replace(" ", "").replace(",", "."))
        return result if math.isfinite(result) else 0
    except ValueError:
        return 0


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round((len(ordered) - 1) * fraction))]


def iter_rows(path: Path):
    with zipfile.ZipFile(path) as archive:
        strings: list[str] = []
        with archive.open("xl/sharedStrings.xml") as source:
            for _, element in ET.iterparse(source, events=("end",)):
                if element.tag == NS + "si":
                    strings.append("".join(node.text or "" for node in element.iter(NS + "t")))
                    element.clear()
        with archive.open("xl/worksheets/sheet1.xml") as source:
            for _, element in ET.iterparse(source, events=("end",)):
                if element.tag != NS + "row":
                    continue
                if element.attrib.get("r") == "1":
                    element.clear()
                    continue
                row: dict[str, str] = {}
                for cell in element.findall(NS + "c"):
                    ref = cell.attrib.get("r", "")
                    col = "".join(char for char in ref if char.isalpha())
                    if col not in COLS:
                        continue
                    node = cell.find(NS + "v")
                    if node is None:
                        continue
                    value = node.text or ""
                    if cell.attrib.get("t") == "s":
                        value = strings[int(value)]
                    row[COLS[col]] = value.strip()
                yield row
                element.clear()


def normalize_manager(value: str) -> str:
    return " ".join(value.split()).casefold().replace("ё", "е")


def complex_deal_group(product: str) -> str | None:
    return next(
        (group for group, products in COMPLEX_DEAL_GROUPS if product in products),
        None,
    )


def read_offers(path: Path):
    offers = {}
    for row in iter_rows(path):
        offer_id = row.get("offerId", "")
        if not offer_id:
            continue
        product = row.get("product") or "Не указано"; current_stage = row.get("stage") or "Не указано"
        manager = row.get("manager") or "Не указано"; leader = row.get("leader") or "Не указано"
        sale_format = row.get("saleFormat") or "Не указано"; amount = safe_num(row.get("amount")); od = safe_num(row.get("od"))
        stage_day = safe_num(row.get("stageDays")); age = safe_num(row.get("ageDays"))
        offers[offer_id] = {
            "product": product, "stage": current_stage, "manager": manager, "leader": leader,
            "saleFormat": sale_format, "amount": amount, "od": od, "stageDays": stage_day, "ageDays": age,
            "client": row.get("client", ""), "clientInn": row.get("clientInn", ""), "dealId": row.get("dealId", ""),
            "trigger": row.get("trigger", ""), "triggerCode": row.get("triggerCode", ""),
            "potential": row.get("potential", ""), "notes": row.get("notes", ""), "essence": row.get("essence", ""),
            "comment": (row.get("notes") or row.get("essence") or row.get("potential") or "")[:280],
            "label": row.get("label", ""), "hashtag": row.get("hashtag", ""),
            "filledMask": sum(1 << index for index, field in enumerate(QUALITY_FIELDS) if row.get(field)),
        }
    return offers


def summarize_snapshot(period: str, offers: dict):
    stage = collections.Counter(); products = collections.Counter(); managers = collections.Counter()
    triggers = collections.Counter(); trigger_codes = collections.Counter(); formats = collections.Counter()
    leaders = collections.Counter(); labels = collections.Counter(); hashtags = collections.Counter(); themes = collections.Counter()
    coverage = collections.Counter(); stage_days: list[float] = []; ages: list[float] = []; amounts: list[float] = []; ods: list[float] = []
    top_amount: list[tuple[float, str, dict]] = []; top_stale: list[tuple[float, str, dict]] = []
    total = len(offers); complex_groups = collections.Counter()
    for offer_id, compact in offers.items():
        product = compact["product"]; current_stage = compact["stage"]; manager = compact["manager"]
        leader = compact["leader"]; sale_format = compact["saleFormat"]; amount = compact["amount"]
        od = compact["od"]; stage_day = compact["stageDays"]; age = compact["ageDays"]
        for index, field in enumerate(QUALITY_FIELDS):
            if compact["filledMask"] & (1 << index): coverage[field] += 1
        stage[current_stage] += 1; products[product] += 1; managers[manager] += 1; formats[sale_format] += 1; leaders[leader] += 1
        if compact["trigger"]: triggers[compact["trigger"]] += 1
        if compact["triggerCode"]: trigger_codes[compact["triggerCode"]] += 1
        if compact["label"]: labels[compact["label"]] += 1
        if compact["hashtag"]: hashtags[compact["hashtag"]] += 1
        if group := complex_deal_group(product): complex_groups[group] += 1
        if stage_day: stage_days.append(stage_day)
        if age: ages.append(age)
        if amount: amounts.append(amount)
        if od: ods.append(od)
        combined_text = " ".join(compact.get(key, "") for key in ("trigger", "potential", "essence", "notes", "label", "hashtag")).lower()
        for theme, needles in THEMES.items():
            if any(needle in combined_text for needle in needles): themes[theme] += 1
        evidence = {"offerId": offer_id, "client": compact["client"], "clientInn": compact["clientInn"], "product": product,
                    "manager": manager, "change": "Крупная сумма", "beforeStage": "", "afterStage": current_stage,
                    "amount": amount, "trigger": compact["trigger"], "comment": compact["comment"],
                    "isComplexDeal": product in COMPLEX_DEAL_PRODUCTS}
        item = (amount, offer_id, evidence)
        if len(top_amount) < 12: heapq.heappush(top_amount, item)
        elif amount > top_amount[0][0]: heapq.heapreplace(top_amount, item)
        stale_evidence = {**evidence, "change": f"На стадии {round(stage_day)} дней"}
        stale_item = (stage_day, offer_id, stale_evidence)
        if len(top_stale) < 12: heapq.heappush(top_stale, stale_item)
        elif stage_day > top_stale[0][0]: heapq.heapreplace(top_stale, stale_item)
    summary = {
        "period": period, "asOf": AS_OF[period], "partial": period == "Q3", "total": len(offers),
        "stage": dict(stage), "products": products.most_common(), "managers": managers.most_common(),
        "triggers": triggers.most_common(12), "triggerCodes": trigger_codes.most_common(12), "saleFormats": formats.most_common(),
        "leaders": leaders.most_common(12), "labels": labels.most_common(12), "hashtags": hashtags.most_common(12), "themes": themes.most_common(),
        "quality": {field: {"filled": coverage[field], "coverage": round(coverage[field] / total, 4) if total else 0} for field in QUALITY_FIELDS},
        "distribution": {
            "stageDaysMedian": round(statistics.median(stage_days), 1) if stage_days else 0,
            "stageDaysP90": round(percentile(stage_days, .9), 1), "ageDaysMedian": round(statistics.median(ages), 1) if ages else 0,
            "ageDaysP90": round(percentile(ages, .9), 1), "stuckOver90": sum(value > 90 for value in stage_days),
            "amountFilled": len(amounts), "amountMedian": round(statistics.median(amounts), 2) if amounts else 0,
            "odFilled": len(ods), "odMedian": round(statistics.median(ods), 2) if ods else 0,
        },
        "funnel": build_funnel_metrics(offers),
        "complexDeals": {
            "count": sum(complex_groups.values()),
            "share": round(sum(complex_groups.values()) / total, 6) if total else 0,
            "groups": [[group, complex_groups[group]] for group, _ in COMPLEX_DEAL_GROUPS],
        },
        "topAmountEvidence": [item[2] for item in sorted(top_amount, reverse=True)],
        "topStaleEvidence": [item[2] for item in sorted(top_stale, reverse=True)],
    }
    return summary


def entity_type(stage: str) -> str:
    if stage in LEAD_STAGES: return "lead"
    if stage == ACTIVE_DEAL_STAGE: return "activeDeal"
    if stage == COMPLETED_DEAL_STAGE: return "completedDeal"
    return "unknown"


def build_funnel_metrics(offers: dict):
    counts = collections.Counter(entity_type(row["stage"]) for row in offers.values())
    active = counts["activeDeal"]; completed = counts["completedDeal"]; deals = active + completed
    completed_rows = [row for row in offers.values() if entity_type(row["stage"]) == "completedDeal"]
    return {
        "leads": counts["lead"], "activeDeals": active, "completedDeals": completed, "allDeals": deals,
        "leadShare": round(counts["lead"] / len(offers), 6) if offers else 0,
        "completedShareOfDeals": round(completed / deals, 6) if deals else 0,
        "completedAmount": round(sum(row["amount"] for row in completed_rows), 2),
        "completedOd": round(sum(row["od"] for row in completed_rows), 2),
        "completedAmountFilled": sum(bool(row["amount"]) for row in completed_rows),
        "completedOdFilled": sum(bool(row["od"]) for row in completed_rows),
    }


def read_july(path: Path):
    workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    sheet = workbook["все"] if "все" in workbook.sheetnames else workbook[workbook.sheetnames[0]]
    rows = []
    for row in sheet.iter_rows(min_row=5, values_only=True):
        name = str(row[0] or "").strip(); role = str(row[1] or "").strip()
        if not name or not role: continue
        rows.append({"manager": name, "role": role, "clients": safe_num(row[2]), "meetings": safe_num(row[3]),
                     "uniqueMeetings": safe_num(row[4]), "coverage": safe_num(row[5]), "uniqueCoverage": safe_num(row[6])})
    return rows


def read_mood(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source, delimiter=";"))

    def score(row: dict, column: str):
        value = str(row.get(column) or "").strip()
        return int(value) if value in {"1", "2", "3"} else None

    def respondent_id(row: dict):
        return str(row.get("Внешний ID") or "").split("_2026_", 1)[0]

    def created_at(row: dict):
        return dt.datetime.strptime(row["Дата создания ссылки"], "%d.%m.%Y %H:%M:%S")

    response_rows = [row for row in rows if any(score(row, column) is not None for _, _, column in MOOD_QUESTIONS)]
    questions = []
    all_scores = []
    for question_id, label, column in MOOD_QUESTIONS:
        values = [value for row in rows if (value := score(row, column)) is not None]
        all_scores.extend(values)
        distribution = {str(value): values.count(value) for value in (1, 2, 3)}
        questions.append({
            "id": question_id,
            "label": label,
            "answered": len(values),
            "mean": statistics.mean(values) if values else 0,
            "highShare": values.count(3) / len(values) if values else 0,
            "distribution": distribution,
        })

    wave_rows = collections.defaultdict(list)
    for row in rows:
        created = created_at(row)
        week = (created.date() - dt.timedelta(days=created.weekday())).isoformat()
        wave_rows[week].append(row)
    waves = []
    for week, group in sorted(wave_rows.items()):
        responded = [row for row in group if any(score(row, column) is not None for _, _, column in MOOD_QUESTIONS)]
        values = [value for row in responded for _, _, column in MOOD_QUESTIONS if (value := score(row, column)) is not None]
        waves.append({
            "week": week,
            "invitations": len(group),
            "responses": len(responded),
            "mean": statistics.mean(values) if values else 0,
        })

    unique_invited = {respondent_id(row) for row in rows if respondent_id(row)}
    unique_respondents = {respondent_id(row) for row in response_rows if respondent_id(row)}
    return {
        "asOf": "2026-08-31",
        "invitations": len(rows),
        "uniqueInvited": len(unique_invited),
        "responseRows": len(response_rows),
        "uniqueRespondents": len(unique_respondents),
        "completed": sum(row.get("Статус прохожения") == "Пройдено" for row in rows),
        "partial": sum(row.get("Статус прохожения") == "Частично пройдено" for row in rows),
        "responseRate": len(response_rows) / len(rows) if rows else 0,
        "uniqueResponseRate": len(unique_respondents) / len(unique_invited) if unique_invited else 0,
        "overallMean": statistics.mean(all_scores) if all_scores else 0,
        "questions": questions,
        "waves": waves,
        "canMatchManagers": False,
        "linkageNote": "В источнике нет ФИО: внешний ID нельзя надёжно сопоставить с КМ квартальных файлов.",
    }


def filter_by_manager(offers: dict, scope: str, pilot_keys: set[str]):
    if scope == "all":
        return offers
    wants_pilot = scope == "pilot"
    return {
        offer_id: row
        for offer_id, row in offers.items()
        if (normalize_manager(row["manager"]) in pilot_keys) == wants_pilot
    }


def filter_by_product(offers: dict, scope: str):
    if scope == "withFot":
        return offers
    return {offer_id: row for offer_id, row in offers.items() if row["product"] != FOT_PRODUCT}


def delta_rows(before: collections.Counter, after: collections.Counter, limit=None):
    rows = [{"name": name, "before": before[name], "after": after[name], "delta": after[name] - before[name]}
            for name in before.keys() | after.keys()]
    ordered = sorted(rows, key=lambda row: abs(row["delta"]), reverse=True)
    return ordered[:limit] if limit else ordered


def evidence_record(offer_id: str, before: dict | None, after: dict | None, change: str):
    source = after or before or {}
    return {"offerId": offer_id, "client": source.get("client", ""), "clientInn": source.get("clientInn", ""),
            "product": source.get("product", ""), "manager": source.get("manager", ""), "change": change,
            "beforeStage": before.get("stage", "") if before else "", "afterStage": after.get("stage", "") if after else "",
            "amount": source.get("amount", 0), "trigger": source.get("trigger", ""), "comment": source.get("comment", ""),
            "isComplexDeal": any(row and row.get("product") in COMPLEX_DEAL_PRODUCTS for row in (before, after))}


def compare(
    base_key: str,
    target_key: str,
    snapshots,
    july_by_manager,
    required_managers=(),
    write_registry=False,
):
    base, target = snapshots[base_key], snapshots[target_key]
    common = base.keys() & target.keys(); new_ids = target.keys() - base.keys(); gone_ids = base.keys() - target.keys()
    transitions = collections.Counter(); progressed_by_manager = collections.Counter(); global_progressed = 0
    changed_stage = changed_product = changed_manager = changed_leader = 0
    lead_to_deal = completed_transitions = backward_transitions = stopped = 0
    for offer_id in common:
        before, after = base[offer_id], target[offer_id]
        if before["stage"] != after["stage"]:
            changed_stage += 1; transitions[(before["stage"], after["stage"])] += 1
            if STAGE_ORDER.get(after["stage"], 0) > STAGE_ORDER.get(before["stage"], 0):
                global_progressed += 1
                if before["manager"] == after["manager"]:
                    progressed_by_manager[after["manager"]] += 1
            if before["stage"] in LEAD_STAGES and after["stage"] in {ACTIVE_DEAL_STAGE, COMPLETED_DEAL_STAGE}: lead_to_deal += 1
            if before["stage"] == ACTIVE_DEAL_STAGE and after["stage"] == COMPLETED_DEAL_STAGE: completed_transitions += 1
            if STAGE_ORDER.get(after["stage"], 0) < STAGE_ORDER.get(before["stage"], 0): backward_transitions += 1
        elif after.get("stageDays", 0) > 90:
            stopped += 1
        changed_product += before["product"] != after["product"]
        changed_manager += before["manager"] != after["manager"]
        changed_leader += before["leader"] != after["leader"]
    product_base = collections.Counter(row["product"] for row in base.values()); product_target = collections.Counter(row["product"] for row in target.values())
    stage_base = collections.Counter(row["stage"] for row in base.values()); stage_target = collections.Counter(row["stage"] for row in target.values())
    manager_base = collections.Counter(row["manager"] for row in base.values()); manager_target = collections.Counter(row["manager"] for row in target.values())
    format_base = collections.Counter(row["saleFormat"] for row in base.values()); format_target = collections.Counter(row["saleFormat"] for row in target.values())
    trigger_base = collections.Counter(row["triggerCode"] or row["trigger"] or "Не указано" for row in base.values())
    trigger_target = collections.Counter(row["triggerCode"] or row["trigger"] or "Не указано" for row in target.values())
    manager_base_ids = collections.defaultdict(set); manager_target_ids = collections.defaultdict(set)
    target_rows_by_manager = collections.defaultdict(list)
    for offer_id, row in base.items():
        manager_base_ids[row["manager"]].add(offer_id)
    for offer_id, row in target.items():
        manager_target_ids[row["manager"]].add(offer_id); target_rows_by_manager[row["manager"]].append(row)
    managers = []
    manager_names = manager_base.keys() | manager_target.keys()
    existing_manager_keys = {normalize_manager(name) for name in manager_names}
    manager_names |= {
        name for name in required_managers if normalize_manager(name) not in existing_manager_keys
    }
    for name in manager_names:
        if name == "Не указано": continue
        meeting = july_by_manager.get(normalize_manager(name))
        target_rows = target_rows_by_manager[name]
        ages = [row["ageDays"] for row in target_rows if row["ageDays"]]
        stage_days = [row["stageDays"] for row in target_rows if row["stageDays"]]
        base_ids_for_manager = manager_base_ids[name]; target_ids_for_manager = manager_target_ids[name]
        retained_ids_for_manager = base_ids_for_manager & target_ids_for_manager
        retained = len(retained_ids_for_manager); progressed = progressed_by_manager[name]
        complex_base_ids_for_manager = {
            offer_id for offer_id in base_ids_for_manager
            if base[offer_id]["product"] in COMPLEX_DEAL_PRODUCTS
        }
        complex_target_ids_for_manager = {
            offer_id for offer_id in target_ids_for_manager
            if target[offer_id]["product"] in COMPLEX_DEAL_PRODUCTS
        }
        complex_retained_ids_for_manager = (
            complex_base_ids_for_manager & complex_target_ids_for_manager
        )
        complex_progressed_for_manager = sum(
            STAGE_ORDER.get(target[offer_id]["stage"], 0)
            > STAGE_ORDER.get(base[offer_id]["stage"], 0)
            for offer_id in complex_retained_ids_for_manager
        )
        new_for_manager = len(target_ids_for_manager - base_ids_for_manager)
        gone_for_manager = len(base_ids_for_manager - target_ids_for_manager)
        funnel = collections.Counter(entity_type(row["stage"]) for row in target_rows)
        product_mix = collections.Counter(row["product"] for row in target_rows).most_common(4)
        stopped_for_manager = sum(row["stageDays"] > 90 for row in target_rows)
        completed_before = sum(entity_type(base[oid]["stage"]) == "completedDeal" for oid in base_ids_for_manager)
        completed_after = funnel["completedDeal"]
        reliability = "Высокая" if retained >= 100 else "Средняя" if retained >= 30 else "Ограниченная"
        managers.append({"name": name, "before": manager_base[name], "after": manager_target[name], "delta": manager_target[name]-manager_base[name],
                         "retained": retained, "progressed": progressed, "progressRate": round(progressed/retained, 4) if retained else 0,
                         "complexDealBefore": len(complex_base_ids_for_manager),
                         "complexDealAfter": len(complex_target_ids_for_manager),
                         "complexDealDelta": len(complex_target_ids_for_manager)-len(complex_base_ids_for_manager),
                         "complexDealRetained": len(complex_retained_ids_for_manager),
                         "complexDealProgressed": complex_progressed_for_manager,
                         "complexDealProgressRate": round(complex_progressed_for_manager/len(complex_retained_ids_for_manager), 4) if complex_retained_ids_for_manager else 0,
                         "newCount": new_for_manager, "goneCount": gone_for_manager,
                         "retentionRate": round(retained/manager_base[name], 4) if manager_base[name] else 0,
                         "leads": funnel["lead"], "activeDeals": funnel["activeDeal"], "completedDeals": completed_after,
                         "completedDelta": completed_after-completed_before, "stoppedOver90": stopped_for_manager,
                         "stuckRate": round(stopped_for_manager/len(target_rows), 4) if target_rows else 0,
                         "ageMedian": round(statistics.median(ages), 1) if ages else 0,
                         "stageDaysMedian": round(statistics.median(stage_days), 1) if stage_days else 0,
                         "topProducts": product_mix, "reliability": reliability, "isPilot": bool(meeting), "meetings": meeting})
    managers.sort(key=lambda row: (row["progressed"], row["after"]), reverse=True)
    matched = [row for row in managers if row["meetings"]]
    if len(matched) > 2:
        xs = [row["meetings"]["meetings"] for row in matched]; ys = [row["progressed"] for row in matched]
        mean_x, mean_y = statistics.mean(xs), statistics.mean(ys)
        numerator = sum((x-mean_x)*(y-mean_y) for x, y in zip(xs, ys))
        denominator = math.sqrt(sum((x-mean_x)**2 for x in xs) * sum((y-mean_y)**2 for y in ys))
        meeting_correlation = round(numerator/denominator, 3) if denominator else 0
    else: meeting_correlation = 0
    product_delta_all = delta_rows(product_base, product_target)
    complex_base_ids = {offer_id for offer_id, row in base.items() if row["product"] in COMPLEX_DEAL_PRODUCTS}
    complex_target_ids = {offer_id for offer_id, row in target.items() if row["product"] in COMPLEX_DEAL_PRODUCTS}
    complex_retained_ids = complex_base_ids & complex_target_ids
    complex_progressed = sum(
        STAGE_ORDER.get(target[offer_id]["stage"], 0) > STAGE_ORDER.get(base[offer_id]["stage"], 0)
        for offer_id in complex_retained_ids
    )
    complex_product_contributions = [
        row for row in product_delta_all if row["name"] in COMPLEX_DEAL_PRODUCTS
    ]
    complex_group_contributions = []
    for group, products in COMPLEX_DEAL_GROUPS:
        before_count = sum(product_base[product] for product in products)
        after_count = sum(product_target[product] for product in products)
        complex_group_contributions.append({
            "name": group,
            "before": before_count,
            "after": after_count,
            "delta": after_count - before_count,
        })
    driver_products = {row["name"] for row in product_delta_all[:4]}
    changed_evidence = sorted((offer_id for offer_id in common if base[offer_id]["stage"] != target[offer_id]["stage"]),
                              key=lambda oid: target[oid]["amount"], reverse=True)[:8]
    new_evidence = sorted(new_ids, key=lambda oid: target[oid]["amount"], reverse=True)[:6]
    gone_evidence = sorted(gone_ids, key=lambda oid: base[oid]["amount"], reverse=True)[:6]
    driver_new = sorted((oid for oid in new_ids if target[oid]["product"] in driver_products), key=lambda oid: target[oid]["amount"], reverse=True)[:10]
    driver_gone = sorted((oid for oid in gone_ids if base[oid]["product"] in driver_products), key=lambda oid: base[oid]["amount"], reverse=True)[:10]
    registry_count = len(base.keys() | target.keys())
    if write_registry:
        registry = []
        for offer_id in base.keys() | target.keys():
            before = base.get(offer_id); after = target.get(offer_id); source = after or before
            if before and after:
                if before["stage"] != after["stage"]: change = "Смена стадии"
                elif before["product"] != after["product"]: change = "Смена продукта"
                elif before["manager"] != after["manager"]: change = "Смена клиентского менеджера"
                else: change = "Сохранилось без смены стадии"
            elif after: change = "Новое в целевом срезе"
            else: change = "Выбыло из целевого среза"
            registry.append({"offerId": offer_id, "dealId": source.get("dealId", ""), "client": source.get("client", ""),
                             "product": source["product"], "manager": source["manager"],
                             "beforeProduct": before["product"] if before else "", "afterProduct": after["product"] if after else "",
                             "beforeManager": before["manager"] if before else "", "afterManager": after["manager"] if after else "",
                             "beforeStage": before["stage"] if before else "", "afterStage": after["stage"] if after else "",
                             "entityType": entity_type(source["stage"]), "change": change, "amount": source["amount"],
                             "od": source["od"], "stageDays": source["stageDays"], "comment": source["comment"],
                             "isComplexDeal": any(row and row.get("product") in COMPLEX_DEAL_PRODUCTS for row in (before, after))})
        registry_path = REGISTRY_DIR / f"registry-{base_key}-{target_key}.json.gz"
        REGISTRY_DIR.mkdir(parents=True, exist_ok=True)
        with gzip.open(registry_path, "wt", encoding="utf-8", compresslevel=6) as stream:
            json.dump(registry, stream, ensure_ascii=False, separators=(",", ":"))
    base_leads = sum(entity_type(row["stage"]) == "lead" for row in base.values())
    base_active = sum(entity_type(row["stage"]) == "activeDeal" for row in base.values())
    days_between = (dt.date.fromisoformat(AS_OF[target_key]) - dt.date.fromisoformat(AS_OF[base_key])).days
    progress_rate = global_progressed / len(common) if common else 0
    normalized_progress = 1 - (1-progress_rate)**(30/days_between) if days_between and progress_rate < 1 else progress_rate
    top_five_product_delta = sum(row["delta"] for row in sorted(product_delta_all, key=lambda row: abs(row["delta"]), reverse=True)[:5])
    manager_delta_all = delta_rows(manager_base, manager_target)
    top_five_manager_delta = sum(row["delta"] for row in sorted(manager_delta_all, key=lambda row: abs(row["delta"]), reverse=True)[:5])
    return {
        "key": f"{base_key}-{target_key}", "base": base_key, "target": target_key,
        "baseTotal": len(base), "targetTotal": len(target), "net": len(target)-len(base), "newCount": len(new_ids),
        "retainedCount": len(common), "goneCount": len(gone_ids), "changedStage": changed_stage,
        "changedProduct": changed_product, "changedManager": changed_manager, "changedLeader": changed_leader,
        "funnelMovement": {"leadToDeal": lead_to_deal, "completedTransitions": completed_transitions,
                           "backwardTransitions": backward_transitions, "stoppedOver90": stopped,
                           "leadConversionBase": base_leads, "completionBase": base_active},
        "portfolioTurnover": {"newCount": len(new_ids), "goneCount": len(gone_ids), "retainedCount": len(common),
                              "retentionRate": round(len(common)/len(base), 6) if base else 0,
                              "replacementRate": round((len(new_ids)+len(gone_ids))/(len(base)+len(target)), 6) if base or target else 0,
                              "net": len(target)-len(base)},
        "normalizedMovement": {"days": days_between, "progressed": global_progressed,
                               "progressRate": round(progress_rate, 6), "ratePer30Days": round(normalized_progress, 6)},
        "complexDealMovement": {
            "baseCount": len(complex_base_ids), "targetCount": len(complex_target_ids),
            "net": len(complex_target_ids) - len(complex_base_ids),
            "baseShare": round(len(complex_base_ids) / len(base), 6) if base else 0,
            "targetShare": round(len(complex_target_ids) / len(target), 6) if target else 0,
            "shareDeltaPp": round(((len(complex_target_ids) / len(target)) if target else 0) - ((len(complex_base_ids) / len(base)) if base else 0), 6),
            "retainedCount": len(complex_retained_ids),
            "progressed": complex_progressed,
            "progressRate": round(complex_progressed / len(complex_retained_ids), 6) if complex_retained_ids else 0,
            "enteredCount": len(complex_target_ids - complex_base_ids),
            "exitedCount": len(complex_base_ids - complex_target_ids),
            "productContributions": complex_product_contributions,
            "groupContributions": complex_group_contributions,
        },
        "concentration": {"topFiveProductDelta": top_five_product_delta, "topFiveManagerDelta": top_five_manager_delta},
        "registryUrl": f"/data/registry-{base_key}-{target_key}.json.gz", "registryCount": registry_count,
        "stageTransitions": [{"from": a, "to": b, "count": count} for (a, b), count in transitions.most_common(12)],
        "productContributions": product_delta_all, "stageContributions": delta_rows(stage_base, stage_target),
        "managerContributions": manager_delta_all, "formatContributions": delta_rows(format_base, format_target, 8),
        "triggerContributions": delta_rows(trigger_base, trigger_target, 8), "managerPerformance": managers,
        "meetingRelation": {"matchedManagers": len(matched), "correlationWithProgressed": meeting_correlation,
                            "note": "Корреляция не доказывает причинность; июль покрывает только один месяц."},
        "evidence": ([evidence_record(oid, base[oid], target[oid], "Смена стадии") for oid in changed_evidence] +
                     [evidence_record(oid, None, target[oid], "Новый вклад продукта") for oid in driver_new] +
                     [evidence_record(oid, base[oid], None, "Выбыл из продукта") for oid in driver_gone] +
                     [evidence_record(oid, None, target[oid], "Новое в срезе") for oid in new_evidence] +
                     [evidence_record(oid, base[oid], None, "Выбыло из среза") for oid in gone_evidence]),
    }


def main():
    missing = [str(path) for path in [*SOURCES.values(), JULY, MOOD] if not path.exists()]
    if missing: raise SystemExit("Missing source files: " + ", ".join(missing))
    offers = {period: read_offers(path) for period, path in SOURCES.items()}
    full_summaries = {period: summarize_snapshot(period, rows) for period, rows in offers.items()}
    july = read_july(JULY); july_by_manager = {normalize_manager(row["manager"]): row for row in july}
    mood = read_mood(MOOD)
    pilot_keys = {normalize_manager(row["manager"]) for row in july}
    provenance = []
    for period, path in SOURCES.items():
        provenance.append({"id": period, "file": path.name, "path": str(path), "asOf": AS_OF[period], "rows": full_summaries[period]["total"],
                           "sha256": sha256(path), "partial": period == "Q3"})
    provenance.append({"id": "JULY", "file": JULY.name, "path": str(JULY), "asOf": "2026-07-31", "rows": len(july), "sha256": sha256(JULY), "partial": False})
    provenance.append({"id": "MOOD", "file": MOOD.name, "path": str(MOOD), "asOf": mood["asOf"], "rows": mood["invitations"], "sha256": sha256(MOOD), "partial": False})
    views = {}
    for manager_scope in MANAGER_SCOPES:
        manager_snapshots = {
            period: filter_by_manager(rows, manager_scope, pilot_keys)
            for period, rows in offers.items()
        }
        for product_scope in PRODUCT_SCOPES:
            view_snapshots = {
                period: filter_by_product(rows, product_scope)
                for period, rows in manager_snapshots.items()
            }
            view_key = f"{manager_scope}:{product_scope}"
            views[view_key] = {
                "managerScope": manager_scope,
                "productScope": product_scope,
                "snapshots": {
                    period: summarize_snapshot(period, rows)
                    for period, rows in view_snapshots.items()
                },
                "comparisons": {
                    key: compare(
                        *key.split("-"), view_snapshots, july_by_manager,
                        required_managers=[row["manager"] for row in july]
                        if manager_scope == "pilot" else (),
                        write_registry=manager_scope == "all" and product_scope == "withFot",
                    )
                    for key in COMPARISON_KEYS
                },
            }
    dataset = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "provenance": provenance,
        "defaultView": "all:withoutFot", "fotProduct": FOT_PRODUCT,
        "complexDealGroups": [
            {"name": group, "products": list(products)} for group, products in COMPLEX_DEAL_GROUPS
        ],
        "pilotManagers": [row["manager"] for row in july],
        "definitions": {
            "portfolio": "Количество уникальных ID продуктового предложения в срезе.",
            "new": "ID есть в целевом срезе и отсутствует в базовом.", "gone": "ID есть в базовом срезе и отсутствует в целевом.",
            "retained": "ID присутствует в обоих сравниваемых срезах.", "hypothesis": "Интерпретация вклада; не является подтверждённой бизнес-причиной.",
            "lead": "Стадии «Выявление потребности» и «Обсуждение условий».",
            "deal": "Стадии «Реализация сделки» и «Активация продукта»; активация считается завершением сделки.",
            "pilot": "КМ присутствует на листе «все» в июльской выгрузке пилота; сопоставление выполняется по нормализованному точному ФИО.",
            "complexDeal": "Сложная сделка — уникальное продуктовое предложение, отнесённое к коммерческим кредитам, лизингу, факторингу, непокрытым аккредитивам или КОРам. Вес показателя в оценке — 30%.",
        },
        "views": views, "july": july, "moodSurvey": mood,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "bytes": OUTPUT.stat().st_size,
                      "views": len(views), "pilotManagers": len(july),
                      "defaultTotals": {period: views["all:withoutFot"]["snapshots"][period]["total"] for period in SOURCES}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
