const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const CLIENTES = "src/backend/clientes.web.js";

function fail(message) {
  throw new Error(message);
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) fail(`${label}: trecho não encontrado.`);
  return text.replace(from, to);
}

function replaceSection(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) fail(`${label}: início não encontrado.`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) fail(`${label}: fim não encontrado.`);
  return text.slice(0, start) + replacement + text.slice(end);
}

function patchClientes() {
  let code = fs.readFileSync(CLIENTES, "utf8");

  if (!code.includes('from "wix-members-backend"')) {
    code = replaceOnce(
      code,
      'import wixData from "wix-data";\n',
      'import wixData from "wix-data";\nimport { currentMember as currentMemberBackend } from "wix-members-backend";\n',
      "Import do membro Wix no backend"
    );
  }

  if (!code.includes("export const buscarClienteDoMembroAtual")) {
    const anchor = `\n\n/*\n  Consulta estrita usada SOMENTE para decidir se o checkout pode\n  pular Nome/CPF/e-mail. Não consulta SessoesProjetosProntos2.\n*/`;

    const method = `\n\n// ======================================================\n// BUSCAR CLIENTE PELO MEMBRO WIX AUTENTICADO\n// ======================================================\n\nexport const buscarClienteDoMembroAtual =\n  webMethod(\n    Permissions.SiteMember,\n\n    async () => {\n      const membro =\n        await currentMemberBackend.getMember();\n\n      const memberId =\n        safe(membro?._id);\n\n      const emailsContato =\n        Array.isArray(\n          membro?.contactDetails?.emails\n        )\n          ? membro.contactDetails.emails\n          : [];\n\n      const memberEmail =\n        limparEmail(\n          membro?.loginEmail ||\n          emailsContato[0] ||\n          membro?.contactDetails?.email\n        );\n\n      const memberName =\n        limparNome(\n          membro?.profile?.nickname ||\n          [\n            membro?.contactDetails?.firstName,\n            membro?.contactDetails?.lastName\n          ]\n            .filter(Boolean)\n            .join(" ")\n        );\n\n      if (!memberId || !memberEmail) {\n        return {\n          memberId,\n          email: memberEmail,\n          nome: memberName,\n          cliente: null,\n          ambiguo: false\n        };\n      }\n\n      const encontrados = [];\n\n      for (const campo of ["email", "Email"]) {\n        try {\n          const resultado =\n            await wixData\n              .query(COLLECTION)\n              .eq(campo, memberEmail)\n              .limit(20)\n              .find(DB_OPTS);\n\n          encontrados.push(\n            ...(resultado.items || [])\n          );\n        } catch (_) {}\n      }\n\n      const unicos =\n        Array.from(\n          new Map(\n            encontrados\n              .filter(Boolean)\n              .map((item) => [safe(item?._id), item])\n          ).values()\n        ).filter((item) => safe(item?._id));\n\n      return {\n        memberId,\n        email: memberEmail,\n        nome: memberName,\n        cliente:\n          unicos.length === 1\n            ? clientePublico(unicos[0])\n            : null,\n        ambiguo:\n          unicos.length > 1\n      };\n    }\n  );`;

    if (!code.includes(anchor)) fail("Âncora do buscarClienteCadastrado não encontrada.");
    code = code.replace(anchor, method + anchor);
  }

  fs.writeFileSync(CLIENTES, code);
}

function patchPage() {
  let code = fs.readFileSync(PAGE, "utf8");

  if (!code.includes('from "wix-members-frontend"')) {
    code = replaceOnce(
      code,
      'import wixWindowFrontend from "wix-window-frontend";\n',
      'import wixWindowFrontend from "wix-window-frontend";\nimport { authentication, currentMember } from "wix-members-frontend";\n',
      "Import do membro Wix na página"
    );
  }

  code = replaceOnce(
    code,
    'import {\n  buscarCliente\n} from "backend/clientes.web";',
    'import {\n  buscarCliente,\n  buscarClienteDoMembroAtual\n} from "backend/clientes.web";',
    "Import do resolver social"
  );

  if (!code.includes("async function identificarMembroSocial()")) {
    const anchor = "async function identificarCliente(\n  data = {}\n) {";
    if (!code.includes(anchor)) fail("Âncora de identificarCliente não encontrada.");

    const helper = `async function identificarMembroSocial() {\n  cancelarPopupAgendado();\n\n  consultaConcluida =\n    false;\n\n  const perfil =\n    await comTimeout(\n      buscarClienteDoMembroAtual(),\n      7000,\n      "A identificação do membro Wix não respondeu."\n    );\n\n  const memberId =\n    safe(perfil?.memberId);\n\n  const memberEmail =\n    normalizeEmail(\n      perfil?.email\n    );\n\n  if (!memberId || !memberEmail) {\n    identificado = false;\n    bloquearSemIdentificacao();\n    throw new Error(\n      "Não foi possível identificar o membro Wix autenticado."\n    );\n  }\n\n  const cliente =\n    perfil?.cliente &&\n    typeof perfil.cliente === "object"\n      ? perfil.cliente\n      : null;\n\n  const telefone =\n    cliente\n      ? normalizarTelefone({\n          whatsapp:\n            cliente.whatsappNacional ||\n            cliente.whatsapp,\n          whatsappE164:\n            cliente.whatsappE164 ||\n            cliente.whatsapp,\n          ddi: "55",\n          country: "br"\n        })\n      : {\n          whatsapp: "",\n          whatsappE164: "",\n          ddi: "55",\n          country: "br"\n        };\n\n  identificacao = {\n    whatsapp:\n      telefone.whatsapp,\n    whatsappE164:\n      telefone.whatsappE164,\n    ddi:\n      telefone.ddi || "55",\n    country:\n      telefone.country || "br",\n    countryName:\n      "Brasil",\n    clienteId:\n      cliente\n        ? firstValue(\n            cliente._id,\n            cliente.clienteId\n          )\n        : "",\n    nome:\n      firstValue(\n        cliente?.nome,\n        perfil?.nome\n      ),\n    email:\n      normalizeEmail(\n        firstValue(\n          cliente?.email,\n          memberEmail\n        )\n      ),\n    cpfCnpj:\n      onlyDigits(\n        cliente?.cpfCnpj ||\n        cliente?.cpf ||\n        ""\n      ),\n    /*\n      Compatibilidade com o checkout atual: quando o cliente foi\n      localizado por e-mail autenticado do Wix, a identidade já foi\n      confirmada pelo login social. O WhatsApp abaixo vem do cadastro\n      existente, não de um número digitado por um visitante anônimo.\n    */\n    whatsappConfirmado:\n      Boolean(\n        cliente &&\n        telefone.whatsapp\n      ),\n    confirmacaoWhatsappVersao:\n      cliente && telefone.whatsapp\n        ? CONFIRMACAO_FLUXO_VERSAO\n        : 0,\n    confirmadoEm:\n      cliente && telefone.whatsapp\n        ? new Date().toISOString()\n        : ""\n  };\n\n  clienteAtual =\n    cliente;\n\n  identificado =\n    true;\n\n  acessos = {\n    medidas: false,\n    graficos: false,\n    projeto: false\n  };\n\n  downloads = {\n    medidas: "",\n    graficos: "",\n    projeto: ""\n  };\n\n  if (\n    clienteAtual &&\n    identificacao.clienteId\n  ) {\n    try {\n      const resultado =\n        await comTimeout(\n          obterAcessosProjeto({\n            codigoProjeto:\n              codigoPublico(\n                projeto\n              ),\n            clienteId:\n              identificacao.clienteId,\n            email:\n              identificacao.email,\n            whatsapp:\n              onlyDigits(\n                identificacao.whatsappE164\n              )\n          }),\n          7000,\n          "A consulta das compras não respondeu."\n        );\n\n      if (\n        resultado?.ok &&\n        resultado?.access\n      ) {\n        acessos = {\n          medidas:\n            resultado.access.medidas === true,\n          graficos:\n            resultado.access.graficos === true,\n          projeto:\n            resultado.access.projeto === true\n        };\n\n        capturarDownloads(\n          resultado\n        );\n\n        salvarAcessosLocais(\n          codigoPublico(projeto),\n          acessos\n        );\n      }\n    } catch (error) {\n      console.error(\n        "Falha ao carregar acessos pelo membro Wix:",\n        error?.message || error\n      );\n    }\n  }\n\n  consultaConcluida =\n    true;\n\n  salvarIdentificacao();\n\n  await mostrarValoresEAcessos();\n}\n\n`;

    code = code.replace(anchor, helper + anchor);
  }

  const popupStart = "async function abrirPopupWhatsapp() {";
  const popupEnd = "\n\n\nfunction salvarAutorizacaoCheckout(";
  const socialPopup = `async function abrirPopupWhatsapp() {\n  if (\n    popupAberto ||\n    !projeto\n  ) {\n    return;\n  }\n\n  cancelarPopupAgendado();\n\n  popupAberto =\n    true;\n\n  try {\n    const membro =\n      await currentMember.getMember();\n\n    if (!membro?._id) {\n      await authentication\n        .promptLogin({\n          mode: "login",\n          modal: true\n        });\n    }\n\n    await identificarMembroSocial();\n\n  } catch (error) {\n    console.error(\n      "Erro no login social:",\n      error?.message || error\n    );\n\n    bloquearSemIdentificacao();\n  } finally {\n    popupAberto =\n      false;\n  }\n}\n`;

  if (!code.includes('"Erro no login social:"')) {
    code = replaceSection(
      code,
      popupStart,
      popupEnd,
      socialPopup,
      "Substituição do Pega Zap"
    );
  }

  const inicioIdentificacaoAntiga = "  const salva =\n    lerIdentificacaoSalva();";
  const fimIniciarPagina = "\n}\n\n\n// ======================================================\n// ON READY";

  if (code.includes(inicioIdentificacaoAntiga)) {
    const start = code.indexOf(inicioIdentificacaoAntiga);
    const end = code.indexOf(fimIniciarPagina, start);
    if (end < 0) fail("Fim de iniciarPagina não encontrado.");
    code =
      code.slice(0, start) +
      "  await identificarMembroSocial();\n" +
      code.slice(end);
  }

  if (!code.includes("function iniciarComLoginSocial()")) {
    const onReadyAnchor = `// ======================================================\n// ON READY\n// ======================================================\n`;
    if (!code.includes(onReadyAnchor)) fail("Âncora do onReady não encontrada.");

    const gate = `function iniciarPaginaComTratamento() {\n  iniciarPagina()\n    .catch(\n      (error) => {\n        console.error(\n          "Erro ao iniciar página:",\n          error?.message ||\n          error,\n          error\n        );\n      }\n    );\n}\n\nfunction solicitarLoginSocial() {\n  authentication\n    .promptLogin({\n      mode: "login",\n      modal: true\n    })\n    .then(\n      () => {\n        iniciarPaginaComTratamento();\n      }\n    )\n    .catch(\n      () => {\n        wixLocation.to("/");\n      }\n    );\n}\n\nfunction iniciarComLoginSocial() {\n  currentMember\n    .getMember()\n    .then(\n      (membro) => {\n        if (membro?._id) {\n          iniciarPaginaComTratamento();\n          return;\n        }\n\n        solicitarLoginSocial();\n      }\n    )\n    .catch(\n      () => {\n        solicitarLoginSocial();\n      }\n    );\n}\n\n\n`;

    code = code.replace(onReadyAnchor, gate + onReadyAnchor);
  }

  const oldOnReady = `    iniciarPagina()\n      .catch(\n        (\n          error\n        ) => {\n          console.error(\n            "Erro ao iniciar página:",\n            error?.message ||\n            error,\n            error\n          );\n        }\n      );`;

  if (code.includes(oldOnReady)) {
    code = code.replace(
      oldOnReady,
      "    iniciarComLoginSocial();"
    );
  }

  fs.writeFileSync(PAGE, code);
}

patchClientes();
patchPage();
console.log("Login social aplicado em /checkoutprojetosprontos; Pega Zap removido do caminho ativo.");
