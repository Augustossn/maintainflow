import type {
  Customer,
  Equipment,
  Technician,
  Part,
  Plan,
  Order,
  Metrics,
  Suggestion,
  History,
  Status,
} from "../types";
import { transitions } from "../types";
const uid = () => crypto.randomUUID();
const at = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString();
interface Store {
  customers: Customer[];
  equipment: Equipment[];
  technicians: Technician[];
  parts: Part[];
  "maintenance-plans": Plan[];
  orders: Order[];
  history: History[];
  suggestions: Suggestion[];
  decisions: Record<string, string>;
  notifications: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }[];
}
function seed(): Store {
  const customers = ["Clínica Horizonte", "Grupo Atlas", "Locadora Norte"].map(
    (name, i) => ({
      id: uid(),
      name,
      email: ["clinica", "atlas", "norte"][i] + "@example.com",
    }),
  );
  const technicians = ["Rafael Costa", "Camila Santos", "Bruno Lima"].map(
    (name, i) => ({
      id: uid(),
      name,
      specialty: ["Eletromecânica", "Equipamentos clínicos", "Refrigeração"][i],
      active: true,
    }),
  );
  const names = [
    "Autoclave Stermax 30L",
    "Compressor Atlas GA15",
    "Gerador Honda EU70",
    "Ar-condicionado central",
    "Empilhadeira Toyota",
    "Centrífuga BioSpin",
    "Bomba hidráulica KSB",
    "Monitor multiparamétrico",
  ];
  const titles = [
    "Verificar pressão da autoclave",
    "Troca de filtro e óleo",
    "Falha na partida do gerador",
    "Revisão do sistema de refrigeração",
    "Inspeção do conjunto hidráulico",
    "Calibração e balanceamento",
    "Substituir selo mecânico",
    "Teste de sensores e alarmes",
  ];
  const equipment: Equipment[] = names.map((name, i) => ({
    id: uid(),
    name,
    serialNumber: `EQ-${2401 + i}`,
    customerId: customers[i % 3].id,
    customerName: customers[i % 3].name,
    criticality: i % 3 === 0 ? "CRITICAL" : i % 2 === 0 ? "HIGH" : "MEDIUM",
    available: false,
    mileage: 0,
    usageHours: 1200 + i * 50,
  }));
  const orders: Order[] = equipment.map((e, i) => ({
    id: uid(),
    title: titles[i],
    description:
      "Equipamento apresenta variação durante operação. Inspecionar conforme procedimento do fabricante.",
    equipmentId: e.id,
    equipmentName: e.name,
    customerId: e.customerId,
    customerName: e.customerName,
    technicianId: i % 4 === 0 ? null : technicians[i % 3].id,
    technicianName: i % 4 === 0 ? null : technicians[i % 3].name,
    status: (["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_PARTS"] as Status[])[
      i % 4
    ],
    priority: e.criticality,
    preventive: i % 2 === 1,
    createdAt: at(-3 - i),
    dueAt: at(i - 2),
    completedAt: null,
    cost: 0,
    checklist: ["Verificar conexões", "Testar funcionamento"],
    version: "1",
  }));
  for (let i = 0; i < 18; i++) {
    const e = equipment[i % 8];
    orders.push({
      id: uid(),
      title: "Revisão periódica concluída",
      description: "Limpeza e teste funcional.",
      equipmentId: e.id,
      equipmentName: e.name,
      customerId: e.customerId,
      customerName: e.customerName,
      technicianId: technicians[i % 3].id,
      technicianName: technicians[i % 3].name,
      status: "COMPLETED",
      priority: "MEDIUM",
      preventive: i % 3 !== 0,
      createdAt: at(-i * 9 - 10),
      dueAt: at(-i * 9 - 5),
      completedAt: at(-i * 9 - 6),
      cost: 240 + i * 60,
      checklist: ["Teste funcional"],
      version: "1",
    });
  }
  return {
    customers,
    equipment,
    technicians,
    parts: [
      {
        id: uid(),
        name: "Filtro de óleo",
        sku: "FLT-001",
        stock: 12,
        minimumStock: 5,
        unitCost: 85,
        lowStock: false,
      },
      {
        id: uid(),
        name: "Selo mecânico",
        sku: "SEL-002",
        stock: 2,
        minimumStock: 4,
        unitCost: 240,
        lowStock: true,
      },
      {
        id: uid(),
        name: "Kit de vedação",
        sku: "VED-003",
        stock: 8,
        minimumStock: 3,
        unitCost: 65,
        lowStock: false,
      },
    ],
    "maintenance-plans": equipment.map((e, i) => ({
      id: uid(),
      equipmentId: e.id,
      name: "Revisão periódica — " + e.name,
      trigger: "PERIODIC",
      nextDueAt: at(i === 0 ? -1 : 7 + i),
      nextMeter: null,
      intervalDays: 30,
      meterInterval: 100,
      checklist: ["Inspecionar desgaste", "Limpar e lubrificar"],
    })),
    orders,
    history: orders
      .filter((o) => o.completedAt)
      .map((o) => ({
        id: uid(),
        workOrderId: o.id,
        description: o.title,
        cost: o.cost,
        createdAt: o.completedAt!,
      })),
    suggestions: [],
    decisions: {},
    notifications: [],
  };
}
const key = "maintainflow.demo.v1";
function load(): Store {
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved);
  const data = seed();
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}
function metrics(s: Store): Metrics {
  const completed = s.orders.filter((o) => o.status === "COMPLETED");
  return {
    openOrders: s.orders.filter(
      (o) => !["COMPLETED", "CANCELLED"].includes(o.status),
    ).length,
    completedOrders: completed.length,
    unavailableEquipment: s.equipment.filter((e) => !e.available).length,
    criticalEquipment: s.equipment.filter((e) => e.criticality === "CRITICAL")
      .length,
    overdueOrders: s.orders.filter(
      (o) => !["COMPLETED", "CANCELLED"].includes(o.status) && o.dueAt < at(0),
    ).length,
    lowStockParts: s.parts.filter((p) => p.lowStock).length,
    totalCost: completed.reduce((a, o) => a + o.cost, 0),
    meanRepairHours: 4.5,
    periods: Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      const period = d.toISOString().slice(0, 7);
      const rows = completed.filter((o) => o.completedAt?.startsWith(period));
      return {
        period,
        cost: rows.reduce((a, o) => a + o.cost, 0),
        preventive: rows.filter((o) => o.preventive).length,
        corrective: rows.filter((o) => !o.preventive).length,
      };
    }),
  };
}
export async function demoRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  await new Promise((r) => setTimeout(r, 180));
  const s = load();
  const url = new URL(path, "http://demo");
  const segments = url.pathname.split("/").filter(Boolean);
  const [resource, id, action] = segments;
  const input = body as Record<string, any>;
  let result: unknown;
  const audit = (type: string, message: string) =>
    s.notifications.unshift({ id: uid(), type, message, createdAt: at(0) });
  const order = () => {
    const o = s.orders.find((o) => o.id === id);
    if (!o) throw new Error("Ordem não encontrada.");
    return o;
  };
  if (resource === "dashboard") result = metrics(s);
  else if (resource === "notifications") result = s.notifications;
  else if (resource === "equipment" && action === "history")
    result = s.history.filter(
      (h) => s.orders.find((o) => o.id === h.workOrderId)?.equipmentId === id,
    );
  else if (resource === "work-orders") {
    if (action === "status") {
      const o = order();
      if (o.version !== input.version)
        throw new Error("Ordem alterada. Atualize e tente novamente.");
      if (!transitions[o.status].includes(input.status))
        throw new Error("Transição de status inválida.");
      if (["ASSIGNED", "IN_PROGRESS"].includes(input.status) && !o.technicianId)
        throw new Error("Atribua um técnico primeiro.");
      if (input.status === "COMPLETED" && !input.confirmation?.trim())
        throw new Error("Confirme a entrega para concluir.");
      o.status = input.status;
      o.version = String(+o.version + 1);
      if (o.status === "COMPLETED") {
        o.completedAt = at(0);
        s.history.unshift({
          id: uid(),
          workOrderId: o.id,
          description: o.title,
          cost: o.cost,
          createdAt: at(0),
        });
      }
      if (["COMPLETED", "CANCELLED"].includes(o.status)) {
        s.equipment.find((e) => e.id === o.equipmentId)!.available =
          !s.orders.some(
            (x) =>
              x.equipmentId === o.equipmentId &&
              !["COMPLETED", "CANCELLED"].includes(x.status),
          );
      }
      audit("work-order.status", o.title + " → " + o.status);
      result = o;
    } else if (action === "priority") {
      const o = order();
      if (
        o.version !== input.version ||
        ["COMPLETED", "CANCELLED"].includes(o.status)
      )
        throw new Error("Ordem alterada ou finalizada.");
      o.priority = input.priority;
      o.version = String(+o.version + 1);
      audit("work-order.priority", o.title);
      result = o;
    } else if (action === "assign") {
      const o = order();
      if (
        o.version !== input.version ||
        ["COMPLETED", "CANCELLED"].includes(o.status)
      )
        throw new Error("Ordem alterada ou finalizada.");
      const t = s.technicians.find(
        (t) => t.id === input.technicianId && t.active,
      );
      if (!t) throw new Error("Técnico inválido.");
      o.technicianId = t.id;
      o.technicianName = t.name;
      if (o.status === "OPEN") o.status = "ASSIGNED";
      o.version = String(+o.version + 1);
      result = o;
    } else if (action === "agent-suggestion") {
      const o = order();
      const plan = s["maintenance-plans"].find(
        (p) => p.equipmentId === o.equipmentId,
      );
      const suggestion: Suggestion = {
        id: uid(),
        severity: o.priority,
        probableCauses: [
          {
            text: "Inspecionar desgaste e conexões antes de substituir componentes.",
            source: "regras",
          },
          ...(s.history.some(
            (h) =>
              s.orders.find((x) => x.id === h.workOrderId)?.equipmentId ===
              o.equipmentId,
          )
            ? [
                {
                  text: "Verificar recorrência após a última revisão.",
                  source: "histórico",
                },
              ]
            : []),
        ],
        recommendedChecklist: [
          ...(plan?.checklist ?? []).map((text) => ({ text, source: "plano" })),
          {
            text: "Isolar energia e seguir o procedimento de segurança do fabricante.",
            source: "regras",
          },
          {
            text: "Registrar diagnóstico e teste funcional.",
            source: "regras",
          },
        ],
        suggestedParts: [],
        estimatedDowntime: "4–8 horas (estimativa por regra)",
        requiresTechnicianApproval: true,
        explanation:
          "Agente demonstrativo determinístico. As recomendações exigem revisão do técnico.",
      };
      s.suggestions.push(suggestion);
      s.decisions[suggestion.id + ":order"] = o.id;
      result = suggestion;
    } else if (action === "review-requests") {
      if (!input.reason?.trim()) throw new Error("Informe o motivo.");
      audit("review.requested", order().title + ": " + input.reason);
      result = { id: uid() };
    } else if (method === "POST") {
      const e = s.equipment.find((e) => e.id === input.equipmentId);
      if (!e) throw new Error("Escolha um equipamento.");
      const t = s.technicians.find((t) => t.id === input.technicianId);
      const o: Order = {
        ...input,
        id: uid(),
        equipmentName: e.name,
        customerId: e.customerId,
        customerName: e.customerName,
        technicianId: t?.id ?? null,
        technicianName: t?.name ?? null,
        status: t ? "ASSIGNED" : "OPEN",
        preventive: false,
        createdAt: at(0),
        completedAt: null,
        cost: 0,
        checklist: [],
        version: "1",
      } as unknown as Order;
      s.orders.unshift(o);
      e.available = false;
      audit("work-order.created", o.title);
      result = o;
    } else if (id) result = order();
    else {
      let rows = s.orders;
      const params = url.searchParams;
      const search = params.get("search")?.toLowerCase();
      if (search)
        rows = rows.filter((o) =>
          (o.title + " " + o.equipmentName).toLowerCase().includes(search),
        );
      for (const field of [
        "status",
        "customerId",
        "technicianId",
        "criticality",
      ]) {
        const v = params.get(field);
        if (v)
          rows = rows.filter(
            (o) =>
              (field === "criticality" ? s.equipment.find(e => e.id === o.equipmentId)?.criticality : o[field as "status"]) === v,
          );
      }
      if (params.get("from"))
        rows = rows.filter((o) => o.createdAt >= params.get("from")!);
      if (params.get("to"))
        rows = rows.filter((o) => o.createdAt <= params.get("to")!);
      const page = +(params.get("page") ?? 1),
        size = +(params.get("pageSize") ?? 20);
      result = {
        items: rows.slice((page - 1) * size, page * size),
        total: rows.length,
        pageNumber: page,
        pageSize: size,
      };
    }
  } else if (resource === "agent-suggestions") {
    if (s.decisions[id]) throw new Error("Sugestão já revisada.");
    s.decisions[id] = input.decision;
    const o = s.orders.find((o) => o.id === s.decisions[id + ":order"])!;
    if (input.decision !== "REJECTED")
      o.checklist =
        input.decision === "MODIFIED"
          ? input.checklist
          : s.suggestions
              .find((x) => x.id === id)!
              .recommendedChecklist.map((x) => x.text);
    o.version = String(+o.version + 1);
    audit("agent." + input.decision, o.title);
  } else if (resource === "parts" && action === "movements") {
    const p = s.parts.find((p) => p.id === id)!;
    if (!input.quantity || p.stock + input.quantity < 0)
      throw new Error("Quantidade inválida ou estoque insuficiente.");
    if (input.quantity < 0) {
      const o = s.orders.find((o) => o.id === input.workOrderId);
      if (!o || !["IN_PROGRESS", "WAITING_PARTS"].includes(o.status))
        throw new Error("Saída exige ordem em andamento.");
      o.cost += -input.quantity * p.unitCost;
      o.version = String(+o.version + 1);
    } else if (input.workOrderId)
      throw new Error("Entrada não pode gerar custo em ordem.");
    p.stock += input.quantity;
    p.lowStock = p.stock <= p.minimumStock;
    audit(p.lowStock ? "part.low-stock" : "stock.moved", p.name);
  } else if (resource === "maintenance-plans" && action === "generate") {
    const p = s["maintenance-plans"].find((p) => p.id === id)!;
    const e = s.equipment.find((e) => e.id === p.equipmentId)!;
    const due =
      p.trigger === "HOURS"
        ? e.usageHours >= (p.nextMeter ?? Infinity)
        : p.trigger === "MILEAGE"
          ? e.mileage >= (p.nextMeter ?? Infinity)
          : p.nextDueAt <= at(0);
    if (!due) throw new Error("Plano ainda não está vencido.");
    if (
      s.orders.some(
        (o) =>
          o.preventive &&
          o.equipmentId === e.id &&
          !["COMPLETED", "CANCELLED"].includes(o.status),
      )
    )
      throw new Error("Já existe ordem preventiva aberta.");
    const o: Order = {
      id: uid(),
      title: p.name,
      description: "Manutenção gerada pelo plano.",
      equipmentId: e.id,
      equipmentName: e.name,
      customerId: e.customerId,
      customerName: e.customerName,
      technicianId: null,
      technicianName: null,
      status: "OPEN",
      priority: e.criticality,
      preventive: true,
      createdAt: at(0),
      dueAt: at(2),
      completedAt: null,
      cost: 0,
      checklist: p.checklist,
      version: "1",
    };
    s.orders.unshift(o);
    e.available = false;
    if (["HOURS", "MILEAGE"].includes(p.trigger))
      p.nextMeter = (p.nextMeter ?? 0) + p.meterInterval;
    else p.nextDueAt = at(p.intervalDays);
    audit("work-order.created", p.name);
    result = o;
  } else {
    const list = s[resource as "equipment"] as unknown as Record<string, any>[];
    if (!Array.isArray(list)) throw new Error("Recurso não encontrado.");
    if (method === "DELETE") {
      if (
        (resource === "equipment" &&
          s.orders.some((o) => o.equipmentId === id)) ||
        (resource === "customers" &&
          s.equipment.some((e) => e.customerId === id)) ||
        (resource === "technicians" &&
          s.orders.some((o) => o.technicianId === id))
      )
        throw new Error("Registro vinculado a outros registros.");
      list.splice(
        list.findIndex((x) => x.id === id),
        1,
      );
    } else if (method === "POST" || method === "PUT") {
      const obj =
        method === "PUT"
          ? list.find((x) => x.id === id)
          : {
              id: uid(),
              ...(resource === "parts" ? { stock: 0, lowStock: true } : {}),
              ...(resource === "equipment" ? { available: true } : {}),
            };
      if (!obj) throw new Error("Registro não encontrado.");
      Object.assign(obj, input);
      if (resource === "equipment")
        obj.customerName = s.customers.find(
          (c) => c.id === input.customerId,
        )?.name;
      if (method === "POST") list.push(obj);
      audit(resource + ".saved", obj.name);
      result = obj;
    } else {
      const page = +(url.searchParams.get("page") ?? 1),
        size = +(url.searchParams.get("pageSize") ?? 100),
        search = url.searchParams.get("search")?.toLowerCase();
      const rows = search
        ? list.filter((x) => x.name.toLowerCase().includes(search))
        : list;
      result = id
        ? rows.find((x) => x.id === id)
        : {
            items: rows.slice((page - 1) * size, page * size),
            total: rows.length,
            pageNumber: page,
            pageSize: size,
          };
    }
  }
  localStorage.setItem(key, JSON.stringify(s));
  return result as T;
}
