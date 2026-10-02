import { test, expect } from "@playwright/test";
test("cria ordem, atribui técnico, aplica checklist e conclui com confirmação", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MaintainFlow/);
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("button", { name: "Nova ordem", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator('select[name="equipmentId"]')
    .selectOption({ index: 1 });
  await page
    .getByRole("textbox", { name: /^Título/ })
    .fill("Inspeção do teste de ponta a ponta");
  await page
    .getByRole("textbox", { name: /^Descrição/ })
    .fill("Inspeção funcional com verificação de pressão e conexões.");
  const due = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await page.locator('input[name="dueAt"]').fill(due);
  await page.locator('select[name="technicianId"]').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Criar ordem" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page
    .getByRole("button", { name: /Ordens de serviço/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Lista de ordens" }).click();
  await page
    .getByRole("button", { name: /Inspeção do teste de ponta a ponta/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Em andamento", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Concluir ordem" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Gerar sugestão" }).click();
  await expect(dialog.getByText("Checklist recomendado")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Aceitar e criar checklist" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("aceita");
  await dialog
    .getByLabel("Confirmação de entrega")
    .fill("Técnico do teste — equipamento verificado e entregue");
  await dialog.getByRole("button", { name: "Concluir ordem" }).click();
  await expect(dialog.getByText("Concluídas", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Concluir ordem" }),
  ).toHaveCount(0);
});
