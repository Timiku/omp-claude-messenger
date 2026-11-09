# Copy the working tree into the live omp locations. Run from this folder.
$ErrorActionPreference = 'Stop'
$ext = "$HOME\.omp\agent\extensions"; $skl = "$HOME\.agents\skills"
Get-ChildItem "$PSScriptRoot\extensions\*.ts" | ForEach-Object { Copy-Item $_ "$ext\" -Force; "ext   $($_.Name)" }
Get-ChildItem "$PSScriptRoot\skills" -Directory | ForEach-Object { Copy-Item $_.FullName $skl -Recurse -Force; "skill $($_.Name)" }
"Restart omp sessions to load the new extensions."
