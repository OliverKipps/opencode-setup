# opencode-setup

Private dotfiles repo — backs up opencode config, agents, context memory, and custom MCP server for laptop migration and sharing.

## What's inside

- `opencode.json` — main config (`~/.config/opencode/opencode.json`)
- `.opencode/opencode.json` — secondary config (`~/.opencode/opencode.json`)
- `agents/` — custom agent definitions
- `context/` — markdown/json memory (`~/.context/`) — goals, journal, preferences, etc. (placeholder templates — see `context/README.md`)
- `context-mcp-server/` — custom MCP server source (src + package/ts configs)

Ignored: `node_modules/`, `dist/`, `package-lock.json`, `.trash/`, `*.log`, `.env`

## Restore on new laptop (3 steps)

```powershell
git clone <this-repo> $HOME/opencode-setup
Set-Location $HOME/opencode-setup
.\restore.ps1
```

`restore.ps1` copies files to `$HOME\.config\opencode`, `$HOME\.context`, `$HOME\context-mcp-server` and runs `npm install && npm run build` for the MCP server if needed. Restart opencode after.

## Share with a friend

Make the GitHub repo private, then: **Settings → Collaborators → Add people** (or invite via `gh repo invite`). They clone and run `.\restore.ps1`.

> `context/` files are **placeholder templates** (no personal data). After restoring, replace `TODO` sections in `who-i-am.md`, `goals.md`, etc. with your own info — see `context/README.md` for which files to edit. `CONTEXT_GUIDE.md` is generic docs and can be kept as-is.

## Keep in sync

```powershell
.\backup.ps1
git add -A; git commit -m "backup $(Get-Date -Format yyyy-MM-dd)"; git push
```

Run `backup.ps1` anytime to snapshot current machine state into the repo folder. Secrets are auto-redacted on backup.
