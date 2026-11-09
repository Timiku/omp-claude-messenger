# omp-claude-messenger: install guide for agents

This repo is one global omp extension plus one skill. Both install into the user's home directory. The extension registers the omp session as a Claude peer at `session_start`, so a project-local copy does nothing.

## Install

1. Check the prerequisites: Windows, omp on `PATH`, Claude Code or Claude Desktop 2.1.234 or newer. Done when `omp --version` prints a version. Linux and macOS are not implemented: the extension loads inert there.
2. From the repo root in PowerShell, run `./deploy.ps1`. Done when it prints one `ext` line and one `skill` line, and these paths exist:
   - `%USERPROFILE%\.omp\agent\extensions\omp-claude-messenger.ts`
   - `%USERPROFILE%\.agents\skills\omp-claude-messenger\SKILL.md`
3. Ask the user to restart every omp session. Done when the user confirms. The session that ran the install keeps the code it loaded at start.
4. Verify in a new omp session. Done when all three hold: `claude_peers` is listed as a tool, `/claude-peers` is listed as a command, and `claude_peers` lists an open Claude session.

Manual copy, when the script cannot run:

```powershell
$ext = "$HOME\.omp\agent\extensions"; $skl = "$HOME\.agents\skills"
New-Item -ItemType Directory -Force $ext, $skl | Out-Null
Copy-Item extensions\omp-claude-messenger.ts $ext -Force
Copy-Item skills\omp-claude-messenger $skl -Recurse -Force
```

## After install

- No configuration is needed. The optional file is `~/.omp/agent/omp-claude-messenger.json`; the keys are in the README.
- The message rules live in `skills/omp-claude-messenger/SKILL.md`. Read them before sending.

## Uninstall

Delete the two installed paths and restart omp. The extension removes its `~/.claude/sessions/omp-agent-*` entry on shutdown. After a hard kill, delete the stale `omp-agent-*` entries by hand.

## Working in this repo

- This repo is the source of truth. Edit `extensions/` or `skills/` here, then run `./deploy.ps1`. The copies under `%USERPROFILE%` are install targets.
- `node test/rebind.mts` runs the rebind harness. It needs no live Claude session.
- The live harnesses take `OMP_EXE`, `OMP_TEST_MODEL`, and `OMP_TEST_SCRATCH`.
