$root=$PSScriptRoot
Copy-Item "$root\opencode.json" "$HOME\.config\opencode\opencode.json" -Force
New-Item -ItemType Directory -Path "$HOME\.config\opencode\agents" -Force | Out-Null
Copy-Item "$root\agents\*.md" "$HOME\.config\opencode\agents\" -Force
Copy-Item "$root\.opencode\opencode.json" "$HOME\.opencode\opencode.json" -Force
New-Item -ItemType Directory -Path "$HOME\.context" -Force | Out-Null
Copy-Item "$root\context\*.md","$root\context\*.json" "$HOME\.context\" -Force
Get-ChildItem "$root\context" -Directory | ForEach-Object {
  $dest="$HOME\.context\$($_.Name)"
  Copy-Item $_.FullName $dest -Recurse -Force
}
Copy-Item "$root\context-mcp-server\src" "$HOME\context-mcp-server\src" -Recurse -Force
Copy-Item "$root\context-mcp-server\package.json","$root\context-mcp-server\tsconfig.json","$root\context-mcp-server\vitest.config.ts","$root\context-mcp-server\.gitignore" "$HOME\context-mcp-server\" -Force -ErrorAction SilentlyContinue
if (!(Test-Path "$HOME\context-mcp-server\node_modules") -or !(Test-Path "$HOME\context-mcp-server\dist")) {
  Push-Location "$HOME\context-mcp-server"; npm install; npm run build; Pop-Location
}
Copy-Item "$root\AGENTS.md" "$HOME\.config\opencode\AGENTS.md" -Force -ErrorAction SilentlyContinue
Copy-Item "$root\AGENTS.md" "$HOME\AGENTS.md" -Force -ErrorAction SilentlyContinue
Copy-Item "$root\AGENTS.md" "$HOME\.context\AGENTS.md" -Force -ErrorAction SilentlyContinue
Write-Host "Restore done."
