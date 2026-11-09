import { spawn } from 'node:child_process'; import fs from 'node:fs';
// Env: OMP_EXE (default "omp"), OMP_TEST_MODEL (optional), OMP_TEST_SCRATCH (default "wo").
const args = ['--mode','rpc','--no-session']; if (process.env.OMP_TEST_MODEL) args.push('--model', process.env.OMP_TEST_MODEL);
const p = spawn(process.env.OMP_EXE ?? 'omp', args, { cwd: process.env.OMP_TEST_SCRATCH ?? 'wo', stdio: ['pipe','pipe','pipe'] });
const out = fs.createWriteStream('O.out'); p.stderr.pipe(fs.createWriteStream('O.err'));
let rest = '';
p.stdout.on('data', d => { out.write(d); rest += d; const ls = rest.split('\n'); rest = ls.pop();
  for (const l of ls) { let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'extension_ui_request' && ['select','confirm','input'].includes(o.method)) {
      const pol = Object.fromEntries(fs.readFileSync('policy.txt','utf8').trim().split(';').map(x => x.split(':')));
      fs.appendFileSync('ui.log', JSON.stringify(o) + '\n');
      let r;
      if (pol.confirm === 'cancel' || pol.select === 'cancel') r = { type:'extension_ui_response', id:o.id, cancelled:true };
      else if (o.method === 'confirm') r = { type:'extension_ui_response', id:o.id, confirmed: pol.confirm !== 'false' };
      else r = { type:'extension_ui_response', id:o.id, value: o.options ? (o.options[Number(pol.select ?? 0)]?.value ?? o.options[Number(pol.select ?? 0)]) : '' };
      p.stdin.write(JSON.stringify(r) + '\n'); fs.appendFileSync('ui.log', '  -> ' + JSON.stringify(r) + '\n');
    } } });
let done = 0, n = 0;
for (let i = 0; i < 600; i++) { await new Promise(r => setTimeout(r, 3000));
  const ls = fs.readFileSync('cmd.jsonl','utf8').split('\n').filter(Boolean);
  while (done < ls.length) p.stdin.write(JSON.stringify({ id: 'c' + (++n), ...JSON.parse(ls[done++]) }) + '\n'); }
p.kill(); process.exit(0);
