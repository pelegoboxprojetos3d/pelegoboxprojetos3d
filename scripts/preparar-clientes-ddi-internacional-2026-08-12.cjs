const fs = require("fs");
const FILE = "src/backend/clientes.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

const desired = `export function normalizarWhatsapp(numero) {
  const original = texto(numero);
  let numeros = somenteNumeros(original);

  if (!numeros) return "";

  // E164 explícito: preserva qualquer DDI válido.
  if (original.startsWith("+") && numeros.length >= 7 && numeros.length <= 15) {
    return \`+\${numeros}\`;
  }

  // Compatibilidade com o Brasil legado.
  if (numeros.startsWith(DDI_BRASIL) && (numeros.length === 12 || numeros.length === 13)) {
    return \`+\${numeros}\`;
  }
  if (numeros.length === 10 || numeros.length === 11) {
    return \`+\${DDI_BRASIL}\${numeros}\`;
  }

  // Número internacional sem o sinal +, já contendo DDI.
  if (numeros.length >= 7 && numeros.length <= 15) {
    return \`+\${numeros}\`;
  }

  return "";
}`;

if (!code.includes(desired)) {
  const start = code.indexOf("export function normalizarWhatsapp(numero)");
  const next = code.indexOf("function criarVariantesWhatsapp", start + 1);
  if (start < 0 || next < 0 || next <= start) {
    throw new Error("Função normalizarWhatsapp não encontrada pelos marcadores.");
  }
  code = code.slice(0, start) + desired + "\n\n" + code.slice(next);
  changed = true;
}

const oldVariants = `  const completoSemMais = somenteNumeros(padrao);
  const numeroNacional = completoSemMais.slice(2);

  return [
    padrao,
    completoSemMais,
    numeroNacional
  ];`;
const newVariants = `  const completoSemMais = somenteNumeros(padrao);
  const variantes = [padrao, completoSemMais];

  // Mantém compatibilidade com clientes brasileiros antigos sem +55.
  if (completoSemMais.startsWith(DDI_BRASIL)) {
    variantes.push(completoSemMais.slice(DDI_BRASIL.length));
  }

  return [...new Set(variantes.filter(Boolean))];`;
if (code.includes(oldVariants)) {
  code = code.replace(oldVariants, newVariants);
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Clientes preparado para E164 internacional e legado brasileiro.");
} else {
  console.log("Clientes já suporta E164 internacional.");
}
