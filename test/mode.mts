// Mode resolution: remembered per conversation first, then the transcript, then the user.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { spawn } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-'));
const projects = path.join(dir, 'projects');
process.env.OMP_CLAUDE_SESSIONS_DIR = dir;
process.env.OMP_CLAUDE_PROJECTS_DIR = projects;
const peersFile = path.join(dir, 'peers.json'); process.env.OMP_CLAUDE_PEERS_FILE = peersFile;

const extUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extensions', 'omp-claude-messenger.ts')).href;
const mod = await import(extUrl);
const z: any = { object: () => ({}), string: () => ({ optional(){return {}} }), number: () => ({ optional(){return {}} }), enum: () => ({ optional(){return {}} }) };
const tools: any = {}; const handlers: any = {};
mod.default({ zod: z, on: (e: string, h: any) => (handlers[e] = h), registerCommand() {}, registerTool: (d: any) => (tools[d.name] = d), sendMessage() {}, logger: { info: (m: string) => console.log('LOG', m) } });
await handlers.session_start({}, { cwd: '/tmp/proj-x', hasUI: false });

const sleeper = () => spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' });
const munged = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, '-');
const writeTranscript = (cwd: string, sid: string, lines: string[]) => {
  const p = path.join(projects, munged(cwd), `${sid}.jsonl`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n') + '\n');
};
const pipeName = (pid: number) => `\\\\.\\pipe\\LOCAL\\cc-msg-${'0'.repeat(31)}${pid % 10}`;
const servePipe = (name: string): Promise<net.Server> => new Promise(res => {
  const srv = net.createServer(sock => {
    sock.on('data', () => {});
    sock.on('error', () => {});
    setTimeout(() => sock.end(), 30);
  });
  srv.listen(name, () => res(srv));
});
const entry = (pid: number, name: string, cwd: string, sid: string) => {
  fs.writeFileSync(path.join(dir, `${pid}.json`), JSON.stringify({ pid, name, cwd, sessionId: sid, status: 'idle', entrypoint: 'claude-desktop', messagingSocketPath: pipeName(pid) }));
  fs.writeFileSync(path.join(dir, `${pid}.x.key`), JSON.stringify({ peerToken: 'a'.repeat(32) }));
};
const send = async (to: string, text: string) => {
  try { const r = await tools.claude_send.execute('x', { to, text }, undefined, undefined, { hasUI: false }); return r.content[0].text; }
  catch (e: any) { return 'ERR ' + e.message; }
};

// 1. no stored mode: the transcript supplies it, and a verified send stores it.
const a = sleeper(); const cwdA = 'C:\\proj\\modey';
entry(a.pid!, 'Modey', cwdA, 'sid-a');
writeTranscript(cwdA, 'sid-a', ['{"type":"user","message":{"role":"user","content":"hello one"},"permissionMode":"bypassPermissions"}']);
const srvA = await servePipe(pipeName(a.pid!));
const r1 = await send(String(a.pid), 'hello one');
console.log('1 transcript mode:', r1.slice(0, 150));
const saved1 = JSON.parse(fs.readFileSync(peersFile, 'utf8'));
console.log('1 stored:', saved1.find((p: any) => p.name === 'Modey')?.mode);

// 2. Desktop restart: new pid and session, transcript with no mode line. Remembered mode must carry.
a.kill(); fs.unlinkSync(path.join(dir, `${a.pid}.json`)); srvA.close();
await new Promise(r => setTimeout(r, 500));
const b = sleeper(); entry(b.pid!, 'Modey', cwdA, 'sid-b');
writeTranscript(cwdA, 'sid-b', ['{"type":"user","message":{"role":"user","content":"hello two"}}']);
const srvB = await servePipe(pipeName(b.pid!));
const r2 = await send('Modey', 'hello two');
console.log('2 remembered:', r2.slice(0, 150));

// 3. no stored mode and no transcript: must stop and ask, not guess.
const c = sleeper(); entry(c.pid!, 'Fresh', 'C:\\proj\\fresh', 'sid-c');
const r3 = await send(String(c.pid), 'hi');
console.log('3 unknown:', r3.slice(0, 150));

// 4. listing shows the stored mode and marks it.
const listing = (await tools.claude_peers.execute()).content[0].text;
console.log('4 listing:', listing.split('\n').map((l: string) => l.replace(/^.*· /, '')).join(' | '));

srvB.close();
for (const p of [b, c]) p.kill();
await handlers.session_shutdown?.();
process.exit(0);
