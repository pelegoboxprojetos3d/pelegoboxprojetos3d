const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let s = fs.readFileSync(path, 'utf8');

const marker1 = `function alterarDescricao(\n  texto\n) {\n  $w(\n    IDS.descricao\n  ).text =\n    safe(texto);\n}\n\n\n// ======================================================\n// PROCESSAMENTO VISUAL DA ENTREGA\n// ======================================================\n`;

const replacement1 = `function alterarDescricao(\n  texto\n) {\n  $w(\n    IDS.descricao\n  ).text =\n    safe(texto);\n}\n\n\n/*\n  Enquanto os dados reais ainda não chegaram, não mostramos os textos\n  padrão do Editor (TITULO DO PROJETO, sku, Small Title etc.) nem os\n  botões das etapas. Usamos somente os IDs dos elementos, sem depender\n  do nome de seção. O espaço é preservado para evitar pulos no layout.\n*/\nconst IDS_DADOS_REAIS_ENTREGA = [\n  IDS.titulo,\n  IDS.sku,\n  IDS.medidas,\n  IDS.valorMedidas,\n  IDS.graficos,\n  IDS.valorGraficos,\n  IDS.projeto,\n  IDS.valorProjeto\n];\n\nasync function ocultarDadosAteCarregamento() {\n  try {\n    $w(IDS.titulo).text = \"\";\n    $w(IDS.sku).text = \"\";\n    $w(IDS.valorMedidas).text = \"\";\n    $w(IDS.valorGraficos).text = \"\";\n    $w(IDS.valorProjeto).text = \"\";\n  } catch (_) {}\n\n  await Promise.allSettled(\n    IDS_DADOS_REAIS_ENTREGA.map((id) => {\n      try {\n        const elemento = $w(id);\n        return typeof elemento.hide === \"function\"\n          ? elemento.hide()\n          : Promise.resolve();\n      } catch (_) {\n        return Promise.resolve();\n      }\n    })\n  );\n}\n\nasync function mostrarDadosCarregados() {\n  await Promise.allSettled(\n    IDS_DADOS_REAIS_ENTREGA.map((id) => {\n      try {\n        const elemento = $w(id);\n        return typeof elemento.show === \"function\"\n          ? elemento.show()\n          : Promise.resolve();\n      } catch (_) {\n        return Promise.resolve();\n      }\n    })\n  );\n}\n\n\n// ======================================================\n// PROCESSAMENTO VISUAL DA ENTREGA\n// ======================================================\n`;

if (!s.includes(marker1)) {
  throw new Error('Marker helper não encontrado');
}
s = s.replace(marker1, replacement1);

const marker2 = `  await mostrarGaleria();\n\n  await mostrarAvisosEntrega();\n`;
const replacement2 = `  await mostrarGaleria();\n\n  /*\n    Só agora os textos e botões recebem conteúdo real e podem aparecer.\n    Assim os placeholders do Editor nunca ficam expostos durante a espera.\n  */\n  await mostrarDadosCarregados();\n\n  await mostrarAvisosEntrega();\n`;
if (!s.includes(marker2)) {
  throw new Error('Marker render não encontrado');
}
s = s.replace(marker2, replacement2);

const marker3 = `    esconderBotaoVideo()\n      .catch(\n`;
const replacement3 = `    ocultarDadosAteCarregamento()\n      .catch(\n        (erro) => {\n          console.warn(\n            \"Falha ao ocultar placeholders da entrega:\",\n            erro?.message || erro\n          );\n        }\n      );\n\n    esconderBotaoVideo()\n      .catch(\n`;
if (!s.includes(marker3)) {
  throw new Error('Marker onReady não encontrado');
}
s = s.replace(marker3, replacement3);

fs.writeFileSync(path, s);
console.log('R26 aplicada');
