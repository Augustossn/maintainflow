import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "vaul";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Package,
  CalendarClock,
  ArrowUpRight,
} from "lucide-react";
import type { Catalog, Customer, Equipment, Page, Part } from "../types";
import { request } from "../lib/api";
import { date, money } from "../lib/utils";
import { Button } from "./ui/button";
type Row = { id: string; name: string; [key: string]: any };
const labels: Record<Catalog, string> = {
  equipment: "Equipamentos",
  customers: "Clientes",
  technicians: "Técnicos",
  parts: "Peças e estoque",
  "maintenance-plans": "Planos preventivos",
};
const text = z.string().min(1, "Campo obrigatório.").max(2000);
const schemas = {
  customers: z.object({ name: text, email: z.email("E-mail inválido.") }),
  technicians: z.object({ name: text, specialty: text, active: z.boolean() }),
  parts: z.object({
    name: text,
    sku: text,
    minimumStock: z.number().int().min(0),
    unitCost: z.number().min(0),
  }),
  equipment: z.object({
    name: text,
    serialNumber: text,
    customerId: text,
    criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    mileage: z.number().min(0),
    usageHours: z.number().min(0),
  }),
  "maintenance-plans": z.object({
    name: text,
    equipmentId: text,
    trigger: z.enum(["DATE", "MILEAGE", "HOURS", "PERIODIC"]),
    nextDueAt: text,
    nextMeter: z.number().min(0),
    intervalDays: z.number().int().min(1),
    meterInterval: z.number().positive(),
    checklist: text,
  }),
};
function Editor({
  catalog,
  row,
  onClose,
}: {
  catalog: Catalog;
  row: Row | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => request<Page<Customer>>("/customers?pageSize=100"),
  });
  const equipment = useQuery({
    queryKey: ["equipment"],
    queryFn: () => request<Page<Equipment>>("/equipment?pageSize=100"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, any>>({
    resolver: zodResolver(schemas[catalog] as any) as any,
    defaultValues: {
      name: "",
      active: true,
      criticality: "MEDIUM",
      mileage: 0,
      usageHours: 0,
      minimumStock: 3,
      unitCost: 0,
      trigger: "PERIODIC",
      intervalDays: 30,
      meterInterval: 100,
      nextMeter: 100,
      nextDueAt: new Date().toISOString().slice(0, 16),
      checklist: "Inspecionar desgaste\nTestar funcionamento",
      ...row,
      ...(row && catalog === "maintenance-plans"
        ? {
            checklist: row.checklist.join("\n"),
            nextDueAt: row.nextDueAt.slice(0, 16),
            nextMeter: row.nextMeter ?? 100,
          }
        : {}),
    },
  });
  const save = useMutation({
    mutationFn: (values: Record<string, any>) =>
      request(
        "/" + catalog + (row ? "/" + row.id : ""),
        row ? "PUT" : "POST",
        catalog === "maintenance-plans"
          ? {
              ...values,
              checklist: values.checklist.split("\n").filter(Boolean),
              nextDueAt: new Date(values.nextDueAt).toISOString(),
            }
          : values,
      ),
    onSuccess: () => {
      client.invalidateQueries();
      onClose();
    },
  });
  const field = (name: string, label: string, type = "text") => (
    <label key={name}>
      {label}
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        {...register(name, type === "number" ? { valueAsNumber: true } : {})}
        aria-invalid={!!errors[name]}
      />
      {errors[name] && (
        <span role="alert" className="field-error">
          {String(errors[name]?.message)}
        </span>
      )}
    </label>
  );
  return (
    <Drawer.Root open onOpenChange={(v) => !v && onClose()} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="drawer-overlay" />
        <Drawer.Content className="drawer-content">
          <Drawer.Title className="drawer-title">
            {row ? "Editar" : "Novo cadastro"} · {labels[catalog]}
          </Drawer.Title>
          <Drawer.Description className="muted">
            Mantenha os dados da operação atualizados.
          </Drawer.Description>
          <button
            aria-label="Fechar cadastro"
            className="drawer-close"
            onClick={onClose}
          >
            <X />
          </button>
          <form
            className="form-stack"
            onSubmit={handleSubmit((v) => save.mutate(v))}
          >
            {field("name", "Nome")}
            {catalog === "customers" && field("email", "E-mail", "email")}
            {catalog === "technicians" && (
              <>
                {field("specialty", "Especialidade")}
                <label className="checkbox-label">
                  <input type="checkbox" {...register("active")} /> Técnico
                  ativo
                </label>
              </>
            )}
            {catalog === "parts" && (
              <>
                {field("sku", "SKU")}
                <div className="form-row">
                  {field("minimumStock", "Estoque mínimo", "number")}
                  {field("unitCost", "Custo unitário (R$)", "number")}
                </div>
                <p className="muted">
                  O saldo é alterado por movimentações de estoque.
                </p>
              </>
            )}
            {catalog === "equipment" && (
              <>
                {field("serialNumber", "Número de série")}
                <label>
                  Cliente
                  <select {...register("customerId")}>
                    <option value="">Selecione</option>
                    {customers.data?.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.customerId && (
                    <span role="alert" className="field-error">
                      Selecione o cliente.
                    </span>
                  )}
                </label>
                <label>
                  Criticidade
                  <select {...register("criticality")}>
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </label>
                <div className="form-row">
                  {field("mileage", "Quilometragem", "number")}
                  {field("usageHours", "Horas de uso", "number")}
                </div>
              </>
            )}
            {catalog === "maintenance-plans" && (
              <>
                <label>
                  Equipamento
                  <select {...register("equipmentId")}>
                    <option value="">Selecione</option>
                    {equipment.data?.items.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  {errors.equipmentId && (
                    <span role="alert" className="field-error">
                      Selecione o equipamento.
                    </span>
                  )}
                </label>
                <label>
                  Gatilho
                  <select {...register("trigger")}>
                    <option value="PERIODIC">Periodicidade</option>
                    <option value="DATE">Data</option>
                    <option value="MILEAGE">Quilometragem</option>
                    <option value="HOURS">Horas de uso</option>
                  </select>
                </label>
                {field("nextDueAt", "Próxima data", "datetime-local")}
                <div className="form-row">
                  {field("intervalDays", "Intervalo em dias", "number")}
                  {field("nextMeter", "Próximo medidor", "number")}
                </div>
                {field("meterInterval", "Intervalo do medidor", "number")}
                <label>
                  Checklist (uma tarefa por linha)
                  <textarea rows={4} {...register("checklist")} />
                </label>
              </>
            )}
            {(save.error || customers.error || equipment.error) && (
              <p role="alert" className="error-banner">
                {(save.error || customers.error || equipment.error)?.message}
              </p>
            )}
            <div className="form-footer">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar cadastro"}
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
export default function CatalogView({
  catalog,
  manager,
}: {
  catalog: Catalog;
  manager: boolean;
}) {
  const client = useQueryClient();
  const [editor, setEditor] = useState<Row | null | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stock, setStock] = useState<Part | null>(null);
  const [qty, setQty] = useState(1);
  const data = useQuery({
    queryKey: [catalog, "list", page, search],
    queryFn: () =>
      request<Page<Row>>(
        `/${catalog}?page=${page}&pageSize=12&search=${encodeURIComponent(search)}`,
      ),
  });
  const mutate = useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => request(path, method, body),
    onSuccess: () => {
      client.invalidateQueries();
      setDeleting(null);
      setStock(null);
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO</span>
          <h1>{labels[catalog]}</h1>
          <p>Informação organizada para uma manutenção mais eficiente.</p>
        </div>
        {manager && (
          <Button onClick={() => setEditor(null)}>
            <Plus size={17} />
            Novo cadastro
          </Button>
        )}
      </div>
      <div className="toolbar">
        <label className="search-field">
          <input
            aria-label="Buscar cadastros"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome…"
          />
        </label>
        <span className="muted">{data.data?.total ?? 0} registros</span>
      </div>
      {data.isPending ? (
        <p className="loading">Carregando cadastros…</p>
      ) : (
        <div className="catalog-grid">
          {data.data?.items.map((row) => (
            <article className="catalog-card" key={row.id}>
              <div className="catalog-icon">
                {catalog === "parts" ? (
                  <Package size={22} />
                ) : catalog === "maintenance-plans" ? (
                  <CalendarClock size={22} />
                ) : (
                  <span>{row.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h3>{row.name}</h3>
              <p>
                {row.serialNumber ??
                  row.specialty ??
                  row.email ??
                  row.sku ??
                  equipmentName(row)}
              </p>
              {catalog === "equipment" && (
                <>
                  <span
                    className={
                      "badge " + (row.available ? "healthy" : "priority-high")
                    }
                  >
                    {row.available ? "Disponível" : "Em manutenção"}
                  </span>
                  <p>
                    {row.customerName} · {row.usageHours} h
                  </p>
                </>
              )}
              {catalog === "parts" && (
                <>
                  <strong className="stock-value">
                    {row.stock} <small>em estoque</small>
                  </strong>
                  <p>
                    {money(row.unitCost)} / unidade · mínimo {row.minimumStock}
                  </p>
                  {row.lowStock && (
                    <span className="badge priority-high">Estoque baixo</span>
                  )}
                </>
              )}
              {catalog === "maintenance-plans" && (
                <>
                  <span className="badge">
                    {
                      (
                        {
                          DATE: "Por data",
                          PERIODIC: "Periódica",
                          MILEAGE: "Quilometragem",
                          HOURS: "Horas de uso",
                        } as Record<string, string>
                      )[row.trigger]
                    }
                  </span>
                  <p>
                    Próxima:{" "}
                    {["MILEAGE", "HOURS"].includes(row.trigger)
                      ? row.nextMeter
                      : date(row.nextDueAt)}
                  </p>
                </>
              )}
              {manager && (
                <div className="catalog-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditor(row)}
                  >
                    <Pencil size={14} />
                    Editar
                  </Button>
                  {deleting === row.id ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={mutate.isPending}
                      onClick={() =>
                        mutate.mutate({
                          path: `/${catalog}/${row.id}`,
                          method: "DELETE",
                        })
                      }
                    >
                      Confirmar exclusão
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Excluir " + row.name}
                      onClick={() => setDeleting(row.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                  {catalog === "parts" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStock(row as Part);
                        setQty(1);
                      }}
                    >
                      Entrada
                    </Button>
                  )}
                  {catalog === "maintenance-plans" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mutate.isPending}
                      onClick={() =>
                        mutate.mutate({
                          path: `/maintenance-plans/${row.id}/generate`,
                        })
                      }
                    >
                      Gerar OS
                      <ArrowUpRight size={14} />
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {data.data?.total === 0 && (
        <p className="empty-state">
          Nenhum cadastro encontrado. Comece adicionando o primeiro registro.
        </p>
      )}
      {(data.error || mutate.error) && (
        <p role="alert" className="error-banner">
          {(data.error || mutate.error)?.message}
        </p>
      )}
      <div className="pagination">
        <span>
          Página {page} de{" "}
          {Math.max(1, Math.ceil((data.data?.total ?? 0) / 12))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * 12 >= (data.data?.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
      {editor !== undefined && (
        <Editor
          catalog={catalog}
          row={editor}
          onClose={() => setEditor(undefined)}
        />
      )}
      <Drawer.Root
        open={!!stock}
        onOpenChange={(v) => !v && setStock(null)}
        direction="right"
      >
        <Drawer.Portal>
          <Drawer.Overlay className="drawer-overlay" />
          <Drawer.Content className="drawer-content">
            <Drawer.Title className="drawer-title">
              Entrada de estoque
            </Drawer.Title>
            <Drawer.Description>
              {stock?.name} · saldo atual {stock?.stock}
            </Drawer.Description>
            <button
              className="drawer-close"
              aria-label="Fechar entrada"
              onClick={() => setStock(null)}
            >
              <X />
            </button>
            <label className="form-stack">
              Quantidade recebida
              <input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(+e.target.value)}
              />
            </label>
            <Button
              disabled={qty < 1 || !Number.isInteger(qty) || mutate.isPending}
              onClick={() =>
                mutate.mutate({
                  path: `/parts/${stock!.id}/movements`,
                  body: { quantity: qty, workOrderId: null },
                })
              }
            >
              Registrar entrada
            </Button>
            {mutate.error && (
              <p role="alert" className="error-banner">
                {mutate.error.message}
              </p>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
function equipmentName(row: Row) {
  return row.checklist ? `${row.checklist.length} tarefas no checklist` : "";
}
