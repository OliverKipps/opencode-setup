# Global Agent Instructions

## Auto-Sync Dotfiles (MANDATORY)

After ANY session where you modified files in ANY of these locations, you MUST handle sync:

- C:\Users\Oliver\.config\opencode\ (agents, opencode.json, plugins) -> **ALWAYS sync to public template** if it's a generic improvement (new agent, config)
- C:\Users\Oliver\.context\ (journal, goals, preferences, any .md/.json) -> **PRIVATE only** - NEVER push personal context to public repo. Use opencode-setup-private for personal backup.
- C:\Users\Oliver\context-mcp-server\src\ -> sync to public template (it's code)
- C:\Users\Oliver\.opencode\ -> sync to public template

### How to sync:

**For public template changes (agents, opencode.json, MCP server code):**
```powershell
Set-Location C:\Users\Oliver\opencode-setup
# manually copy only the changed agent/config file - DO NOT run backup.ps1 (it overwrites placeholders)
git add agents/<changed-file> opencode.json
git commit -m "feat: <what changed>"
git push
```

**For personal context (journal, who-i-am, goals):**
```powershell
# Private backup - local only, or push to PRIVATE repo if you create one
Set-Location C:\Users\Oliver\opencode-setup-private
.\backup.ps1  # this one keeps personal data
# then optionally: git push to your PRIVATE repo
```

**Rule:** Public repo = placeholders only. Never push personal context there.

**When NOT to sync:** Read-only sessions -> skip.

---
# ponytail: split sync - public template vs private personal. One rule would leak personal data.