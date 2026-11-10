# Install this repo as an omp extension package: the extension and its bundled
# skill load from one package root. A bare extension file cannot carry a skill.
$ErrorActionPreference = 'Stop'
$legacyExt = "$HOME\.omp\agent\extensions\omp-claude-messenger.ts"
$legacySkill = "$HOME\.agents\skills\omp-claude-messenger"
if (Test-Path $legacyExt) { Remove-Item $legacyExt -Force; "removed legacy ext $legacyExt" }
if (Test-Path $legacySkill) { Remove-Item $legacySkill -Recurse -Force; "removed legacy skill $legacySkill" }
omp plugin link $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw "omp plugin link failed" }
"Restart omp sessions to load the package."
