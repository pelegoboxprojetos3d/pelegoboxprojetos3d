const fs = require('fs');
const path = 'src/public/radioPelegoPersistente.js';
let src = fs.readFileSync(path, 'utf8');
const oldGuard = "if (window.PelegoRadioPersistent?.version === '2.0.0') return;";
const newGuard = "if (window.PelegoRadioPersistent) return;";
if (src.includes(oldGuard)) {
  src = src.replace(oldGuard, newGuard);
  fs.writeFileSync(path, src);
} else if (!src.includes(newGuard)) {
  throw new Error('Guard esperado do motor persistente não encontrado.');
}
console.log('Motor global existente terá prioridade sobre o fallback V2.');
