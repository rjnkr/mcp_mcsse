/**
 * Interactive login — Authorization Code + PKCE flow.
 * Run once with: npm run login
 * Saves tokens to ~/.mcp-vessel-auth.json
 */

import "dotenv/config";
import http from "http";
import { createHash, randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const AUTH_URL = process.env.AUTH_URL ?? "auth url missing in config";

const CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? "mcp-vessel-client";
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "";
const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const TOKEN_FILE = process.env.TOKEN_FILE ?? join(homedir(), ".mcp-vessel-auth.json");

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function generateState(): string {
  return base64url(randomBytes(16));
}

// ── Token storage ─────────────────────────────────────────────────────────────

interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export function saveTokens(store: TokenStore): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function loadTokens(): TokenStore | null {
  try {
    const raw = readFileSync(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as TokenStore;
  } catch {
    return null;
  }
}

// ── Login flow ────────────────────────────────────────────────────────────────

async function exchangeCode(code: string, verifier: string): Promise<void> {
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
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
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 30) * 1000,
  });

  console.error("✅  Logged in successfully. Tokens saved to", TOKEN_FILE);
}

async function login(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const authUrl = `${AUTH_URL}/auth?${params}`;

  // Try to open the browser automatically
  const { exec } = await import("child_process");
  const open = (url: string) => exec(`open "${url}"`);

  console.error("\n🔐  Opening browser for login...");
  console.error("   If the browser does not open, navigate to:\n");
  console.error(`   ${authUrl}\n`);
  open(authUrl);

  // Start local callback server
  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>Login failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>State mismatch — possible CSRF</h2><p>Please try again.</p>");
        server.close();
        reject(new Error("State mismatch"));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>No code received</h2><p>Please try again.</p>");
        server.close();
        reject(new Error("No code in callback"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<h2>✅ Login successful!</h2><p>You can close this tab and return to Claude Desktop.</p>",
      );
      server.close();

      try {
        await exchangeCode(code, verifier);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      process.stderr.write(`Waiting for login callback on port ${REDIRECT_PORT}...\n`);
    });

    server.on("error", reject);
  });
}

await login();
