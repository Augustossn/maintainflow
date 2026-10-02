import { test, expect } from "@playwright/test";
import axe from "axe-core";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MaintainFlow/);
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
});
test("dashboard, formulário e drawer acessíveis", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.chart-area rect[fill="#267563"]')
        .evaluateAll((nodes) =>
          Math.max(0, ...nodes.map((n) => n.getBoundingClientRect().height)),
        ),
    )
    .toBeGreaterThan(10);
  await page.screenshot({
    path: `../docs/screenshots/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Nova ordem", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Criar ordem" }).click();
  await expect(
    page.getByText("Informe pelo menos 4 caracteres."),
  ).toBeVisible();
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(
    async () =>
      await (window as any).axe.run(document.querySelector('[role="dialog"]'), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      }),
  );
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("Kanban restaura posição após falha da API", async ({ page }) => {
  // Connected mode exercises optimistic rollback against a deterministic failed PATCH.
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { token: "test", role: "Manager", name: "Teste" } }),
  );
  const id = "11111111-1111-1111-1111-111111111111";
  const order = {
    id,
    title: "Falha de teste",
    description: "Teste",
    equipmentId: id,
    equipmentName: "Compressor",
    customerId: id,
    customerName: "Cliente",
    technicianId: id,
    technicianName: "Rafael",
    status: "ASSIGNED",
    priority: "HIGH",
    preventive: false,
    createdAt: new Date().toISOString(),
    dueAt: new Date().toISOString(),
    completedAt: null,
    cost: 0,
    checklist: [],
    version: "v1",
  };
  await page.route("**/api/work-orders?*", (route) =>
    route.fulfill({
      json: { items: [order], total: 1, pageNumber: 1, pageSize: 100 },
    }),
  );
  await page.route("**/api/work-orders/*/status", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ status: 409, json: { title: "Conflito simulado" } });
  });
  await page.getByLabel("Senha", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page
    .getByRole("button", { name: /Ordens de serviço/ })
    .first()
    .click();
  const handle = page.getByRole("button", { name: "Mover Falha de teste" });
  const target = page.getByRole("region", { name: "Em andamento" });
  await handle.scrollIntoViewIfNeeded();
  // Show the two adjacent columns together for a real pointer drag on a narrow viewport.
  await page.locator(".kanban").evaluate((element) => {
    element.scrollLeft = 390;
  });
  const a = await handle.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error("Quadro não disponível");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 12, a.y + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 100, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByRole("alert").filter({ hasText: "Conflito simulado" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Atribuídas" })
      .getByText("Falha de teste"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Em andamento" })
      .getByText("Falha de teste"),
  ).toHaveCount(0);
});
