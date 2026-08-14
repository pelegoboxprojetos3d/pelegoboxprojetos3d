const fs = require('fs');

const file = 'src/public/custom-elements/pelego-checkout-pronto.js';
let s = fs.readFileSync(file, 'utf8');

const replacements = [
  [
    '.step{min-height:42px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e1e1e1;border-radius:23px;background:#fafafa;color:#555;font-size:11px}',
    '.step{min-height:42px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e1e1e1;border-radius:23px;background:#fafafa;color:#555;font-size:11px;transition:background-color .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease}'
  ],
  [
    '.stepNo{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #ccc;background:#fff;font-weight:700}',
    '.stepNo{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #ccc;background:#fff;font-weight:700;transition:background-color .16s ease,border-color .16s ease,color .16s ease}'
  ],
  [
    '.control{width:100%;height:48px;padding:0 13px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none}',
    '.control{width:100%;height:48px;padding:0 13px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none;transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease}'
  ],
  [
    '.phoneRow .iti__tel-input{width:100%;height:48px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none;padding-left:118px!important}',
    '.phoneRow .iti__tel-input{width:100%;height:48px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none;padding-left:118px!important;transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease}'
  ],
  [
    '.methodLogo{display:flex;width:42px;height:35px;flex:0 0 42px;align-items:center;justify-content:center;overflow:hidden;border-radius:8px;background:#f4f4f4}',
    '.methodLogo{display:flex;width:42px;height:35px;flex:0 0 42px;align-items:center;justify-content:center;overflow:hidden;border-radius:8px;background:#f4f4f4;transition:background-color .16s ease}'
  ],
  [
    '.methodStatus{flex:0 0 auto;padding:4px 5px;border-radius:999px;background:#eee;color:#777;font-size:7px;font-weight:700;text-transform:uppercase;white-space:nowrap}',
    '.methodStatus{flex:0 0 auto;padding:4px 5px;border-radius:999px;background:#eee;color:#777;font-size:7px;font-weight:700;text-transform:uppercase;white-space:nowrap;transition:background-color .16s ease,color .16s ease}'
  ]
];

let changed = 0;
for (const [before, after] of replacements) {
  if (s.includes(after)) continue;
  if (!s.includes(before)) {
    throw new Error(`Trecho visual não encontrado: ${before.slice(0, 70)}...`);
  }
  s = s.replace(before, after);
  changed += 1;
}

if (!changed) {
  console.log('Microinterações já estavam suavizadas; nenhuma alteração necessária.');
  process.exit(0);
}

fs.writeFileSync(file, s, 'utf8');
console.log(`Microinterações suavizadas em ${changed} regras CSS, sem alterar lógica do checkout.`);
