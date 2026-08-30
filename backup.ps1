$root=$PSScriptRoot
function Sanitize($src,$dst){
  $t=Get-Content $src -Raw
  $t=[regex]::Replace($t,'("(?i)(api[_-]?key|secret|token|password)"\s*:\s*)"[^"]*"','$1"***REDACTED***"')
  New-Item -ItemType Directory (Split-Path $dst) -Force | Out-Null
  Set-Content $dst $t -NoNewline
}
Sanitize "$HOME\.config\opencode\opencode.json" "$root\opencode.json"
Sanitize "$HOME\.opencode\opencode.json" "$root\.opencode\opencode.json"
Copy-Item "$HOME\.config\opencode\agents\*.md" "$root\agents\" -Force
Copy-Item "$HOME\.context\*.md","$HOME\.context\*.json" "$root\context\" -Force
Get-ChildItem "$HOME\.context" -Directory | Where-Object { $_.Name -ne ".trash" } | ForEach-Object {
  $dest="$root\context\$($_.Name)"
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  $mdJson=Get-ChildItem $_.FullName -Recurse -File | Where-Object { $_.Extension -in ".md",".json" }
  foreach ($f in $mdJson) {
    $rel=$f.FullName.Substring($_.FullName.Length)
    $d="$dest$rel"
    New-Item -ItemType Directory (Split-Path $d) -Force | Out-Null
    Copy-Item $f.FullName $d -Force
  }
}
Copy-Item "$HOME\context-mcp-server\src" "$root\context-mcp-server\src" -Recurse -Force
Copy-Item "$HOME\context-mcp-server\package.json","$HOME\context-mcp-server\tsconfig.json","$HOME\context-mcp-server\vitest.config.ts","$HOME\context-mcp-server\.gitignore" "$root\context-mcp-server\" -Force -ErrorAction SilentlyContinue
Copy-Item "$HOME\.config\opencode\AGENTS.md" "$root\AGENTS.md" -Force -ErrorAction SilentlyContinue
Write-Host "Backup done. Run: git add -A; git commit -m 'backup'; git push"
