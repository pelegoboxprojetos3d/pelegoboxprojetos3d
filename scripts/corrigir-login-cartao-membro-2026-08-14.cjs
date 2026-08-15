const fs = require("fs");

const PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";
const CARD = "src/backend/validaPayCartaoProjetosProntos.jsw";
const AUTH = "src/backend/validaPayCartaoAuth.web.js";

function patch(path, fn) {
  const before = fs.readFileSync(path, "utf8");
  const after = fn(before);
  if (after === before) {
    console.log(`Sem alterações: ${path}`);
    return;
  }
  fs.writeFileSync(path, after, "utf8");
  console.log(`Atualizado: ${path}`);
}

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

const authModule = `import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";

const SESSIONS = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };

const safe = value => String(value ?? "").trim();
const email = value => safe(value).toLowerCase();

async function identidadeDoMembro() {
  const membro = await currentMemberBackend.getMember();
  const emails = Array.isArray(membro?.contactDetails?.emails)
    ? membro.contactDetails.emails
    : [];

  return {
    memberId: safe(membro?._id),
    email: email(
      membro?.loginEmail ||
      emails[0] ||
      membro?.contactDetails?.email
    )
  };
}

async function gravarAutorizacao(checkoutId, identidade) {
  const resultado = await wixData
    .query(SESSIONS)
    .eq("checkoutId", checkoutId)
    .limit(1)
    .find({ ...DB, consistentRead: true });

  const now = new Date();

  if (resultado.items.length) {
    const sessao = {
      ...resultado.items[0],
      memberId: identidade.memberId,
      email: identidade.email,
      updatedAtDate: now
    };

    delete sessao.whatsApp;
    delete sessao.whatsappE164;

    await wixData.update(SESSIONS, sessao, DB);
    return;
  }

  await wixData.insert(
    SESSIONS,
    {
      checkoutId,
      memberId: identidade.memberId,
      email: identidade.email,
      status: "pending_auth",
      updatedAtDate: now
    },
    DB
  );
}

export const autorizarPagamentoCartao = webMethod(
  Permissions.SiteMember,
  async (input = {}) => {
    try {
      const checkoutId = safe(input.checkoutId);
      if (!checkoutId) {
        return { ok: false, error: "Checkout inválido. Atualize a página e tente novamente." };
      }

      const identidade = await identidadeDoMembro();
      if (!identidade.memberId || !identidade.email) {
        return { ok: false, error: "Faça login novamente para pagar com cartão." };
      }

      await gravarAutorizacao(checkoutId, identidade);

      return {
        ok: true,
        memberId: identidade.memberId,
        email: identidade.email
      };
    } catch (error) {
      console.error("AUTORIZACAO CARTAO:", error?.message || error);
      return {
        ok: false,
        error: "Não foi possível confirmar sua conta Wix para o pagamento."
      };
    }
  }
);
`;

fs.writeFileSync(AUTH, authModule, "utf8");
console.log(`Criado/atualizado: ${AUTH}`);

patch(PAGE, code => {
  code = replaceOnce(
    code,
    'import { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";\n',
    'import { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";\nimport { autorizarPagamentoCartao } from "backend/validaPayCartaoAuth.web";\n',
    "Import da autorização do cartão"
  );

  code = replaceOnce(
    code,
    '  try {\n    const r=await waitTimeout(criarCobrancaCartaoTransparente({\n',
    '  try {\n    const auth=await waitTimeout(autorizarPagamentoCartao({checkoutId}),7000,"Não foi possível confirmar sua conta Wix.");\n    if(!auth?.ok){\n      return post({type:"CARD_RESULT",ok:false,approved:false,accepted:false,error:safe(auth?.error)||"Faça login novamente para pagar com cartão."});\n    }\n    if(auth?.email){ctx.email=email(auth.email);saveIdentity({email:ctx.email});}\n\n    const r=await waitTimeout(criarCobrancaCartaoTransparente({\n',
    "Autorização SiteMember antes da cobrança"
  );

  return code;
});

patch(CARD, code => {
  const oldIdentity = `async function identidadeMembroAtualCartao() {\n  const membro = await currentMemberBackend.getMember();\n  const emails = Array.isArray(membro?.contactDetails?.emails) ? membro.contactDetails.emails : [];\n  const memberId = safe(membro?._id);\n  const email = safe(membro?.loginEmail || emails[0] || membro?.contactDetails?.email).toLowerCase();\n  return { memberId, email };\n}\n`;

  const newIdentity = `async function identidadeMembroAtualCartao(checkoutId = "") {\n  try {\n    const membro = await currentMemberBackend.getMember();\n    const emails = Array.isArray(membro?.contactDetails?.emails) ? membro.contactDetails.emails : [];\n    const memberId = safe(membro?._id);\n    const email = safe(membro?.loginEmail || emails[0] || membro?.contactDetails?.email).toLowerCase();\n    if (memberId && email) return { memberId, email };\n  } catch (_) {}\n\n  const id = safe(checkoutId);\n  if (!id) return { memberId: "", email: "" };\n\n  try {\n    const sessao = await findSession(id);\n    const memberId = safe(sessao?.memberId);\n    const email = safe(sessao?.email).toLowerCase();\n    const timestamp = new Date(sessao?.updatedAtDate || sessao?._updatedDate || 0).getTime();\n    const age = Date.now() - timestamp;\n    const autorizacaoRecente = Number.isFinite(age) && age >= 0 && age <= 2 * 60 * 1000;\n\n    if (memberId && email && autorizacaoRecente) {\n      return { memberId, email };\n    }\n  } catch (_) {}\n\n  return { memberId: "", email: "" };\n}\n`;

  code = replaceOnce(code, oldIdentity, newIdentity, "Fallback seguro da identidade do cartão");

  code = replaceOnce(
    code,
    '    const identidadeMembro = await identidadeMembroAtualCartao();\n',
    '    const identidadeMembro = await identidadeMembroAtualCartao(checkoutId);\n',
    "Identidade vinculada ao checkout autorizado"
  );

  return code;
});
