const fs = require("fs");

const NORMALIZER = "src/backend/projetosProntosNormalizacao.js";
const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";
const STATE = "scripts/estado-final-projetos-prontos-2026-08-13.cjs";
const GUARD = "scripts/blindar-regra-titulos-2026-08-13.cjs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function lines(values) {
  return values.join("\n");
}

function writeIfChanged(file, before, after) {
  if (before === after) {
    console.log(`${file}: já estava correto.`);
    return false;
  }
  fs.writeFileSync(file, after, "utf8");
  console.log(`${file}: corrigido.`);
  return true;
}

function replaceRequired(code, from, to, label) {
  if (code.includes(to)) return code;
  const index = code.indexOf(from);
  if (index < 0) {
    throw new Error(`${label}: trecho esperado não encontrado.`);
  }
  return code.slice(0, index) + to + code.slice(index + from.length);
}

function patchNormalizer() {
  const before = read(NORMALIZER);
  let code = before;

  if (!code.includes('"mg"')) {
    code = replaceRequired(
      code,
      '  "dsp", "eros", "jbl", "kc", "mdf", "pdf", "pix", "rms", "sds"',
      '  "dsp", "eros", "jbl", "kc", "mdf", "mg", "pdf", "pix", "rms", "sds"',
      "Sigla MG"
    );
  }

  writeIfChanged(NORMALIZER, before, code);
}

function patchCheckoutPage() {
  const before = read(PAGE);
  let code = before;

  const oldTitle = lines([
    "function tituloProjeto(item) {",
    "  return decodeText(",
    "    item?.titulo_video",
    "  )",
    "    .split(",
    "      /\\bPELEGO(?:\\s*BOX)?\\b/i",
    "    )[0]",
    '    .replace(/\\s+/g, " ")',
    "    .trim();",
    "}"
  ]);

  const newTitle = lines([
    "function tituloProjeto(item) {",
    "  const original =",
    "    decodeText(",
    "      item?.titulo_video",
    "    );",
    "",
    "  /*",
    "    O código 001–014 pode estar DEPOIS do sufixo PELEGO BOX.",
    "    Primeiro capturamos o código no título original e só depois removemos",
    "    a parte institucional. Assim o checkout nunca perde o questionário.",
    "  */",
    "  const codigoQuestionario =",
    "    original.match(",
    "      /\\b(00[1-9]|01[0-4])\\b\\s*$/i",
    '    )?.[1] || "";',
    "",
    "  const base =",
    "    original",
    "      .split(",
    "        /\\bPELEGO(?:\\s*BOX)?\\b/i",
    "      )[0]",
    '      .replace(/\\s+/g, " ")',
    "      .trim();",
    "",
    "  if (",
    "    !codigoQuestionario ||",
    "    new RegExp(",
    "      `\\\\b${codigoQuestionario}\\\\b\\\\s*$`",
    "    ).test(base)",
    "  ) {",
    "    return base;",
    "  }",
    "",
    "  return `${base} ${codigoQuestionario}`.trim();",
    "}"
  ]);

  code = replaceRequired(
    code,
    oldTitle,
    newTitle,
    "Preservação do código 001–014 no checkout"
  );

  const oldGraf = lines([
    "    return (",
    "      `#${codigo} ` +",
    '      "ANÁLISES GRÁFICAS DO PROJETO PRONTO PARA " +',
    "      base",
    "    );"
  ]);
  const newGraf = lines([
    "    return (",
    "      `#${codigo} Gráficos Projeto Pronto ${base}`",
    "    );"
  ]);
  code = replaceRequired(code, oldGraf, newGraf, "Título do Botão 2");

  const oldCompleto = lines([
    "    return (",
    "      `#${codigo} ` +",
    '      "PROJETO COMPLETO PARA " +',
    "      base",
    "    );"
  ]);
  const newCompleto = lines([
    "    return (",
    "      `#${codigo} Projeto Pronto Completo ${base}`",
    "    );"
  ]);
  code = replaceRequired(code, oldCompleto, newCompleto, "Título do Botão 3");

  const oldMedidas = lines([
    "  return (",
    "    `#${codigo} ` +",
    '    "MEDIDAS DO PROJETO PRONTO PARA " +',
    "    base",
    "  );"
  ]);
  const newMedidas = lines([
    "  return (",
    "    `#${codigo} Medidas Projeto Pronto ${base}`",
    "  );"
  ]);
  code = replaceRequired(code, oldMedidas, newMedidas, "Título do Botão 1");

  writeIfChanged(PAGE, before, code);
}

function canonicalAliasesBlock() {
  return lines([
    "    produto: tituloEmailCorreto,",
    "    titulo: tituloEmailCorreto,",
    "    tituloProjeto: tituloEmailCorreto,",
    "    tituloCheckout: tituloEmailCorreto,",
    "    tituloOriginal: tituloEmailCorreto,",
    "    nomeProduto: tituloEmailCorreto,"
  ]);
}

function patchNotify() {
  const before = read(NOTIFY);
  let code = before;

  const aliases = canonicalAliasesBlock();
  const legacyPair = lines([
    "    produto: tituloEmailCorreto,",
    "    tituloProjeto: tituloEmailCorreto,"
  ]);

  if (!code.includes("    tituloOriginal: tituloEmailCorreto,")) {
    if (!code.includes(legacyPair)) {
      throw new Error("Payload do Make: âncora canônica não encontrada.");
    }
    code = code.replaceAll(legacyPair, aliases);
  }

  writeIfChanged(NOTIFY, before, code);
}

function patchStateScript() {
  const before = read(STATE);
  let code = before;

  const start = code.indexOf("function patchEmailTitle() {");
  const end = code.indexOf("\nfunction patchInvoiceFunction", start);

  if (start < 0 || end < 0) {
    throw new Error("Estado final: função patchEmailTitle não encontrada.");
  }

  const replacement = lines([
    "function patchEmailTitle() {",
    "  /*",
    "    O título agora tem uma única regra canônica no backend.",
    "    Este script antigamente removia essa regra e outro script a recolocava",
    "    alguns milissegundos depois. A dança foi aposentada.",
    "  */",
    '  console.log("E-mail Pelego: regra canônica de título preservada.");',
    "}"
  ]);

  const currentBlock = code.slice(start, end);
  if (currentBlock !== replacement) {
    code = code.slice(0, start) + replacement + code.slice(end);
  }

  writeIfChanged(STATE, before, code);
}

function patchGuardScript() {
  const before = read(GUARD);
  let code = before;

  const writeAnchor = '  fs.writeFileSync(NOTIFY, code, "utf8");';
  const guardMarker = "// TITULO_EMAIL_ALIASES_CANONICOS_V1";

  if (!code.includes(guardMarker)) {
    const insertion = lines([
      "  // TITULO_EMAIL_ALIASES_CANONICOS_V1",
      "  const aliasesLegacy = [",
      '    "    produto: tituloEmailCorreto,",',
      '    "    tituloProjeto: tituloEmailCorreto,"',
      '  ].join("\\n");',
      "  const aliasesCanonicos = [",
      '    "    produto: tituloEmailCorreto,",',
      '    "    titulo: tituloEmailCorreto,",',
      '    "    tituloProjeto: tituloEmailCorreto,",',
      '    "    tituloCheckout: tituloEmailCorreto,",',
      '    "    tituloOriginal: tituloEmailCorreto,",',
      '    "    nomeProduto: tituloEmailCorreto,"',
      '  ].join("\\n");',
      '  if (!code.includes("    tituloOriginal: tituloEmailCorreto,") && code.includes(aliasesLegacy)) {',
      "    code = code.replaceAll(aliasesLegacy, aliasesCanonicos);",
      "  }",
      ""
    ]) + "\n";

    if (!code.includes(writeAnchor)) {
      throw new Error("Blindagem de títulos: ponto de gravação não encontrado.");
    }
    code = code.replace(writeAnchor, insertion + writeAnchor);
  }

  writeIfChanged(GUARD, before, code);
}

function loadNormalizerForTests() {
  const source = read(NORMALIZER).replace(/\bexport\s+/g, "");
  return new Function(
    `${source}\nreturn { normalizarTituloProduto, tituloEtapaProjetoPronto };`
  )();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nEsperado: ${expected}\nObtido:   ${actual}`);
  }
  console.log(`OK: ${label}`);
}

function validate() {
  const { tituloEtapaProjetoPronto } = loadNormalizerForTests();

  assertEqual(
    tituloEtapaProjetoPronto(
      '#1641 CAIXA LINE ARRAY CORNETADA 2X 12" EROS E-612 MG PELEGO BOX PROJETOS 3D FEITO DO ZERO 005',
      "MEDIDAS",
      "1641"
    ),
    '#1641 Medidas Projeto Pronto Caixa Line Array Cornetada 2X 12" EROS E-612 MG 005',
    "#1641 / Botão 1"
  );

  assertEqual(
    tituloEtapaProjetoPronto(
      '#612 GABINETE ACÚSTICO PROFISSIONAL 1 X 18" EROS E-18 SDS 2.7K Projeto 006',
      "MEDIDAS",
      "612"
    ),
    '#612 Medidas Projeto Pronto Gabinete Acústico Profissional 1 X 18" EROS E-18 SDS 2.7K Projeto 006',
    "#612 / Botão 1"
  );

  assertEqual(
    tituloEtapaProjetoPronto(
      '#1641 CAIXA LINE ARRAY CORNETADA 2X 12" EROS E-612 MG PELEGO BOX PROJETOS 3D FEITO DO ZERO 005',
      "GRAFICOS",
      "1641"
    ),
    '#1641 Gráficos Projeto Pronto Caixa Line Array Cornetada 2X 12" EROS E-612 MG 005',
    "#1641 / Botão 2"
  );

  assertEqual(
    tituloEtapaProjetoPronto(
      '#1641 CAIXA LINE ARRAY CORNETADA 2X 12" EROS E-612 MG PELEGO BOX PROJETOS 3D FEITO DO ZERO 005',
      "PROJETO_COMPLETO",
      "1641"
    ),
    '#1641 Projeto Pronto Completo Caixa Line Array Cornetada 2X 12" EROS E-612 MG 005',
    "#1641 / Botão 3"
  );

  const page = read(PAGE);
  if (!page.includes("const codigoQuestionario =") ||
      !page.includes("Medidas Projeto Pronto") ||
      !page.includes("Gráficos Projeto Pronto") ||
      !page.includes("Projeto Pronto Completo")) {
    throw new Error("Checkout: validação estática das três etapas falhou.");
  }

  const notify = read(NOTIFY);
  for (const field of ["produto", "titulo", "tituloProjeto", "tituloCheckout", "tituloOriginal", "nomeProduto"]) {
    if (!notify.includes(`    ${field}: tituloEmailCorreto,`)) {
      throw new Error(`Make: alias canônico ausente: ${field}`);
    }
  }

  const state = read(STATE);
  const stateStart = state.indexOf("function patchEmailTitle() {");
  const stateEnd = state.indexOf("\nfunction patchInvoiceFunction", stateStart);
  const stateBlock = state.slice(stateStart, stateEnd);
  if (stateBlock.includes("code.replace") || stateBlock.includes("PROJECTS")) {
    throw new Error("Estado final ainda tenta reescrever a fonte do título do e-mail.");
  }

  console.log("\nTítulos de vendas: validação final aprovada.");
}

patchNormalizer();
patchCheckoutPage();
patchNotify();
patchStateScript();
patchGuardScript();
validate();
