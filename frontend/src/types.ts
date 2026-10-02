export type Status =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "COMPLETED"
  | "CANCELLED";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Catalog =
  "equipment" | "customers" | "technicians" | "parts" | "maintenance-plans";
export interface Page<T> {
  items: T[];
  total: number;
  pageNumber: number;
  pageSize: number;
}
export interface Equipment {
  id: string;
  name: string;
  serialNumber: string;
  customerId: string;
  customerName: string;
  criticality: Severity;
  available: boolean;
  mileage: number;
  usageHours: number;
}
export interface Customer {
  id: string;
  name: string;
  email: string;
}
export interface Technician {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
}
export interface Part {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minimumStock: number;
  unitCost: number;
  lowStock: boolean;
}
export interface Plan {
  id: string;
  equipmentId: string;
  name: string;
  trigger: "DATE" | "MILEAGE" | "HOURS" | "PERIODIC";
  nextDueAt: string;
  nextMeter: number | null;
  intervalDays: number;
  meterInterval: number;
  checklist: string[];
}
export interface Order {
  id: string;
  title: string;
  description: string;
  equipmentId: string;
  equipmentName: string;
  customerId: string;
  customerName: string;
  technicianId: string | null;
  technicianName: string | null;
  status: Status;
  priority: Severity;
  equipmentCriticality?: Severity;
  preventive: boolean;
  createdAt: string;
  dueAt: string;
  completedAt: string | null;
  cost: number;
  checklist: string[];
  version: string;
}
export interface PeriodMetric {
  period: string;
  cost: number;
  preventive: number;
  corrective: number;
}
export interface Metrics {
  openOrders: number;
  completedOrders: number;
  unavailableEquipment: number;
  criticalEquipment: number;
  overdueOrders: number;
  lowStockParts: number;
  totalCost: number;
  meanRepairHours: number;
  periods: PeriodMetric[];
}
export interface Suggestion {
  id: string;
  severity: Severity;
  probableCauses: { text: string; source: string }[];
  recommendedChecklist: { text: string; source: string }[];
  suggestedParts: {
    partId: string;
    name: string;
    available: boolean;
    source: string;
  }[];
  estimatedDowntime: string;
  requiresTechnicianApproval: boolean;
  explanation: string;
}
export interface History {
  id: string;
  workOrderId: string;
  description: string;
  cost: number;
  createdAt: string;
}
export interface Session {
  token: string;
  role: "Manager" | "Technician";
  name: string;
  mode: "api" | "demo";
}
export const statusLabels: Record<Status, string> = {
  OPEN: "Abertas",
  ASSIGNED: "Atribuídas",
  IN_PROGRESS: "Em andamento",
  WAITING_PARTS: "Aguardando peças",
  COMPLETED: "Concluídas",
  CANCELLED: "Canceladas",
};
export const priorityLabels: Record<Severity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};
export const transitions: Record<Status, Status[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "COMPLETED", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
