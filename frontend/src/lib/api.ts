import type { Session } from "../types";
import { demoRequest } from "./demo";
let session: Session | null = null;
export function setSession(value: Session | null) {
  session = value;
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (session?.mode === "demo") return demoRequest<T>(path, method, body);
  const response = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let title = "Não foi possível conectar à API.";
    try {
      const problem = await response.json();
      title =
        problem.title ??
        (response.status === 401
          ? "Sessão inválida ou expirada. Entre novamente."
          : title);
    } catch {
      /* Reverse proxy may return an empty response. */
    }
    throw new Error(title);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
