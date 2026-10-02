import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CalendarDays, GripVertical, Plus, Wrench } from "lucide-react";
import type { Order, Status } from "../types";
import { statusLabels, priorityLabels } from "../types";
import { date } from "../lib/utils";
const statuses: Status[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "COMPLETED",
  "CANCELLED",
];
function Card({
  order,
  onOpen,
  disabled,
}: {
  order: Order;
  onOpen: (o: Order) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: order.id,
      disabled: disabled || ["COMPLETED", "CANCELLED"].includes(order.status),
    });
  return (
    <motion.article
      layout
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 10 : 1,
      }}
      className="order-card"
    >
      <div className="card-top">
        <span className={"badge priority-" + order.priority.toLowerCase()}>
          <i />
          {priorityLabels[order.priority]}
        </span>
        <button
          className="drag-handle"
          aria-label={"Mover " + order.title}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <button className="card-open" onClick={() => onOpen(order)}>
        <span className="order-number">
          OS · {order.id.slice(0, 6).toUpperCase()}
        </span>
        <h3>{order.title}</h3>
        <span className="equipment-line">
          <Wrench size={13} />
          {order.equipmentName}
        </span>
      </button>
      <div className="card-tags">
        <span>{order.preventive ? "Preventiva" : "Corretiva"}</span>
        <span>{order.customerName}</span>
      </div>
      <div className="card-bottom">
        <span
          className={
            new Date(order.dueAt) < new Date() &&
            !["COMPLETED", "CANCELLED"].includes(order.status)
              ? "overdue"
              : ""
          }
        >
          <CalendarDays size={13} />
          {date(order.dueAt)}
        </span>
        {order.technicianName ? (
          <span className="avatar" title={order.technicianName}>
            {order.technicianName
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
        ) : (
          <span className="unassigned">Sem técnico</span>
        )}
      </div>
    </motion.article>
  );
}
function Column({
  status,
  orders,
  onOpen,
  disabled,
}: {
  status: Status;
  orders: Order[];
  onOpen: (o: Order) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={"kanban-column " + (isOver ? "drop-active" : "")}
      aria-label={statusLabels[status]}
    >
      <header>
        <span className={"status-dot " + status.toLowerCase()} />
        <h3>{statusLabels[status]}</h3>
        <span className="column-count">{orders.length}</span>
      </header>
      <div className="column-cards">
        {orders.map((o) => (
          <Card key={o.id} order={o} onOpen={onOpen} disabled={disabled} />
        ))}
        {orders.length === 0 && (
          <div className="column-empty">
            <Plus size={18} />
            <span>Nenhuma ordem</span>
          </div>
        )}
      </div>
    </section>
  );
}
export default function Kanban({
  orders,
  onOpen,
  onMove,
  disabled = false,
}: {
  orders: Order[];
  onOpen: (o: Order) => void;
  onMove: (o: Order, s: Status) => Promise<void>;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  async function drop(event: DragEndEvent) {
    if (!event.over) return;
    const order = orders.find((o) => o.id === event.active.id);
    const status = event.over.id as Status;
    if (!order || order.status === status) return;
    setError("");
    try {
      await onMove(order, status);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <p className="sr-only">
        Arraste pelo controle de mover. Você também pode alterar o status
        abrindo a ordem.
      </p>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={drop}>
        <div className="kanban">
          {statuses.map((s) => (
            <Column
              key={s}
              status={s}
              orders={orders.filter((o) => o.status === s)}
              onOpen={onOpen}
              disabled={disabled}
            />
          ))}
        </div>
      </DndContext>
    </>
  );
}
