export type Role = "all" | "senior" | "junior" | "akm";
export type Group = "pilot" | "nonpilot";
export type Metric =
  | "sales"
  | "complex"
  | "complexShare"
  | "meetings"
  | "coverage"
  | "process"
  | "leads"
  | "appeals"
  | "payroll"
  | "recipients";
export type Page = "overview" | "analysis" | "map";
export type PresentationSection =
  | "title"
  | "smo"
  | "sales-model"
  | "strategy"
  | "academy"
  | "tb-tasks";
export type SalesModelView = "premises" | "results" | "next";
export type Stat = {
  assignedOnly?: boolean;
  value: number | null;
  status: "ready" | "missing" | "unverified" | "notApplicable";
  reason?: string;
  observed?: number;
  sample?: number;
  responses?: number;
  numerator?: number;
  denominator?: number;
};
export type Branch = {
  id: string;
  name: string;
  officialName: string;
  tb: string;
  iso: string;
  pilot: boolean;
};
export type Employee = {
  id: string;
  name: string;
  branch: string;
  role: Exclude<Role, "all">;
  rawId: string;
  rawBranch: string;
  row: number;
};
export type Period = Record<Exclude<Metric, "coverage">, Stat> & {
  quarter: number;
  survey?: {
    basis: "surveyCreated";
    questions: (number | null)[];
    weeks: SurveyWeek[];
  };
  salesWeeks?: {
    basis: "lastStageDate";
    weeks: { id: string; start: string; end: string; partial: boolean; count: number }[];
    before: number;
    undated: number;
    after: number;
  };
  funnel?: Partial<Record<"realization" | "activation", NonNullable<Period["salesWeeks"]>>>;
  stages: Record<string, number>;
  complexStages: Record<string, number>;
  products: { name: string; count: number; complex: boolean }[];
  complexProducts: { name: string; count: number; complex: boolean }[];
  employees: { id: string; count: number }[];
};
export type View = {
  periods: Period[];
  coverage: Stat;
  staffCount: number | null;
  kmCount?: number;
  missingMeetingStaff: string[];
};
export type SurveyWeek = {
  id: string; start: string; end: string; partial: boolean;
  questions: (number | null)[];
  process: Stat; leads: Stat;
  sample: number; responses: number;
};
export type Source = {
  file: string;
  sha256: string;
  sheets: {
    name: string;
    rows: number;
    columns: number;
    nonemptyCells: number;
  }[];
};
export type Manifest = {
  version: number;
  year: number;
  asOf: string;
  periods: {
    quarter: number;
    label: string;
    through: string;
    partial: boolean;
  }[];
  branches: Branch[];
  staff: Employee[];
  views: Record<string, View>;
  sources: Source[];
  quality: {
    checks: number;
    meetingMissingStaff: string[];
    unresolvedByQuarter: Record<string, number>;
    unassignedOffersByQuarter?: Record<string, { with: number; without: number; complex: number }>;
    surveyCount: number;
  };
  complexProducts: string[];
};
export type AcademyView = "essence" | "results" | "next";
export type Context = {
  academyView?: AcademyView;
  section: PresentationSection;
  modelView: SalesModelView;
  smoView?: import("./smoNavigation").SmoView;
  slide: number;
  page: Page;
  branch: string;
  role: Role;
  group: "both" | Group;
  scope: "with" | "without";
  quarter: number;
  metric: Metric;
  appealMonth?: number;
  appealBaseMonth?: number;
};
export type Evidence = {
  id?: string;
  quarter?: number;
  employeeId: string;
  name: string;
  branch: string;
  role: Exclude<Role, "all">;
  product?: string;
  fot?: boolean;
  complex?: boolean;
  stage?: string;
  inn?: string;
  client?: string;
  values?: number[];
  date?: string;
  scores?: number[];
  source: string;
  sheet: string;
  row: number;
  basis?: string;
  rawBranch?: string;
  rawInn?: string;
  conflict?: boolean;
};
/** Optional sources are deliberately separate from offer amounts. */
export type PayrollFact = {
  sourceId: string;
  employeeId: string;
  quarter: 1 | 2 | 3;
  volume: number;
  recipients: number;
};
export type AppealFact = {
  sourceId: string;
  employeeId: string;
  quarter: 1 | 2 | 3;
  count: number;
};
