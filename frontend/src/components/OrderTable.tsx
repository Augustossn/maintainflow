import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Order } from "../types";
import { priorityLabels, statusLabels } from "../types";
import { date, money } from "../lib/utils";
export default function OrderTable({
  orders,
  onOpen,
}: {
  orders: Order[];
  onOpen: (o: Order) => void;
}) {
  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "title",
      header: "Ordem de serviço",
      cell: ({ row }) => (
        <button className="table-title" onClick={() => onOpen(row.original)}>
          {row.original.title}
          <small>{row.original.equipmentName}</small>
        </button>
      ),
    },
    { accessorKey: "customerName", header: "Cliente" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="badge">{statusLabels[row.original.status]}</span>
      ),
    },
    {
      accessorKey: "priority",
      header: "Prioridade",
      cell: ({ row }) => (
        <span
          className={"badge priority-" + row.original.priority.toLowerCase()}
        >
          {priorityLabels[row.original.priority]}
        </span>
      ),
    },
    {
      accessorKey: "technicianName",
      header: "Técnico",
      cell: ({ getValue }) => getValue<string>() ?? "Não atribuído",
    },
    {
      accessorKey: "dueAt",
      header: "Prazo",
      cell: ({ getValue }) => date(getValue<string>()),
    },
    {
      accessorKey: "cost",
      header: "Custo",
      cell: ({ getValue }) => money(getValue<number>()),
    },
  ];
  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
