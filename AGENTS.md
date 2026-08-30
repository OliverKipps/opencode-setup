# Global Agent Instructions

## Auto-Sync Dotfiles (MANDATORY)

After ANY session where you modified files in ANY of these locations, you MUST sync:

- C:\Users\Oliver\.config\opencode\ (agents, opencode.json, plugins)
- C:\Users\Oliver\.context\ (journal, goals, preferences, any .md/.json)
- C:\Users\Oliver\context-mcp-server\src\ (MCP server source)
- C:\Users\Oliver\.opencode\ (secondary config)

### How to sync (30 seconds):

```powershell
Set-Location C:\Users\Oliver\opencode-setup
.\backup.ps1
git add -A
git commit -m "auto-sync: <what changed>"
git push
```

**Rule:** If you touched config/context -> you push. No exceptions. User will NOT remember to do this manually. You are the sync layer.

**When NOT to sync:** Read-only sessions (just answering questions, no file edits) -> skip.

---
# ponytail: one file, one rule. Add per-file hooks when this measurably misses syncs.