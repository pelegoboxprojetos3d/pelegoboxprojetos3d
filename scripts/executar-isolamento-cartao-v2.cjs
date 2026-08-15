const fs = require('fs');
const { spawnSync } = require('child_process');

const sourcePath = 'scripts/isolar-token-cartao-e-recarregar-salvo-2026-08-15.cjs';
const tempPath = '/tmp/isolar-token-cartao-e-recarregar-salvo-2026-08-15-fixed.cjs';
let source = fs.readFileSync(sourcePath, 'utf8');

const fixes = [
  [
    '    if (year.length === 2) year = `20${year}`;',
    '    if (year.length === 2) year = "20" + year;'
  ],
  [
    '          expiration: `${month}/${year}`',
    '          expiration: month + "/" + year'
  ]
];

for (const [from, to] of fixes) {
  if (!source.includes(from)) throw new Error(`Trecho a corrigir não encontrado: ${from}`);
  source = source.replace(from, to);
}

fs.writeFileSync(tempPath, source, 'utf8');
const check = spawnSync(process.execPath, ['--check', tempPath], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
const run = spawnSync(process.execPath, [tempPath], { stdio: 'inherit' });
process.exit(run.status || 0);
