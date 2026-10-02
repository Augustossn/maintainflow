import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "vaul";
import {
  Sparkles,
  X,
  Check,
  Clock,
  History as HistoryIcon,
  ShieldCheck,
  Send,
} from "lucide-react";
import { motion } from "motion/react";
import type {
  Order,
  Technician,
  Part,
  Page,
  Suggestion,
  History,
} from "../types";
import { transitions, statusLabels, priorityLabels } from "../types";
import { request } from "../lib/api";
import { money, date } from "../lib/utils";
import { Button } from "./ui/button";
import SignaturePad from "./bencho/signature-pad";
import { NextDotFillButton } from "./microkit/next-dot-fill-button";
export default function OrderDetail({
  id,
  onClose,
  manager,
}: {
  id: string | null;
  onClose: () => void;
  manager: boolean;
}) {
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [checklist, setChecklist] = useState("");
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [decision, setDecision] = useState("");
  const order = useQuery({
    queryKey: ["order", id],
    queryFn: () => request<Order>("/work-orders/" + id),
    enabled: !!id,
  });
  const history = useQuery({
    queryKey: ["history", order.data?.equipmentId],
    queryFn: () =>
      request<History[]>(`/equipment/${order.data?.equipmentId}/history`),
    enabled: !!order.data,
  });
  const technicians = useQuery({
    queryKey: ["technicians"],
    queryFn: () => request<Page<Technician>>("/technicians?pageSize=100"),
    enabled: !!id,
  });
  const parts = useQuery({
    queryKey: ["parts"],
    queryFn: () => request<Page<Part>>("/parts?pageSize=100"),
    enabled: !!id,
  });
  const mutation = useMutation({
    mutationFn: ({
      path,
      body,
      method = "POST",
    }: {
      path: string;
      body: unknown;
      method?: string;
    }) => request(path, method, body),
    onSuccess: () => client.invalidateQueries(),
  });
  const agent = useMutation({
    mutationFn: () =>
      request<Suggestion>(`/work-orders/${id}/agent-suggestion`, "POST", {}),
    onSuccess: (s) => {
      setSuggestion(s);
      setDecision("");
      setChecklist(s.recommendedChecklist.map((c) => c.text).join("\n"));
    },
  });
  const o = order.data;
  const [signature, setSignature] = useState("");
  async function decide(value: string) {
    await mutation.mutateAsync({
      path: `/agent-suggestions/${suggestion!.id}/decision`,
      body: {
        decision: value,
        notes: value === "MODIFIED" ? "Checklist revisado pelo técnico" : null,
        checklist:
          value === "MODIFIED" ? checklist.split("\n").filter(Boolean) : null,
      },
    });
    setDecision(value);
    setEditing(false);
  }
  return (
    <Drawer.Root
      open={!!id}
      onOpenChange={(v) => !v && onClose()}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="drawer-overlay" />
        <Drawer.Content className="drawer-content detail">
          <Drawer.Title className="drawer-title">
            Detalhes da ordem
          </Drawer.Title>
          <Drawer.Description className="muted">
            Diagnóstico, execução e histórico do equipamento.
          </Drawer.Description>
          <button
            className="drawer-close"
            aria-label="Fechar detalhes"
            onClick={onClose}
          >
            <X />
          </button>
          {order.isPending ? (
            <p className="loading">Carregando ordem…</p>
          ) : o ? (
            <>
              <div className="detail-heading">
                <span className="eyebrow">
                  OS · {o.id.slice(0, 6).toUpperCase()}
                </span>
                <h2>{o.title}</h2>
                <div className="detail-badges">
                  <span
                    className={"badge priority-" + o.priority.toLowerCase()}
                  >
                    {priorityLabels[o.priority]}
                  </span>
                  <span className="badge">{statusLabels[o.status]}</span>
                  <span className="badge">
                    {o.preventive ? "Preventiva" : "Corretiva"}
                  </span>
                </div>
              </div>
              <div className="detail-grid">
                <div>
                  <small>Equipamento</small>
                  <strong>{o.equipmentName}</strong>
                </div>
                <div>
                  <small>Cliente</small>
                  <strong>{o.customerName}</strong>
                </div>
                <div>
                  <small>Prazo</small>
                  <strong>{date(o.dueAt)}</strong>
                </div>
                <div>
                  <small>Custo de peças</small>
                  <strong>{money(o.cost)}</strong>
                </div>
              </div>
              <p className="description">{o.description}</p>
              <section className="detail-section">
                <h3>Execução</h3>
                <label>
                  Técnico responsável
                  <select
                    value={o.technicianId ?? ""}
                    disabled={
                      !manager ||
                      mutation.isPending ||
                      ["COMPLETED", "CANCELLED"].includes(o.status)
                    }
                    onChange={(e) =>
                      e.target.value &&
                      mutation.mutate({
                        path: `/work-orders/${id}/assign`,
                        body: {
                          technicianId: e.target.value,
                          version: o.version,
                        },
                      })
                    }
                  >
                    <option value="">Selecione um técnico</option>
                    {technicians.data?.items
                      .filter((t) => t.active)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                {manager && !["COMPLETED", "CANCELLED"].includes(o.status) && (
                  <div className="priority-controls">
                    <span>Prioridade: {priorityLabels[o.priority]}</span>
                    <NextDotFillButton
                      label="Aumentar prioridade"
                      disabled={mutation.isPending || o.priority === "CRITICAL"}
                      onClick={() =>
                        mutation.mutate({
                          path: `/work-orders/${id}/priority`,
                          method: "PATCH",
                          body: {
                            priority: (
                              {
                                LOW: "MEDIUM",
                                MEDIUM: "HIGH",
                                HIGH: "CRITICAL",
                                CRITICAL: "CRITICAL",
                              } as const
                            )[o.priority],
                            version: o.version,
                          },
                        })
                      }
                    />
                    <select
                      aria-label="Definir prioridade"
                      value={o.priority}
                      disabled={mutation.isPending}
                      onChange={(e) =>
                        mutation.mutate({
                          path: `/work-orders/${id}/priority`,
                          method: "PATCH",
                          body: {
                            priority: e.target.value,
                            version: o.version,
                          },
                        })
                      }
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {o.checklist.length > 0 && (
                  <ul className="checklist">
                    {o.checklist.map((c, i) => (
                      <li key={i}>
                        <Check size={15} />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
                {transitions[o.status].includes("COMPLETED") && (
                  <div className="confirmation-panel">
                    <ShieldCheck size={20} />
                    <label>
                      Confirmação de entrega
                      <input
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder="Seu nome — equipamento testado e entregue"
                      />
                      <small>
                        Ao concluir, você confirma a execução e a entrega do
                        equipamento.
                      </small>
                    </label>
                  </div>
                )}
                {transitions[o.status].includes("COMPLETED") && (
                  <SignaturePad onChange={setSignature} />
                )}
                <div className="status-actions">
                  {transitions[o.status].map((s) =>
                    s === "COMPLETED" ? (
                      <NextDotFillButton
                        key={s}
                        label="Concluir ordem"
                        disabled={
                          mutation.isPending ||
                          (!confirmation.trim() && !signature)
                        }
                        onClick={() =>
                          mutation.mutate({
                            path: `/work-orders/${id}/status`,
                            method: "PATCH",
                            body: {
                              status: s,
                              version: o.version,
                              confirmation: confirmation || signature,
                            },
                          })
                        }
                      />
                    ) : (
                      <Button
                        key={s}
                        variant={s === "CANCELLED" ? "ghost" : "outline"}
                        disabled={
                          mutation.isPending ||
                          (s === "ASSIGNED" && !o.technicianId)
                        }
                        onClick={() =>
                          mutation.mutate({
                            path: `/work-orders/${id}/status`,
                            method: "PATCH",
                            body: { status: s, version: o.version },
                          })
                        }
                      >
                        {s === "CANCELLED" ? "Cancelar ordem" : statusLabels[s]}
                      </Button>
                    ),
                  )}
                </div>
              </section>
              {manager &&
                ["IN_PROGRESS", "WAITING_PARTS"].includes(o.status) && (
                  <section className="detail-section">
                    <h3>Registrar consumo de peça</h3>
                    <div className="form-row">
                      <label>
                        Peça
                        <select
                          value={partId}
                          onChange={(e) => setPartId(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {parts.data?.items.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.stock} em estoque
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(+e.target.value)}
                        />
                      </label>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!partId || quantity < 1 || mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          path: `/parts/${partId}/movements`,
                          body: { quantity: -quantity, workOrderId: id },
                        })
                      }
                    >
                      Registrar saída e custo
                    </Button>
                  </section>
                )}
              <section className="agent-panel">
                <div className="section-heading">
                  <h3>
                    <Sparkles size={18} /> Assistente de manutenção
                  </h3>
                  <span className="tiny-label">AGENTE SIMULADO</span>
                </div>
                <p className="muted">
                  Recomendações com contexto. Você continua no controle.
                </p>
                <Button
                  variant="outline"
                  onClick={() => agent.mutate()}
                  disabled={
                    agent.isPending ||
                    ["COMPLETED", "CANCELLED"].includes(o.status)
                  }
                >
                  <Sparkles size={15} />
                  {agent.isPending ? "Analisando contexto…" : "Gerar sugestão"}
                </Button>
                {suggestion && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="agent-result"
                  >
                    <span
                      className={
                        "badge priority-" + suggestion.severity.toLowerCase()
                      }
                    >
                      {priorityLabels[suggestion.severity]} · aprovação
                      obrigatória
                    </span>
                    <h4>Causas a investigar</h4>
                    {suggestion.probableCauses.map((c, i) => (
                      <p key={i}>
                        {c.text}
                        <span className="source">{c.source}</span>
                      </p>
                    ))}
                    <h4>Checklist recomendado</h4>
                    {editing ? (
                      <label>
                        Edite o checklist
                        <textarea
                          rows={5}
                          value={checklist}
                          onChange={(e) => setChecklist(e.target.value)}
                        />
                      </label>
                    ) : (
                      suggestion.recommendedChecklist.map((c, i) => (
                        <p key={i}>
                          <Check size={14} />
                          {c.text}
                          <span className="source">{c.source}</span>
                        </p>
                      ))
                    )}
                    <p>
                      <Clock size={14} />
                      {suggestion.estimatedDowntime}
                    </p>
                    <small className="muted">{suggestion.explanation}</small>
                    {decision ? (
                      <p className="success-message" role="status">
                        Decisão registrada:{" "}
                        {decision === "REJECTED"
                          ? "recusada"
                          : decision === "MODIFIED"
                            ? "alterada"
                            : "aceita"}
                        .
                      </p>
                    ) : (
                      <div className="agent-actions">
                        <Button
                          size="sm"
                          disabled={mutation.isPending}
                          onClick={() => {
                            void decide(
                              editing ? "MODIFIED" : "ACCEPTED",
                            ).catch(() => {});
                          }}
                        >
                          <Check size={14} />
                          {editing
                            ? "Salvar checklist revisado"
                            : "Aceitar e criar checklist"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing((v) => !v)}
                        >
                          Alterar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutation.isPending}
                          onClick={() => {
                            void decide("REJECTED").catch(() => {});
                          }}
                        >
                          Recusar
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
                <label className="review-label">
                  Solicitar revisão
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Descreva o motivo da revisão"
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!reason.trim() || mutation.isPending}
                  onClick={() =>
                    mutation.mutate(
                      {
                        path: `/work-orders/${id}/review-requests`,
                        body: { reason },
                      },
                      { onSuccess: () => setReason("") },
                    )
                  }
                >
                  <Send size={14} />
                  Solicitar revisão
                </Button>
              </section>
              <section className="detail-section">
                <h3>
                  <HistoryIcon size={18} /> Histórico do equipamento
                </h3>
                {history.error && <p role="alert">{history.error.message}</p>}
                {history.data?.length === 0 && (
                  <p className="muted">Nenhuma manutenção anterior.</p>
                )}
                {history.data?.map((h) => (
                  <div className="history-row" key={h.id}>
                    <span className="history-dot" />
                    <div>
                      <strong>{h.description}</strong>
                      <small>
                        {date(h.createdAt)} · {money(h.cost)}
                      </small>
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : null}
          {(order.error || mutation.error || agent.error) && (
            <p role="alert" className="error-banner">
              {(order.error || mutation.error || agent.error)?.message}
            </p>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
