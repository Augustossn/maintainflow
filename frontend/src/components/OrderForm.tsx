import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "vaul";
import { X, Plus } from "lucide-react";
import type { Equipment, Technician, Page } from "../types";
import { request } from "../lib/api";
import { Button } from "./ui/button";
const schema = z.object({
  title: z.string().min(4, "Informe pelo menos 4 caracteres.").max(2000),
  description: z
    .string()
    .min(8, "Descreva o problema com mais detalhes.")
    .max(2000),
  equipmentId: z.string().min(1, "Selecione um equipamento."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  dueAt: z
    .string()
    .refine((v) => new Date(v) > new Date(), "Escolha uma data futura."),
  technicianId: z.string(),
});
type Values = z.infer<typeof schema>;
export default function OrderForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const equipment = useQuery({
    queryKey: ["equipment"],
    queryFn: () => request<Page<Equipment>>("/equipment?pageSize=100"),
    enabled: open,
  });
  const technicians = useQuery({
    queryKey: ["technicians"],
    queryFn: () => request<Page<Technician>>("/technicians?pageSize=100"),
    enabled: open,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM", technicianId: "" },
  });
  const create = useMutation({
    mutationFn: (values: Values) =>
      request("/work-orders", "POST", {
        ...values,
        dueAt: new Date(values.dueAt).toISOString(),
        technicianId: values.technicianId || null,
      }),
    onSuccess: () => {
      client.invalidateQueries();
      reset();
      onClose();
    },
  });
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(v) => !v && onClose()}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="drawer-overlay" />
        <Drawer.Content className="drawer-content">
          <Drawer.Title className="drawer-title">
            Nova ordem de serviço
          </Drawer.Title>
          <Drawer.Description className="muted">
            Descreva o problema e organize o próximo reparo.
          </Drawer.Description>
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label="Fechar formulário"
          >
            <X />
          </button>
          <form
            onSubmit={handleSubmit((v) => create.mutate(v))}
            className="form-stack"
          >
            <label>
              Equipamento
              <select
                {...register("equipmentId")}
                aria-invalid={!!errors.equipmentId}
              >
                <option value="">Selecione o equipamento</option>
                {equipment.data?.items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.serialNumber}
                  </option>
                ))}
              </select>
              {errors.equipmentId && (
                <span role="alert" className="field-error">
                  {errors.equipmentId.message}
                </span>
              )}
            </label>
            <label>
              Título
              <input
                {...register("title")}
                placeholder="Ex.: Compressor com ruído excessivo"
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <span role="alert" className="field-error">
                  {errors.title.message}
                </span>
              )}
            </label>
            <label>
              Descrição
              <textarea
                {...register("description")}
                rows={4}
                placeholder="O que aconteceu? Quais sintomas foram observados?"
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <span role="alert" className="field-error">
                  {errors.description.message}
                </span>
              )}
            </label>
            <div className="form-row">
              <label>
                Prioridade
                <select {...register("priority")}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </label>
              <label>
                Prazo
                <input
                  type="datetime-local"
                  {...register("dueAt")}
                  aria-invalid={!!errors.dueAt}
                />
                {errors.dueAt && (
                  <span role="alert" className="field-error">
                    {errors.dueAt.message}
                  </span>
                )}
              </label>
            </div>
            <label>
              Técnico responsável
              <select {...register("technicianId")}>
                <option value="">Atribuir depois</option>
                {technicians.data?.items
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            {(create.error || equipment.error || technicians.error) && (
              <p role="alert" className="error-banner">
                {
                  (create.error || equipment.error || technicians.error)
                    ?.message
                }
              </p>
            )}
            <div className="form-footer">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button disabled={create.isPending}>
                <Plus size={16} />
                {create.isPending ? "Criando…" : "Criar ordem"}
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
