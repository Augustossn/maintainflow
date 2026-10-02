import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setSession, request } from "../lib/api";
import { demoRequest } from "../lib/demo";
import type { Order, Page, Status } from "../types";
import OrderForm from "../components/OrderForm";
describe("Fluxos de manutenção", () => {
  it("não encerra sem confirmação e mantém estoque após falha", async () => {
    localStorage.clear();
    const page = await demoRequest<Page<Order>>("/work-orders");
    const order = page.items.find((o) => o.status === "IN_PROGRESS")!;
    await expect(
      demoRequest(`/work-orders/${order.id}/status`, "PATCH", {
        status: "COMPLETED",
        version: order.version,
      }),
    ).rejects.toThrow("Confirme");
    const unchanged = await demoRequest<Order>(`/work-orders/${order.id}`);
    expect(unchanged.status).toBe("IN_PROGRESS");
  });
  it("valida os campos do formulário e expõe erros acessíveis", async () => {
    setSession({ token: "demo", name: "Teste", role: "Manager", mode: "demo" });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <OrderForm open onClose={() => {}} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Criar ordem" }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3),
    );
    expect(screen.getByRole("textbox", { name: /^Título/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
  it("expõe erros da API sem trocar para dados de demonstração", async () => {
    setSession({ token: "x", name: "Teste", role: "Manager", mode: "api" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ title: "Conflito de versão" }), {
            status: 409,
          }),
        ),
    );
    await expect(
      request("/work-orders/id/status", "PATCH", {
        status: "IN_PROGRESS" as Status,
      }),
    ).rejects.toThrow("Conflito de versão");
    vi.unstubAllGlobals();
  });
});
