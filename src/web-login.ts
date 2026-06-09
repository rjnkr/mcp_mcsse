/**
 * Browser-based login endpoint.
 * Visit http://localhost:<PORT>/login to start the OAuth PKCE flow.
 * The /callback route completes the exchange and saves tokens.
 * Exports `app` and `PORT` — the caller is responsible for app.listen().
 */

import "dotenv/config";
import express from "express";
import { createHash, randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

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
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Login successful — Vessel Info MCP</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 740px; margin: 56px auto; padding: 0 24px 80px; color: #111; line-height: 1.6; }
    h1 { font-size: 1.6rem; margin: 0 0 6px; color: #15803d; }
    h2 { font-size: 1.15rem; margin: 2.4em 0 .6em; border-bottom: 1px solid #e5e7eb; padding-bottom: .3em; }
    p { margin: .6em 0; }
    a { color: #2563eb; }
    pre, code { font-family: ui-monospace, 'Cascadia Code', monospace; font-size: 13px; }
    pre { background: #f8f8f9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; overflow-x: auto; line-height: 1.55; margin: .8em 0; }
    code { background: #f1f1f2; padding: 2px 5px; border-radius: 4px; }
    .badge { display: inline-block; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; border-radius: 999px; padding: 2px 12px; font-size: .85rem; font-weight: 600; vertical-align: middle; margin-left: 10px; }
    .copy-wrap { position: relative; }
    .copy-btn { position: absolute; top: 8px; right: 8px; background: #fff; border: 1px solid #d1d5db; border-radius: 5px; padding: 3px 10px; font-size: 11px; cursor: pointer; color: #555; }
    .copy-btn:hover { background: #f3f4f6; }
    .info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 16px; border-radius: 0 6px 6px 0; margin: .8em 0; font-size: .93rem; }
    .warn { background: #fefce8; border-left: 4px solid #ca8a04; padding: 10px 16px; border-radius: 0 6px 6px 0; margin: .8em 0; font-size: .93rem; }
    .platform-select { display: flex; gap: 6px; margin: 1em 0 .3em; }
    .ps-btn { padding: 5px 14px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; background: #f9fafb; font-size: .88rem; }
    .ps-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; font-weight: 600; }
    .pblock { display: none; }
    .pblock.active { display: block; }
    .comment { color: #9ca3af; }
  </style>
</head>
<body>

  <h1>You are logged in <span class="badge">Session active</span></h1>
  <p>Your credentials have been saved securely inside the running container. The server is ready to accept connections from Claude Desktop.</p>

  <div class="info">
    <strong>What just happened?</strong> You authenticated with the Vessel Info service using your browser.
    The server received a secure access token and a long-lived refresh token.
    From now on the server will automatically refresh the access token in the background — you won't need to log in again unless the refresh token expires (typically after a long period of inactivity).
  </div>

  <h2>Step 1 — Keep the container running</h2>
  <p>The MCP server runs inside Docker. Make sure it stays running in the background:</p>
  <div class="copy-wrap">
    <pre id="cmd-up">docker compose up -d mcp-vessel</pre>
    <button class="copy-btn" onclick="copy('cmd-up', this)">Copy</button>
  </div>
  <p>You only need to do this once after a reboot. The container starts automatically if you added <code>restart: unless-stopped</code> to your compose file.</p>

  <h2>Step 2 — Tell Claude Desktop where the server is</h2>
  <p>Claude Desktop connects to the MCP server over HTTP — no Docker commands or file paths needed in the config, just a URL.</p>

  <div class="platform-select">
    <button class="ps-btn active" onclick="showPlatform('mac', this)">macOS</button>
    <button class="ps-btn" onclick="showPlatform('win', this)">Windows</button>
    <button class="ps-btn" onclick="showPlatform('linux', this)">Linux</button>
  </div>

  <div id="p-mac" class="pblock active">
    <p>Open the config file at:<br><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
  </div>
  <div id="p-win" class="pblock">
    <p>Open the config file at:<br><code>%APPDATA%\\Claude\\claude_desktop_config.json</code></p>
  </div>
  <div id="p-linux" class="pblock">
    <p>Open the config file at:<br><code>~/.config/Claude/claude_desktop_config.json</code></p>
  </div>

  <p>Inside the <code>"mcpServers"</code> object, add the <code>"vessel-info"</code> entry shown below. <strong>Do not replace the whole file</strong> — only add the new entry alongside any servers already listed.</p>

  <div class="copy-wrap">
    <pre id="cfg">{
  "mcpServers": {
    "vessel-info": {
      "url": "http://localhost:${PORT}/mcp"
    }<span class="comment">,
    // ...any other servers you already have</span>
  }
}</pre>
    <button class="copy-btn" onclick="copy('cfg', this)">Copy</button>
  </div>

  <div class="warn">
    If the file does not exist yet, create it with exactly the content above (without the comment line).
    If it already has an <code>"mcpServers"</code> key, add only the <code>"vessel-info"</code> block inside it.
  </div>

  <h2>Step 3 — Restart Claude Desktop</h2>
  <p>Quit and reopen Claude Desktop. It will connect to the MCP server automatically. You should see <strong>vessel-info</strong> listed under the tools icon in a new conversation.</p>

  <h2>If you ever need to log in again</h2>
  <p>Your session will stay valid for a long time thanks to automatic token refresh. But if you are ever asked to re-authenticate, just visit:</p>
  <p><a href="/login">http://localhost:${PORT}/login</a></p>

  <script>
    function showPlatform(id, btn) {
      document.querySelectorAll('.pblock').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.ps-btn').forEach(el => el.classList.remove('active'));
      document.getElementById('p-' + id).classList.add('active');
      btn.classList.add('active');
    }
    function copy(id, btn) {
      const text = document.getElementById(id).innerText;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 1800);
      });
    }
  </script>
</body>
</html>`);
});
