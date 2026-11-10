# omp-claude-messenger: install guide for agents

This repo is one global omp extension plus one skill. Both install into the user's home directory. The extension registers the omp session as a Claude peer at `session_start`, so a project-local copy does nothing.

## Install

1. Check the prerequisites: omp on `PATH`, and Claude Code or Claude Desktop 2.1.234 or newer on Windows, 2.1.224 or newer on macOS and Linux. Done when `omp --version` prints a version. Windows is tested; the macOS and Linux transport is untested against a real Claude session.
2. From the repo root, link the repo as an omp plugin. On Windows run `./deploy.ps1`; it clears an older bare-file install, then runs `omp plugin link`. On macOS and Linux run `omp plugin link "$PWD"`. Done when `omp plugin list` shows `omp-claude-messenger`, and `~/.omp/plugins/node_modules/omp-claude-messenger` resolves to this repo.
3. If an older install exists, delete `~/.omp/agent/extensions/omp-claude-messenger.ts` and `~/.agents/skills/omp-claude-messenger`. A bare extension file cannot carry the skill; the package does.
4. Ask the user to restart every omp session. Done when the user confirms. The session that ran the install keeps the code it loaded at start.
5. Verify in a new omp session. Done when all three hold: `claude_peers` is listed as a tool, `/claude-peers` is listed as a command, and `claude_peers` lists an open Claude session.

Manual link, when the script cannot run:

```powershell
omp plugin link (Resolve-Path .).Path
```

## After install

- No configuration is needed. The optional file is `~/.omp/agent/omp-claude-messenger.json`; the keys are in the README.
- The message rules live in `skills/omp-claude-messenger/SKILL.md`. Read them before sending.

## Uninstall

Run `omp plugin uninstall omp-claude-messenger`, then restart omp. The extension removes its `~/.claude/sessions/omp-agent-*` entry on shutdown. After a hard kill, delete the stale `omp-agent-*` entries by hand.

## Working in this repo

- This repo is the source of truth. The install is a link, so edits here load in the next omp session; there is no copy step. Re-run `./deploy.ps1` only to repair the link.
- `node test/rebind.mts` runs the rebind harness. It needs no live Claude session.
- The live harnesses take `OMP_EXE`, `OMP_TEST_MODEL`, and `OMP_TEST_SCRATCH`.
