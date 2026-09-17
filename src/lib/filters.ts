import type {
  ManagerScope,
  ProductScope,
  RegistryRecord,
} from "../types";

export const normalizeManager = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru").replaceAll("ё", "е");

export const managerInScope = (
  manager: string,
  scope: ManagerScope,
  pilotManagers: ReadonlySet<string>,
) => {
  if (scope === "all") return true;
  const isPilot = pilotManagers.has(normalizeManager(manager));
  return scope === "pilot" ? isPilot : !isPilot;
};

const snapshotInView = (
  manager: string,
  product: string,
  managerScope: ManagerScope,
  productScope: ProductScope,
  pilotManagers: ReadonlySet<string>,
  fotProduct: string,
) =>
  Boolean(manager && product) &&
  managerInScope(manager, managerScope, pilotManagers) &&
  (productScope === "withFot" || product !== fotProduct);

export const registryRecordInView = (
  row: RegistryRecord,
  managerScope: ManagerScope,
  productScope: ProductScope,
  pilotManagers: ReadonlySet<string>,
  fotProduct: string,
) =>
  snapshotInView(
    row.beforeManager,
    row.beforeProduct,
    managerScope,
    productScope,
    pilotManagers,
    fotProduct,
  ) ||
  snapshotInView(
    row.afterManager,
    row.afterProduct,
    managerScope,
    productScope,
    pilotManagers,
    fotProduct,
  );
