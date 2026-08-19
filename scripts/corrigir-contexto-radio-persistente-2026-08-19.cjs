const fs = require('fs');
const path = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(path, 'utf8');
const oldLine = "import './pelego-radio-core.js';";
const persistentImport = "import '../radioPelegoPersistente.js';";
if (!src.includes(persistentImport)) {
  if (!src.includes(oldLine)) throw new Error('Import do core não encontrado.');
  src = src.replace(oldLine, `${persistentImport}\n${oldLine}`);
  fs.writeFileSync(path, src);
}
console.log('Import persistente no contexto do custom element garantido.');
