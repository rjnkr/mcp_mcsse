/**
 * Token manager — reads user tokens saved by `npm run login`.
 * Auto-refreshes using the refresh_token when the access_token is near expiry.
 */

import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const AUTH_URL =  process.env.AUTH_URL ??  "unknown";

const CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? "mss-mcp";
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "";
const TOKEN_FILE = process.env.TOKEN_FILE ?? join(homedir(), ".mcp-vessel-auth.json");

interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function loadTokens(): TokenStore {
  try {
    const raw = readFileSync(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as TokenStore;
  } catch {
    throw new Error(
      `Not authenticated. Run "npm run login" in the MCP server directory first:\n  cd /Users/richard/Documents/MCP_mcsse && npm run login`,
    );
  }
}

function saveTokens(store: TokenStore): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

async function refreshAccessToken(refreshToken: string): Promise<TokenStore> {
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  };
  if (CLIENT_SECRET) params.client_secret = CLIENT_SECRET;
  const body = new URLSearchParams(params);

  const res = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token refresh failed (${res.status}): ${text}\nPlease run "npm run login" again.`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const store: TokenStore = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 30) * 1000,
  };

  saveTokens(store);
  return store;
}

export async function getAccessToken(): Promise<string> {
  let store = loadTokens();

  if (Date.now() >= store.expires_at) {
    store = await refreshAccessToken(store.refresh_token);
  }

  return store.access_token;
}

