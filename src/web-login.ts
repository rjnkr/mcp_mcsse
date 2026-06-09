/**
 * Browser-based login endpoint.
 * Visit http://localhost:<PORT>/login to start the OAuth PKCE flow.
 * The /callback route completes the exchange and saves tokens.
 * Exports `app` and `PORT` — the caller is responsible for app.listen().
 */

import "dotenv/config";
import express from "express";
import { createHash, randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const successHtml = readFileSync(join(__dirname, "success.html"), "utf8");

const AUTH_URL = process.env.AUTH_URL ?? "auth url missing in config";

const CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? "mcp-vessel-client";
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "";
export const PORT = parseInt(process.env.PORT ?? "3000", 10);
const TOKEN_FILE = process.env.TOKEN_FILE ?? join(homedir(), ".mcp-vessel-auth.json");

const REDIRECT_URI = `http://localhost:${PORT}/callback`;

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// In-memory store for pending PKCE sessions (state → verifier)
const pending = new Map<string, string>();

export const app = express();

app.get("/login", (_req, res) => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));

  pending.set(state, verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  res.redirect(`${AUTH_URL}/auth?${params}`);
});

app.get("/callback", async (req, res) => {
  const { state, code, error } = req.query as Record<string, string>;

  if (error) {
    res.status(400).send(`<h2>Login failed: ${error}</h2>`);
    return;
  }

  const verifier = pending.get(state);
  if (!verifier) {
    res.status(400).send("<h2>Unknown or expired state. Please try again.</h2>");
    return;
  }
  pending.delete(state);

  const params: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  };
  if (CLIENT_SECRET) params.client_secret = CLIENT_SECRET;

  const tokenRes = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    res.status(500).send(`<h2>Token exchange failed (${tokenRes.status})</h2><pre>${text}</pre>`);
    return;
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  writeFileSync(
    TOKEN_FILE,
    JSON.stringify(
      {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in - 30) * 1000,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );

  console.error("Login successful via web flow. Tokens saved to", TOKEN_FILE);
  res.send(successHtml.replaceAll("{{PORT}}", String(PORT)));
});
