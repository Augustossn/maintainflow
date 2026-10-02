import { useState } from "react";
import { motion } from "motion/react";
import {
  Wrench,
  ArrowUpRight,
  Plus,
  Clock,
  ShieldAlert,
  CircleDollarSign,
  ArrowRight,
  CalendarDays,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Metrics, Order } from "../types";
import { money, date } from "../lib/utils";
import { priorityLabels } from "../types";
import { Button } from "./ui/button";
import { BarChart } from "./charts/bar-chart";
import { Bar } from "./charts/bar";
import { BarXAxis } from "./charts/bar-x-axis";
export default function Dashboard({
  metrics: m,
  orders,
  loading,
  error,
  onOpen,
  onNew,
  onOrders,
  manager,
}: {
  metrics?: Metrics;
  orders: Order[];
  loading: boolean;
  error?: string;
  onOpen: (o: Order) => void;
  onNew: () => void;
  onOrders: () => void;
  manager: boolean;
}) {
  const [chart, setChart] = useState<"cost" | "count">("count");
  const current = new Date().toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const active = orders.filter(
    (o) => !["COMPLETED", "CANCELLED"].includes(o.status),
  );
  const upcoming = [...active]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);
  const cards = [
    {
      label: "Ordens em aberto",
      value: m?.openOrders,
      icon: Wrench,
      detail: `${m?.overdueOrders ?? 0} precisam de atenção`,
      color: "green",
    },
    {
      label: "Custo de manutenção",
      value: m ? money(m.totalCost) : undefined,
      icon: CircleDollarSign,
      detail: "Total das ordens concluídas",
      color: "blue",
    },
    {
      label: "Tempo médio de reparo",
      value: m ? `${m.meanRepairHours} h` : undefined,
      icon: Clock,
      detail: "Do início à conclusão",
      color: "orange",
    },
    {
      label: "Equipamentos críticos",
      value: m?.criticalEquipment,
      icon: ShieldAlert,
      detail: `${m?.unavailableEquipment ?? 0} ativos indisponíveis`,
      color: "purple",
    },
  ];
  const chartData =
    m?.periods.map((p) => ({
      name: new Date(p.period + "-15")
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", ""),
      preventive: p.preventive,
      corrective: p.corrective,
      cost: p.cost,
    })) ?? [];
  const total = m ? m.completedOrders + m.openOrders : 0;
  const percent =
    total && m ? Math.round((m.completedOrders / total) * 100) : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PAINEL DE OPERAÇÃO / MAINTAINFLOW</span>
          <h1>
            Visão geral
            <span className="greeting-dot" />
          </h1>
          <p>Disponibilidade, prazos e trabalho em campo.</p>
        </div>
        <div className="heading-actions">
          <span className="date-display">
            <CalendarDays size={16} />
            {current}
          </span>
          {manager && (
            <Button onClick={onNew}>
              <Plus size={17} />
              Nova ordem
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="welcome-strip">
        <div className="welcome-icon">
          <Activity size={24} />
        </div>
        <div>
          <strong>{m?.overdueOrders ?? 0} ordens pedem atenção hoje.</strong>
          <p>
            Confira os prazos vencidos antes de distribuir o próximo serviço.
          </p>
        </div>
        <button onClick={onOrders}>
          Ver minha operação
          <ArrowRight size={17} />
        </button>
        <span className="welcome-decoration">⌁</span>
      </div>
      <div className="metric-grid">
        {cards.map((c, i) => (
          <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={c.label}
            className="metric-card"
          >
            <div className="metric-top">
              <span>{c.label}</span>
              <span className={"metric-icon " + c.color}>
                <c.icon size={19} />
              </span>
            </div>
            <strong className="metric-value">
              {loading ? "—" : (c.value ?? "—")}
            </strong>
            <div className="metric-detail">
              <span className={"mini-dot " + c.color} />
              {c.detail}
            </div>
          </motion.article>
        ))}
      </div>
      <div className="dashboard-charts">
        <section className="panel activity-panel">
          <div className="section-heading">
            <div>
              <h2>Manutenção ao longo do tempo</h2>
              <p>Volume de serviços · histórico dos últimos seis meses</p>
            </div>
            <select
              aria-label="Indicador do gráfico"
              value={chart}
              onChange={(e) => setChart(e.target.value as "cost" | "count")}
            >
              <option value="count">Últimos 6 meses · Ordens</option>
              <option value="cost">Últimos 6 meses · Custos</option>
            </select>
          </div>
          <div className="chart-legend">
            {chart === "count" ? (
              <>
                <span>
                  <i className="legend-green" />
                  Preventiva
                </span>
                <span>
                  <i className="legend-lime" />
                  Corretiva
                </span>
              </>
            ) : (
              <span>
                <i className="legend-green" />
                Custo das ordens concluídas
              </span>
            )}
          </div>
          <div
            className="chart-area"
            role="img"
            aria-label="Gráfico de manutenção nos últimos seis meses. Os valores estão disponíveis na tabela abaixo."
          >
            {m ? (
              <BarChart
                key={chart}
                data={chartData}
                xDataKey="name"
                aspectRatio="2.65 / 1"
                margin={{ top: 20, right: 18, bottom: 35, left: 30 }}
              >
                <Bar
                  dataKey={chart === "cost" ? "cost" : "preventive"}
                  fill="#267563"
                  lineCap={5}
                />
                {chart === "count" && (
                  <Bar dataKey="corrective" fill="#c4dba4" lineCap={5} />
                )}
                <BarXAxis />
              </BarChart>
            ) : (
              <p className="loading">
                {loading ? "Carregando indicadores…" : "Sem dados disponíveis."}
              </p>
            )}
          </div>
          <details className="chart-data">
            <summary>Ver dados do gráfico</summary>
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Preventivas</th>
                  <th>Corretivas</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {m?.periods.map((p) => (
                  <tr key={p.period}>
                    <td>{p.period}</td>
                    <td>{p.preventive}</td>
                    <td>{p.corrective}</td>
                    <td>{money(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
        <section className="panel health-panel">
          <div className="section-heading">
            <div>
              <h2>Ritmo da operação</h2>
              <p>Ordens concluídas e em aberto.</p>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <div
            className="ring-chart"
            style={{
              background: `conic-gradient(#267563 ${percent * 3.6}deg, #eef1ed 0deg)`,
            }}
          >
            <div>
              <strong>{percent}%</strong>
              <span>concluídas</span>
            </div>
          </div>
          <div className="health-stat">
            <span>
              <i className="legend-green" />
              Concluídas
            </span>
            <strong>{m?.completedOrders ?? "—"}</strong>
          </div>
          <div className="health-stat">
            <span>
              <i className="legend-neutral" />
              Em aberto
            </span>
            <strong>{m?.openOrders ?? "—"}</strong>
          </div>
          <div className="health-note">
            <ShieldAlert size={16} />
            <span>{m?.overdueOrders ?? 0} ordens com prazo vencido</span>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel upcoming-panel">
          <div className="section-heading">
            <div>
              <h2>Prioridades da equipe</h2>
              <p>Ordens com os prazos mais próximos.</p>
            </div>
            <button className="text-link" onClick={onOrders}>
              Ver todas
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ordem / Equipamento</th>
                  <th>Prioridade</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {upcoming.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button className="table-title" onClick={() => onOpen(o)}>
                        {o.title}
                        <small>{o.equipmentName}</small>
                      </button>
                    </td>
                    <td>
                      <span
                        className={"badge priority-" + o.priority.toLowerCase()}
                      >
                        <i />
                        {priorityLabels[o.priority]}
                      </span>
                    </td>
                    <td>
                      <span className="table-person">
                        {o.technicianName && (
                          <span className="avatar avatar-small">
                            {o.technicianName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        )}
                        {o.technicianName ?? "Não atribuído"}
                      </span>
                    </td>
                    <td
                      className={
                        new Date(o.dueAt) < new Date() ? "overdue" : ""
                      }
                    >
                      {date(o.dueAt)}
                    </td>
                    <td>
                      <button
                        className="row-arrow"
                        aria-label={"Abrir " + o.title}
                        onClick={() => onOpen(o)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!upcoming.length && (
              <p className="empty-state">Nenhuma ordem pendente.</p>
            )}
          </div>
        </section>
        <section className="attention-panel">
          <div className="attention-heading">
            <span className="attention-icon">
              <AlertTriangle size={20} />
            </span>
            <span className="eyebrow">PONTOS DE ATENÇÃO</span>
          </div>
          <h2>Antes de ir a campo.</h2>
          <p>Estoque e prazos que precisam de uma decisão.</p>
          <div className="attention-item">
            <PackageIcon />
            <span>
              <strong>{m?.lowStockParts ?? 0} peças com estoque baixo</strong>
              <small>Confira a reposição antes do reparo.</small>
            </span>
          </div>
          <div className="attention-item">
            <Clock size={17} />
            <span>
              <strong>{m?.overdueOrders ?? 0} ordens atrasadas</strong>
              <small>Reorganize as prioridades da equipe.</small>
            </span>
          </div>
          <Button variant="outline" onClick={onOrders}>
            Organizar ordens
            <ArrowRight size={16} />
          </Button>
        </section>
      </div>
    </>
  );
}
function PackageIcon() {
  return <Wrench size={17} />;
}
