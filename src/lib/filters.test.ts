import { describe, expect, it } from "vitest";
import type { RegistryRecord } from "../types";
import { normalizeManager, registryRecordInView } from "./filters";

const pilot = new Set([normalizeManager("Иванова Анна")]);
const record: RegistryRecord = {
  offerId: "offer-1",
  dealId: "",
  client: "Клиент",
  product: "Лизинг",
  manager: "Петров Борис",
  beforeProduct: "Лизинг",
  afterProduct: "Лизинг",
  beforeManager: "Иванова Анна",
  afterManager: "Петров Борис",
  beforeStage: "Обсуждение условий",
  afterStage: "Реализация сделки",
  entityType: "activeDeal",
  change: "Смена клиентского менеджера",
  amount: 0,
  od: 0,
  stageDays: 5,
  comment: "",
  isComplexDeal: true,
};

describe("фильтрация полного реестра", () => {
  it("видит переход КМ и в пилоте, и вне пилота", () => {
    expect(registryRecordInView(record, "pilot", "withoutFot", pilot, "ФОТ")).toBe(true);
    expect(registryRecordInView(record, "nonPilot", "withoutFot", pilot, "ФОТ")).toBe(true);
  });

  it("исключает ФОТ отдельно для состояния до и после", () => {
    const fotRecord = { ...record, beforeProduct: "ФОТ", afterProduct: "ФОТ", product: "ФОТ" };
    expect(registryRecordInView(fotRecord, "all", "withoutFot", pilot, "ФОТ")).toBe(false);
    expect(registryRecordInView(fotRecord, "all", "withFot", pilot, "ФОТ")).toBe(true);
  });
});
