// POSIX transport, simulated: OMP_CLAUDE_PLATFORM=linux + Unix sockets (works on Windows too; Node has AF_UNIX there).
// NOT a substitute for a real Linux/macOS run against a real Claude.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net'; import crypto from 'node:crypto'; import { spawn } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'posix-'));
const sessDir = path.join(root, 'sessions'), sockDir = path.join(root, 'cc-socks'), peersFile = path.join(root, 'peers.json');
Object.assign(process.env, { OMP_CLAUDE_PLATFORM: 'linux', OMP_CLAUDE_SESSIONS_DIR: sessDir, OMP_CLAUDE_SOCKET_DIR: sockDir, OMP_CLAUDE_PEERS_FILE: peersFile });
fs.mkdirSync(sessDir, { recursive: true });
let fails = 0; const check = (name: string, ok: boolean, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) fails++; };

const extUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extensions', 'omp-claude-messenger.ts')).href;
const mod = await import(extUrl);
const z: any = { object: () => ({}), string: () => ({ optional() { return {}; } }), number: () => ({ optional() { return {}; } }), enum: () => ({ optional() { return {}; } }) };
const tools: any = {}, handlers: any = {}, inbox: any[] = [];
mod.default({ zod: z, on: (e: string, h: any) => (handlers[e] = h), registerCommand() {}, registerTool: (d: any) => (tools[d.name] = d), sendMessage: (m: any) => inbox.push(m), logger: { info: (m: string) => console.log('LOG', m) } });
await handlers.session_start({}, { cwd: '/home/u/proj', hasUI: false });

// 1. own registry entry + socket + key file
const own = JSON.parse(fs.readFileSync(path.join(sessDir, `${process.pid}.json`), 'utf8'));
check('socket path is <dir>/<pid>.sock', own.messagingSocketPath === path.join(sockDir, `${process.pid}.sock`), own.messagingSocketPath);
check('cwd not backslash-rewritten', own.cwd === '/home/u/proj', own.cwd);
check('peerProtocol 1', own.peerProtocol === 1);
check('socket exists', fs.existsSync(own.messagingSocketPath));
const keys = fs.readdirSync(sessDir).filter(f => f.endsWith('.key'));
const want = `${process.pid}.${crypto.createHash('sha256').update(path.resolve(own.messagingSocketPath), 'utf8').digest('hex')}.key`;
check('key file named by sha256(resolved socket path)', keys.includes(want), keys.join(','));
const kb = JSON.parse(fs.readFileSync(path.join(sessDir, want), 'utf8'));
check('key body has peerToken(32 hex)+procStart+pidDomain', /^[0-9a-f]{32}$/.test(kb.peerToken) && !!kb.procStart && !!kb.pidDomain, JSON.stringify(kb));

// 2. inbound without auth frame, and with a (ignored) auth frame
const frame = (t: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: `<cross-session-message from="uds:/tmp/x.sock" from-name="peer" from-mode="bypass">${t}</cross-session-message>` } }) + '\n';
const sendRaw = (payload: string) => new Promise<void>(res => { const s = net.connect(own.messagingSocketPath, () => { s.write(payload); setTimeout(() => { s.destroy(); res(); }, 400); }); s.on('error', () => res()); });
await sendRaw(frame('no-auth hello'));
await sendRaw(JSON.stringify({ type: 'auth', token: 'wrong' }) + '\n' + frame('auth-ignored hello'));
const got = inbox.map(m => JSON.stringify(m)).join('|');
check('inbound without auth frame delivered', got.includes('no-auth hello'));
check('inbound with ignored auth frame delivered', got.includes('auth-ignored hello'));

// 3. outbound to a fake Claude on a Unix socket: no auth line, from="uds:<our socket>"
const fakePid = 987654; const fakeSock = path.join(sockDir, `${fakePid}.sock`); const seen: string[] = [];
const fake = net.createServer(c => { let buf = ''; c.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); seen.push(l); } }); });
await new Promise<void>(r => fake.listen(fakeSock, () => r()));
const sleeper = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' });
fs.writeFileSync(path.join(sessDir, `${sleeper.pid}.json`), JSON.stringify({ pid: sleeper.pid, name: 'FakeClaude', cwd: '/home/u/other', status: 'idle', entrypoint: 'cli', messagingSocketPath: `uds:${fakeSock}` }));
let out = ''; try { const r = await tools.claude_send.execute('x', { to: 'FakeClaude', text: 'out hello', mode: 'prompting' }, undefined, undefined, { hasUI: false }); out = r.content[0].text; } catch (e: any) { out = 'ERR ' + e.message; }
console.log('send result:', out.slice(0, 140));
check('outbound reached fake socket (uds: prefix stripped)', seen.some(l => l.includes('out hello')));
check('outbound has no auth line', !seen.some(l => l.includes('"type":"auth"')));
check('outbound from= is uds:<our socket>', seen.some(l => l.includes(`from=\\"uds:${own.messagingSocketPath.replace(/\\/g, '\\\\')}\\"`) || l.includes(own.messagingSocketPath.replace(/\\/g, '\\\\'))));

// 4. symlink refusal (needs symlink privilege; skipped when the OS denies it)
const link = path.join(sockDir, 'link.sock'); let linked = false; try { fs.symlinkSync(fakeSock, link); linked = true; } catch { /* no privilege */ }
if (linked) {
  fs.writeFileSync(path.join(sessDir, `${sleeper.pid}.json`), JSON.stringify({ pid: sleeper.pid, name: 'FakeClaude', cwd: '/home/u/other', status: 'idle', entrypoint: 'cli', messagingSocketPath: link }));
  seen.length = 0; let e2 = ''; try { await tools.claude_send.execute('x', { to: 'FakeClaude', text: 'via link', mode: 'prompting' }, undefined, undefined, { hasUI: false }); } catch (e: any) { e2 = e.message; }
  check('symlinked socket refused', /symlink/.test(e2) && !seen.some(l => l.includes('via link')), e2.slice(0, 100));
} else console.log('SKIP symlink test (no symlink privilege)');

// 5. stale socket from a crashed run is replaced; shutdown unlinks the socket
await handlers.session_shutdown?.();
check('socket removed on shutdown', !fs.existsSync(own.messagingSocketPath));

sleeper.kill(); fake.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
