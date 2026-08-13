const fs = require("fs");

const FILES = [
  "src/backend/validaPayPixProjetosProntosCore.jsw",
  "src/backend/validaPayCartaoProjetosProntos.jsw",
  "src/backend/notificarVendaProjetoPronto.js"
];

function update(file, fn) {
  let code = fs.readFileSync(file, "utf8");
  const before = code;
  code = fn(code);
  if (code !== before) {
    fs.writeFileSync(file, code, "utf8");
    console.log(`Atualizado: ${file}`);
  } else {
    console.log(`Sem alteração: ${file}`);
  }
}

const genericPhoneBody = `  const original = safe(value);
  let number = digits(original);
  if (!number) return "";
  if (original.startsWith("+") && number.length >= 7 && number.length <= 15) return \`+\${number}\`;
  if (number.startsWith("55") && (number.length === 12 || number.length === 13)) return \`+\${number}\`;
  if (number.length === 10 || number.length === 11) return \`+55\${number}\`;
  if (number.length >= 7 && number.length <= 15) return \`+\${number}\`;
  return "";`;

update(FILES[0], code => {
  const desired = `function normalizePhone(value) {\n${genericPhoneBody}\n}`;
  if (code.includes(desired)) return code;
  const start = code.indexOf("function normalizePhone(value) {");
  const next = code.indexOf("function normalizeType", start + 1);
  if (start < 0 || next < 0) throw new Error("normalizePhone Pix não encontrada.");
  return code.slice(0, start) + desired + "\n\n\n" + code.slice(next);
});

update(FILES[1], code => {
  const desired = `function phone(v) {\n  const original = safe(v);\n  let n = digits(original);\n  if (!n) return "";\n  if (original.startsWith("+") && n.length >= 7 && n.length <= 15) return \`+\${n}\`;\n  if (n.startsWith("55") && (n.length === 12 || n.length === 13)) return \`+\${n}\`;\n  if (n.length === 10 || n.length === 11) return \`+55\${n}\`;\n  if (n.length >= 7 && n.length <= 15) return \`+\${n}\`;\n  return "";\n}`;
  if (code.includes(desired)) return code;
  const start = code.indexOf("function phone(v) {");
  const next = code.indexOf("function productType", start + 1);
  if (start < 0 || next < 0) throw new Error("phone do cartão não encontrada.");
  return code.slice(0, start) + desired + "\n\n\n" + code.slice(next);
});

update(FILES[2], code => {
  const desired = `function phone(value) {\n${genericPhoneBody}\n}`;
  if (code.includes(desired)) return code;
  const start = code.indexOf("function phone(value) {");
  const next = code.indexOf("function type", start + 1);
  if (start < 0 || next < 0) throw new Error("phone do notificador não encontrada.");
  return code.slice(0, start) + desired + "\n\n" + code.slice(next);
});
