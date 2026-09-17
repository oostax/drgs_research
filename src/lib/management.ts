import type {
  AnalyticsView,
  ComparisonSummary,
  DeepSignal,
  ManagementSignal,
  SnapshotSummary,
} from "../types";
import { decimal, fmt, pct } from "./format";

const contribution = (
  rows: ComparisonSummary["productContributions"],
  direction: "up" | "down",
) =>
  rows
    .filter((row) => (direction === "up" ? row.delta > 0 : row.delta < 0))
    .sort((a, b) =>
      direction === "up" ? b.delta - a.delta : a.delta - b.delta,
    )[0];

export function buildSignals(
  view: AnalyticsView,
  comparison: ComparisonSummary,
): ManagementSignal[] {
  const target = view.snapshots[comparison.target];
  const up = contribution(comparison.productContributions, "up");
  const down = contribution(comparison.productContributions, "down");
  const transition = comparison.stageTransitions[0];
  const missingDeal = 1 - target.quality.dealId.coverage;
  const signals: ManagementSignal[] = [];
  const formatDriver = [...comparison.formatContributions].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];
  const keyEvidence = (product: string) =>
    comparison.evidence.filter((row) => row.product === product).slice(0, 5);
  if (comparison.net < 0 && down)
    signals.push({
      id: "main-decline",
      type: "Факт",
      severity: "risk",
      confidence: "Высокая",
      title: `${down.name}: ${fmt(down.delta)}`,
      fact: `Категория изменилась с ${fmt(down.before)} до ${fmt(down.after)}. Формат «${formatDriver.name}» изменился на ${fmt(formatDriver.delta)}.`,
      interpretation:
        "Совпадение продуктового и форматного вклада указывает на изменение состава портфеля, но внешняя причина в данных не зафиксирована.",
      action:
        "Проверить выбывшие предложения продукта и правила формирования среза.",
      evidence: keyEvidence(down.name),
    });
  if (comparison.net >= 0 && up)
    signals.push({
      id: "main-growth",
      type: "Факт",
      severity: "growth",
      confidence: "Высокая",
      title: `${up.name}: +${fmt(up.delta)}`,
      fact: `Категория выросла с ${fmt(up.before)} до ${fmt(up.after)}. Формат «${formatDriver.name}» дал ${formatDriver.delta > 0 ? "+" : ""}${fmt(formatDriver.delta)}.`,
      interpretation:
        "Рост количества и форматный вклад подтверждены; коммерческий результат требует проверки стадий и сумм.",
      action:
        "Проверить долю новых предложений, продвинувшихся дальше выявления потребности.",
      evidence: keyEvidence(up.name),
    });
  if (transition)
    signals.push({
      id: "stage-progress",
      type: "Факт",
      severity: "growth",
      confidence: "Высокая",
      title: `${fmt(transition.count)} переходов по стадиям`,
      fact: `Самый частый переход: «${transition.from}» → «${transition.to}».`,
      interpretation:
        "Это движение сохранившихся предложений, а не изменение состава среза.",
      action:
        "Разобрать переход по продуктам и клиентским менеджерам и закрепить работающую практику.",
      evidence: comparison.evidence
        .filter((row) => row.change === "Смена стадии")
        .slice(0, 6),
    });
  signals.push({
    id: "stale-portfolio",
    type: "Вероятное объяснение",
    severity: "attention",
    confidence: "Средняя",
    title: `${fmt(target.distribution.stuckOver90)} предложений на стадии более 90 дней`,
    fact: `Медиана текущей стадии — ${fmt(target.distribution.stageDaysMedian)} дней, 90-й перцентиль — ${fmt(target.distribution.stageDaysP90)} дней.`,
    interpretation:
      "Высокий возраст может указывать на зависание, но норматив стадии в источнике не задан.",
    action:
      "Согласовать нормативы стадий и проверить самые возрастные предложения.",
    evidence: target.topStaleEvidence.slice(0, 5),
  });
  signals.push({
    id: "data-quality",
    type: "Факт",
    severity: "attention",
    confidence: "Высокая",
    title: `${pct(missingDeal * 100)} без идентификатора сделки`,
    fact: `Идентификатор сделки отсутствует у ${fmt(target.total - target.quality.dealId.filled)} записей.`,
    interpretation:
      "Это ограничивает проверку результата на уровне состоявшихся сделок.",
    action: "Контролировать заполнение идентификатора сделки.",
    evidence: [],
  });
  signals.push({
    id: "explanation-limit",
    type: "Факт",
    severity: "attention",
    confidence: "Высокая",
    title: `Прямая причина есть только у ${pct(target.quality.notes.coverage * 100)} записей`,
    fact: `Заметки клиентского менеджера заполнены у ${fmt(target.quality.notes.filled)} из ${fmt(target.total)} предложений; поле потенциала — у ${pct(target.quality.potential.coverage * 100)}.`,
    interpretation:
      "Текстовые темы помогают находить контекст, но массово объяснить причины изменений по заметкам невозможно.",
    action:
      "Добавить обязательную структурированную причину выбытия и задержки на стадии.",
    evidence: target.topAmountEvidence.filter((row) => row.comment).slice(0, 5),
  });
  if (comparison.meetingRelation.matchedManagers > 2)
    signals.push({
      id: "meeting-relation",
      type: "Вероятное объяснение",
      severity: "attention",
      confidence: "Ограниченная",
      title: `Связь встреч и продвижения: ${decimal(comparison.meetingRelation.correlationWithProgressed)}`,
      fact: `Сопоставлено ${comparison.meetingRelation.matchedManagers} клиентских менеджеров; коэффициент рассчитан между июльскими встречами и числом продвинутых предложений.`,
      interpretation:
        "Связь положительная, но слабая или умеренная и не доказывает влияние встреч.",
      action:
        "Накопить встречи за полный квартал и сравнить долю продвижения с поправкой на размер портфеля.",
      evidence: [],
    });
  return signals;
}

export const confidenceSummary = (snapshot: SnapshotSummary) =>
  `${fmt(snapshot.total)} уникальных предложений · ${snapshot.partial ? "неполный период" : "закрытый квартальный срез"}`;

export function buildDeepSignals(
  view: AnalyticsView,
  comparison: ComparisonSummary,
): DeepSignal[] {
  const base = view.snapshots[comparison.base];
  const target = view.snapshots[comparison.target];
  if (!comparison.baseTotal && !comparison.targetTotal) return [];
  const manager = [...comparison.managerContributions].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];
  const format = [...comparison.formatContributions].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];
  const signals: DeepSignal[] = [
    {
      id: "quality",
      type: "Ограничение данных",
      severity: "attention",
      title: "Заполняемость полей ограничивает объяснение причин",
      value: `ID сделки заполнен у ${pct(target.quality.dealId.coverage * 100)}`,
      explanation: `Триггер заполнен у ${pct(target.quality.trigger.coverage * 100)}, потенциал — у ${pct(target.quality.potential.coverage * 100)}, комментарий КМ — у ${pct(target.quality.notes.coverage * 100)} записей.`,
      action:
        "Согласовать обязательные поля для причины, потенциала и результата предложения.",
    },
    {
      id: "concentration",
      type: "Факт",
      severity:
        Math.abs(manager.delta) > Math.abs(comparison.net)
          ? "attention"
          : "growth",
      title: "Концентрация движения среди клиентских менеджеров",
      value: `${manager.name}: ${manager.delta >= 0 ? "+" : ""}${fmt(manager.delta)}`,
      explanation: `Суммарный вклад пяти крупнейших изменений КМ: ${comparison.concentration.topFiveManagerDelta >= 0 ? "+" : ""}${fmt(comparison.concentration.topFiveManagerDelta)}.`,
      action:
        "Проверить, не связан ли общий результат с передачей или массовым обновлением портфелей отдельных КМ.",
      evidenceFilter: "movement",
    },
    {
      id: "work-model",
      type: "Вероятное объяснение",
      severity: "attention",
      title: "Изменение структуры форматов продажи",
      value: `${format.name}: ${format.delta >= 0 ? "+" : ""}${fmt(format.delta)}`,
      explanation:
        "Изменение формата продажи совпадает с изменением портфеля. Причинная связь не подтверждена.",
      action:
        "Сравнить продуктовый состав и переходы стадий внутри каждого формата.",
      evidenceFilter: format.name,
    },
    {
      id: "speed",
      type: "Факт",
      severity:
        comparison.normalizedMovement.ratePer30Days < 0.03 ? "risk" : "growth",
      title: "Нормализованная скорость продвижения",
      value: `${pct(comparison.normalizedMovement.ratePer30Days * 100)} за 30 дней`,
      explanation: `${fmt(comparison.normalizedMovement.progressed)} из ${fmt(comparison.retainedCount)} сохранившихся предложений продвинулись за ${comparison.normalizedMovement.days} дней.`,
      action:
        "Сопоставить скорость с размером сохранённой базы и длительностью периода.",
      evidenceFilter: "Смена стадии",
    },
    {
      id: "tail",
      type:
        target.distribution.stageDaysP90 > base.distribution.stageDaysP90 &&
        target.distribution.stageDaysMedian <= base.distribution.stageDaysMedian
          ? "Аномалия"
          : "Факт",
      severity: "risk",
      title: "Длительность стадии: медиана и 90-й процентиль",
      value: `Медиана ${fmt(base.distribution.stageDaysMedian)} → ${fmt(target.distribution.stageDaysMedian)} дней`,
      explanation: `90-й процентиль: ${fmt(base.distribution.stageDaysP90)} → ${fmt(target.distribution.stageDaysP90)} дней. Более 90 дней на стадии: ${fmt(target.distribution.stuckOver90)} предложений.`,
      action:
        "Проверить предложения верхних десяти процентов по длительности стадии.",
      evidenceFilter: "stale",
    },
  ];
  if (comparison.changedManager)
    signals.push({
      id: "responsibility",
      type: "Ограничение данных",
      severity: "attention",
      title: "Часть движения совпала со сменой ответственности",
      value: `${fmt(comparison.changedManager)} смен клиентского менеджера`,
      explanation: `${pct(comparison.retainedCount ? (comparison.changedManager / comparison.retainedCount) * 100 : 0)} сохранившихся предложений сменили ответственного. Это не является оценкой качества работы.`,
      action: "Отделять передачу портфеля от притока и выбытия.",
      evidenceFilter: "Смена клиентского менеджера",
    });
  return signals;
}
