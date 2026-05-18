import type { Asset, AttemptResponse, IdentityMode, Scenario, User } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export async function getUsers(): Promise<User[]> {
  return fetch(`${API_BASE}/users`, { cache: "no-store" }).then(assertOk);
}

export async function getAssets(): Promise<Asset[]> {
  return fetch(`${API_BASE}/assets`, { cache: "no-store" }).then(assertOk);
}

export async function createAttempt(input: {
  user_id: string;
  asset_id: string;
  scenario: Scenario;
  identity_mode: IdentityMode;
  threat_level: "normal" | "elevated" | "critical";
}): Promise<AttemptResponse> {
  return fetch(`${API_BASE}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(assertOk);
}

export async function getAudit(): Promise<any> {
  return fetch(`${API_BASE}/audit`, { cache: "no-store" }).then(assertOk);
}

async function assertOk(response: Response) {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}
