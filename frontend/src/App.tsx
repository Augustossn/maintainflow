import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  LayoutDashboard,
  Wrench,
  Boxes,
  CalendarClock,
  Users,
  Package,
  Building2,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowUpRight,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  CircleHelp,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import type {
  Catalog,
  Order,
  Page,
  Session,
  Status,
  Metrics,
  Customer,
  Technician,
} from "./types";
import { statusLabels, transitions } from "./types";
import { request, setSession } from "./lib/api";
import { Button } from "./components/ui/button";
import Kanban from "./components/Kanban";
import OrderTable from "./components/OrderTable";
import OrderForm from "./components/OrderForm";
import OrderDetail from "./components/OrderDetail";
import CatalogView from "./components/CatalogView";
import Dashboard from "./components/Dashboard";
import CardFlip from "./components/kokonutui/card-flip";
type View = "dashboard" | "orders" | Catalog | "notifications" | "help";
const nav = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "orders", label: "Ordens de serviço", icon: Wrench },
  { id: "equipment", label: "Equipamentos", icon: Boxes },
  { id: "maintenance-plans", label: "Planos preventivos", icon: CalendarClock },
  { id: "customers", label: "Clientes", icon: Building2 },
  { id: "technicians", label: "Técnicos", icon: Users },
  { id: "parts", label: "Peças e estoque", icon: Package },
] as const;
function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState("admin@maintainflow.local");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      request<Omit<Session, "mode">>("/auth/login", "POST", {
        email,
        password,
      }),
    onSuccess: (s) => onLogin({ ...s, mode: "api" }),
  });
  return (
    <div className="login">
      <div className="login-story">
        <div className="brand">
          <span className="brand-symbol">
            <Activity />
          </span>
          maintain<span>flow</span>
        </div>
        <span className="eyebrow">MANUTENÇÃO COM CLAREZA</span>
        <h1>
          Mais disponibilidade.
          <br />
          Menos imprevistos.
        </h1>
        <p>Equipamentos, pessoas e manutenção conectados em um único fluxo.</p>
        <div className="login-grid-art">
          <div>
            <Wrench />
            <strong>Operação em dia</strong>
            <span>Da primeira inspeção à entrega.</span>
          </div>
          <div>
            <ShieldCheck />
            <strong>Decisões rastreáveis</strong>
            <span>Histórico em cada etapa.</span>
          </div>
        </div>
        <small>Feito para equipes que mantêm tudo funcionando.</small>
      </div>
      <main className="login-panel">
        <span className="badge healthy">BEM-VINDO AO MAINTAINFLOW</span>
        <h2>Entre no seu espaço</h2>
        <p className="muted">
          Acompanhe sua operação e o próximo passo da equipe.
        </p>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {login.error && (
            <p role="alert" className="error-banner">
              {login.error.message}
            </p>
          )}
          <Button disabled={login.isPending}>
            {login.isPending ? "Entrando…" : "Entrar na plataforma"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="login-divider">
          <span>ou conheça o produto</span>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            onLogin({
              mode: "demo",
              token: "demo",
              role: "Manager",
              name: "Marina Oliveira",
            })
          }
        >
          Explorar demonstração
          <ArrowUpRight size={16} />
        </Button>
        <p className="demo-note">
          A demonstração usa dados simulados salvos neste navegador. Nenhum dado
          é enviado à API.
        </p>
      </main>
    </div>
  );
}
export default function App() {
  const client = useQueryClient();
  const [session, updateSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [newOrder, setNewOrder] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: "",
    customerId: "",
    technicianId: "",
    criticality: "",
    from: "",
    to: "",
  });
  const [error, setError] = useState("");
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: () => request<Metrics>("/dashboard/metrics"),
    enabled: !!session,
  });
  const params = new URLSearchParams({
    page: String(page),
    pageSize: mode === "kanban" ? "100" : "12",
    search,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  });
  const orders = useQuery({
    queryKey: ["orders", mode, page, search, filters],
    queryFn: () => request<Page<Order>>("/work-orders?" + params),
    enabled: !!session,
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => request<Page<Customer>>("/customers?pageSize=100"),
    enabled: !!session,
  });
  const technicians = useQuery({
    queryKey: ["technicians"],
    queryFn: () => request<Page<Technician>>("/technicians?pageSize=100"),
    enabled: !!session,
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      request<
        { id: string; type: string; message: string; createdAt: string }[]
      >("/notifications"),
    enabled: !!session && view === "notifications",
  });
  const status = useMutation({
    mutationFn: ({ o, s }: { o: Order; s: Status }) =>
      request<Order>(`/work-orders/${o.id}/status`, "PATCH", {
        status: s,
        version: o.version,
      }),
    onMutate: async ({ o, s }) => {
      await client.cancelQueries({ queryKey: ["orders"] });
      const previous = client.getQueriesData<Page<Order>>({
        queryKey: ["orders"],
      });
      client.setQueriesData<Page<Order>>({ queryKey: ["orders"] }, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((x) =>
                x.id === o.id ? { ...x, status: s } : x,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) =>
      ctx?.previous.forEach(([key, value]) => client.setQueryData(key, value)),
    onSettled: () => client.invalidateQueries(),
  });
  function login(s: Session) {
    setMobileNav(false);
    setSession(s);
    updateSession(s);
    client.clear();
  }
  function logout() {
    setMobileNav(false);
    setSession(null);
    updateSession(null);
    client.clear();
  }
  async function move(o: Order, s: Status) {
    if (!transitions[o.status].includes(s))
      throw new Error(
        "Esta mudança não é permitida. Abra a ordem para ver as ações disponíveis.",
      );
    if (s === "COMPLETED" || s === "ASSIGNED") {
      setSelected(o.id);
      throw new Error(
        s === "COMPLETED"
          ? "Confirme a entrega nos detalhes para concluir."
          : "Selecione um técnico nos detalhes.",
      );
    }
    await status.mutateAsync({ o, s });
  }
  if (!session) return <Login onLogin={login} />;
  const manager = session.role === "Manager";
  const go = (v: View) => {
    setView(v);
    setMobileNav(false);
    setSearch("");
    setPage(1);
  };
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
        <button
          className="brand"
          onClick={() => go("dashboard")}
          aria-label="MaintainFlow início"
        >
          <span className="brand-symbol">
            <Activity size={23} />
          </span>
          maintain<span>flow</span>
        </button>
        <button className="workspace-select" onClick={() => go("help")}>
          <span className="workspace-icon">M</span>
          <span>
            <strong>Meu workspace</strong>
            <small>Gestão de manutenção</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">PRINCIPAL</span>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === "orders" && (
                <span className="nav-count">
                  {metrics.data?.openOrders ?? "—"}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span>
              <SparkleIcon /> Operação inteligente
            </span>
            <p>Antecipe problemas com o assistente de manutenção.</p>
            <button onClick={() => go("orders")}>
              Conhecer o assistente <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-link" onClick={() => go("help")}>
            <CircleHelp size={18} />
            Guia da plataforma
          </button>
          <div className="profile">
            <span className="avatar">MO</span>
            <span>
              <strong>{session.name}</strong>
              <small>{manager ? "Administradora" : "Técnico"}</small>
            </span>
            <button aria-label="Sair" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobileNav((v) => !v)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {nav.find((n) => n.id === view)?.label ??
                (view === "notifications"
                  ? "Notificações"
                  : "Guia da plataforma")}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className={"connection " + session.mode}>
              <i />
              {session.mode === "demo"
                ? "Demonstração local"
                : "Conectado à API"}
            </span>
            <button
              aria-label="Ver notificações"
              className="notification-button"
              onClick={() => go("notifications")}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="avatar">MO</span>
          </div>
        </header>
        <main className="main-content">
          {view === "dashboard" && (
            <Dashboard
              metrics={metrics.data}
              orders={orders.data?.items ?? []}
              loading={metrics.isPending}
              error={metrics.error?.message}
              onOpen={(o) => setSelected(o.id)}
              onNew={() => setNewOrder(true)}
              onOrders={() => go("orders")}
              manager={manager}
            />
          )}
          {view === "orders" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CONTROLE DA OPERAÇÃO</span>
                  <h1>
                    Ordens de serviço
                    <span className="heading-count">
                      {orders.data?.total ?? 0}
                    </span>
                  </h1>
                  <p>O próximo passo da sua equipe, em um só lugar.</p>
                </div>
                {manager && (
                  <Button onClick={() => setNewOrder(true)}>
                    <Plus size={17} />
                    Nova ordem de serviço
                  </Button>
                )}
              </div>
              <div className="order-tabs">
                <div>
                  <button
                    className={mode === "kanban" ? "selected" : ""}
                    onClick={() => {
                      setMode("kanban");
                      setPage(1);
                    }}
                  >
                    <LayoutGrid size={16} />
                    Quadro Kanban
                  </button>
                  <button
                    className={mode === "table" ? "selected" : ""}
                    onClick={() => {
                      setMode("table");
                      setPage(1);
                    }}
                  >
                    <List size={16} />
                    Lista de ordens
                  </button>
                </div>
                <span className="muted">
                  {orders.data?.total ?? 0} ordens encontradas
                </span>
              </div>
              <div className="toolbar order-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Buscar ordens"
                    placeholder="Buscar ordem ou equipamento…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <select
                  aria-label="Filtrar status"
                  value={filters.status}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, status: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Todos os status</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar cliente"
                  value={filters.customerId}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, customerId: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Todos os clientes</option>
                  {customers.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar técnico"
                  value={filters.technicianId}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, technicianId: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Todos os técnicos</option>
                  {technicians.data?.items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar criticidade"
                  value={filters.criticality}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, criticality: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Todas as criticidades</option>
                  <option value="CRITICAL">Crítica</option>
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Média</option>
                  <option value="LOW">Baixa</option>
                </select>
                <label className="date-filter">
                  De
                  <input
                    aria-label="Período inicial"
                    type="date"
                    value={filters.from.slice(0, 10)}
                    onChange={(e) => {
                      setFilters((f) => ({
                        ...f,
                        from: e.target.value
                          ? e.target.value + "T00:00:00Z"
                          : "",
                      }));
                      setPage(1);
                    }}
                  />
                </label>
                <label className="date-filter">
                  Até
                  <input
                    aria-label="Período final"
                    type="date"
                    value={filters.to.slice(0, 10)}
                    onChange={(e) => {
                      setFilters((f) => ({
                        ...f,
                        to: e.target.value ? e.target.value + "T23:59:59Z" : "",
                      }));
                      setPage(1);
                    }}
                  />
                </label>
              </div>
              {(orders.error || error) && (
                <p role="alert" className="error-banner">
                  {orders.error?.message ?? error}
                  <button
                    onClick={() => {
                      setError("");
                      orders.refetch();
                    }}
                  >
                    Tentar novamente
                  </button>
                </p>
              )}
              {orders.isPending ? (
                <p className="loading">Carregando ordens…</p>
              ) : mode === "kanban" ? (
                <Kanban
                  orders={orders.data?.items ?? []}
                  onOpen={(o) => setSelected(o.id)}
                  onMove={move}
                  disabled={status.isPending}
                />
              ) : (
                <OrderTable
                  orders={orders.data?.items ?? []}
                  onOpen={(o) => setSelected(o.id)}
                />
              )}
              {orders.data?.total === 0 && (
                <div className="empty-state">
                  <Wrench />
                  <h3>Nenhuma ordem por aqui</h3>
                  <p>Altere os filtros ou abra uma nova ordem de serviço.</p>
                </div>
              )}
              <div className="pagination">
                <span>
                  {mode === "kanban"
                    ? "Até 100 ordens por página"
                    : "12 ordens por página"}{" "}
                  · Página {page}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    page * (mode === "kanban" ? 100 : 12) >=
                    (orders.data?.total ?? 0)
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </>
          )}
          {[
            "equipment",
            "customers",
            "technicians",
            "parts",
            "maintenance-plans",
          ].includes(view) && (
            <CatalogView
              key={view}
              catalog={view as Catalog}
              manager={manager}
            />
          )}
          {view === "notifications" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">FIQUE POR DENTRO</span>
                  <h1>Notificações</h1>
                  <p>Alertas de estoque, eventos e pedidos de revisão.</p>
                </div>
              </div>
              <div className="panel">
                {notifications.isPending ? (
                  <p>Carregando…</p>
                ) : notifications.data?.length === 0 ? (
                  <div className="empty-state">
                    <Bell />
                    <h3>Tudo tranquilo por aqui</h3>
                    <p>
                      Os próximos eventos da operação aparecerão neste espaço.
                    </p>
                  </div>
                ) : (
                  notifications.data?.map((n) => (
                    <div className="notification-row" key={n.id}>
                      <Bell size={18} />
                      <div>
                        <strong>{n.type}</strong>
                        <p>{n.message}</p>
                        <small>
                          {new Date(n.createdAt).toLocaleString("pt-BR")}
                        </small>
                      </div>
                    </div>
                  ))
                )}
                {notifications.error && (
                  <p role="alert">{notifications.error.message}</p>
                )}
              </div>
            </>
          )}
          {view === "help" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SEU GUIA RÁPIDO</span>
                  <h1>Uma operação que flui</h1>
                  <p>Do cadastro à entrega, cada etapa tem seu lugar.</p>
                </div>
              </div>
              <div className="onboarding-cards">
                <CardFlip
                  title="Sua próxima manutenção"
                  subtitle="Um fluxo mais simples para a equipe"
                  description="Comece com os ativos e acompanhe cada ordem até a entrega."
                  features={[
                    "Cadastre os ativos",
                    "Planeje as preventivas",
                    "Acompanhe a execução",
                  ]}
                  onStart={() => go("equipment")}
                />
              </div>
              <div className="help-grid">
                {[
                  [
                    "01",
                    "Organize os ativos",
                    "Cadastre clientes, técnicos e equipamentos. Atualize os medidores para gerar preventivas por horas ou quilometragem.",
                  ],
                  [
                    "02",
                    "Planeje e execute",
                    "Crie planos e chamados corretivos. Atribua um técnico e mova as ordens conforme a execução.",
                  ],
                  [
                    "03",
                    "Controle peças e custos",
                    "Registre entradas no estoque. Dentro de uma ordem em andamento, registre o consumo de peças.",
                  ],
                  [
                    "04",
                    "Revise e confirme",
                    "Abra o assistente nos detalhes da ordem, revise as recomendações e confirme explicitamente a entrega para concluir.",
                  ],
                ].map(([n, t, p]) => (
                  <article className="panel" key={n}>
                    <span className="guide-number">{n}</span>
                    <h3>{t}</h3>
                    <p>{p}</p>
                  </article>
                ))}
              </div>
              <div className="notice">
                <AlertTriangle size={20} />
                <p>
                  {session.mode === "demo"
                    ? "Você está na demonstração. Os dados ficam neste navegador; métricas e assistente são simulados. Entre na plataforma para usar a API."
                    : "O assistente usa regras demonstrativas. A execução, o estoque e os custos exigem ação explícita de uma pessoa autorizada."}
                </p>
              </div>
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>MaintainFlow · Tudo funcionando, tudo conectado.</span>
          <span>
            <span className="status-dot completed" />{" "}
            {session.mode === "demo"
              ? "Ambiente de demonstração"
              : "Workspace conectado"}
          </span>
        </footer>
      </div>
      <OrderForm open={newOrder} onClose={() => setNewOrder(false)} />
      {selected && (
        <OrderDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          manager={manager}
        />
      )}
    </div>
  );
}
function SparkleIcon() {
  return <Activity size={16} />;
}
