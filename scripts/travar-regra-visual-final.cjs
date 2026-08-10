const fs = require('fs');

const mainPath = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let s = read(mainPath);

const functionMarker = 'async function mostrarValoresEAcessos() {';
const popupMarker = '// ======================================================\n// POPUP\n// ======================================================';

const helpers = `async function alternarAvisoPaginaPrincipal(id, mostrar) {\n  try {\n    const elemento = $w(id);\n\n    if (mostrar) {\n      await Promise.allSettled([\n        typeof elemento.expand === \"function\" ? elemento.expand() : Promise.resolve(),\n        typeof elemento.show === \"function\" ? elemento.show() : Promise.resolve()\n      ]);\n    } else {\n      await Promise.allSettled([\n        typeof elemento.hide === \"function\" ? elemento.hide() : Promise.resolve(),\n        typeof elemento.collapse === \"function\" ? elemento.collapse() : Promise.resolve()\n      ]);\n    }\n  } catch (error) {\n    console.warn(\n      \`Falha ao alternar aviso principal \${id}:\`,\n      error?.message || error\n    );\n  }\n}\n\nfunction estilizarAvisoPaginaPrincipal(id, pago) {\n  try {\n    const elemento = $w(id);\n\n    if (!elemento?.style) {\n      return;\n    }\n\n    /*\n      O cartão continua branco.\n      Pagamento confirmado recebe contorno verde no desktop.\n      A sombra configurada no Editor é preservada.\n    */\n    elemento.style.backgroundColor = \"#FFFFFF\";\n    elemento.style.borderColor = pago ? \"#159447\" : \"#E0E0E0\";\n    elemento.style.borderWidth = pago ? 2 : 1;\n  } catch (_) {}\n}\n\nasync function aplicarRegraVisualAvisosPaginaPrincipal() {\n  const mobile = wixWindowFrontend.formFactor === \"Mobile\";\n\n  const etapas = [\n    { id: IDS.avisoMedidas, pago: acessos.medidas === true },\n    { id: IDS.avisoGraficos, pago: acessos.graficos === true },\n    { id: IDS.avisoProjeto, pago: acessos.projeto === true }\n  ];\n\n  for (const etapa of etapas) {\n    estilizarAvisoPaginaPrincipal(etapa.id, etapa.pago);\n\n    /*\n      REGRA ÚNICA:\n      - Desktop: os três avisos ficam visíveis.\n      - Mobile: aviso de etapa paga some e recolhe espaço.\n      - Mobile: etapas ainda não pagas continuam visíveis.\n      - IMPORTANTE não é tocado por esta função e permanece sempre.\n    */\n    await alternarAvisoPaginaPrincipal(\n      etapa.id,\n      mobile ? !etapa.pago : true\n    );\n  }\n}\n\n`;

if (!s.includes('async function aplicarRegraVisualAvisosPaginaPrincipal()')) {
  const index = s.indexOf(functionMarker);
  assert(index >= 0, 'Página principal: mostrarValoresEAcessos não encontrada.');
  s = s.slice(0, index) + helpers + s.slice(index);
}

const start = s.indexOf(functionMarker);
const end = s.indexOf(popupMarker, start);
assert(start >= 0 && end > start, 'Página principal: bloco de valores/acessos não encontrado.');

let block = s.slice(start, end);

if (!block.includes('await aplicarRegraVisualAvisosPaginaPrincipal();')) {
  const lastClose = block.lastIndexOf('\n}');
  assert(lastClose > 0, 'Página principal: fechamento de mostrarValoresEAcessos não encontrado.');
  block =
    block.slice(0, lastClose) +
    '\n\n  await aplicarRegraVisualAvisosPaginaPrincipal();' +
    block.slice(lastClose);

  s = s.slice(0, start) + block + s.slice(end);
}

write(mainPath, s);

console.log('Regra visual final travada: desktop mostra 3 avisos; mobile oculta somente etapas pagas; IMPORTANTE preservado.');
