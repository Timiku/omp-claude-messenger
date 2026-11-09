// Stale-pid rebinding: send to a pid that no longer exists; the same-named session now has a new pid.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-')); process.env.OMP_CLAUDE_SESSIONS_DIR = dir;
const peersFile = path.join(dir, 'peers.json'); process.env.OMP_CLAUDE_PEERS_FILE = peersFile;
// persisted by an earlier omp run: this process never saw pid 4242; "Ancient" is long expired
fs.writeFileSync(peersFile, JSON.stringify([
  { key: 'local_old', name: 'Pool calc', cwd: 'C:\\proj\\pool', hostSessionId: 'local_old', pids: [4242], seenAt: Date.now() },
  { key: 'gone', name: 'Gone session', cwd: 'C:\\proj\\gone', pids: [5555], seenAt: Date.now() },
  { key: 'ancient', name: 'Ancient', pids: [1], seenAt: 1 }]));
const sleeper = () => spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' });
const a = sleeper(), b = sleeper();
const entry = (pid: number, name: string, cwd: string) => fs.writeFileSync(path.join(dir, `${pid}.json`),
  JSON.stringify({ pid, name, cwd, status: 'idle', entrypoint: 'claude-desktop', messagingSocketPath: `\\.\pipe\LOCAL\cc-msg-${'0'.repeat(31)}${pid % 10}` }));
const extUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extensions', 'omp-claude-messenger.ts')).href;
const mod = await import(extUrl);
const z: any = { object: () => ({}), string: () => ({ optional(){return {}} }), number: () => ({ optional(){return {}} }), enum: () => ({ optional(){return {}} }) };
const tools: any = {}; const handlers: any = {};
mod.default({ zod: z, on: (e: string, h: any) => (handlers[e] = h), registerCommand() {}, registerTool: (d: any) => (tools[d.name] = d), sendMessage() {}, logger: { info: (m: string) => console.log('LOG', m) } });
await handlers.session_start({}, { cwd: 'C:/proj/x', hasUI: false });
entry(a.pid!, 'Pool calc', 'C:\\proj\\pool'); entry(b.pid!, 'Other', 'C:\\proj\\other');
const tryOnce = async (to: string) => { try { const r = await tools.claude_send.execute('x', { to, text: 'hi', mode: 'prompting' }, undefined, undefined, { hasUI: false }); return r.content[0].text.slice(0, 120); } catch (e: any) { return 'ERR ' + e.message.slice(0, 160); } };
console.log('1 by pid     :', await tryOnce(String(a.pid)));          // remembers peers
a.kill(); await new Promise(r => setTimeout(r, 500)); fs.unlinkSync(path.join(dir, `${a.pid}.json`));
const a2 = sleeper(); entry(a2.pid!, 'Pool calc', 'E:\p\pool');       // Desktop restarted: same session, new pid
console.log('2 stale pid  :', await tryOnce(String(a.pid)));          // must rebind, no "no live session"
console.log('2b persisted pid (not seen this run):', await tryOnce('4242'));
console.log('2c old title            :', await tryOnce('Pool calc'));
console.log('2d title not live now:', await tryOnce('5555'));
console.log('3 unknown pid:', await tryOnce('99999'));
const saved = JSON.parse(fs.readFileSync(peersFile, 'utf8'));
console.log('peers file:', saved.length, 'entries ->', saved.map((p: any) => `${p.name}[${p.pids.length} pids]`).join(', '));
for (const p of [a2, b]) p.kill(); await handlers.session_shutdown?.(); process.exit(0);
