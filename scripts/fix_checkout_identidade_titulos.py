from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    (ROOT / path).write_text(content.rstrip() + '\n', encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Trecho não encontrado: {label}')
    return text.replace(old, new, 1)


# ============================================================
# 1. CLIENTE REAL: SESSÃO DE PAGAMENTO NÃO PODE PULAR DADOS
# ============================================================
path = 'src/backend/clientes.web.js'
s = read(path)

if 'export const buscarClienteCadastrado' not in s:
    anchor = '''export const buscarCliente =
  webMethod(
    Permissions.Anyone,

    async (whatsapp) => {
      const cliente =
        await buscarClienteInterno(
          whatsapp
        );

      return clientePublico(
        cliente
      );
    }
  );
'''

    addition = anchor + '''

/*
  Consulta estrita usada SOMENTE para decidir se o checkout pode
  pular Nome/CPF/e-mail. Não consulta SessoesProjetosProntos2.
*/
export const buscarClienteCadastrado =
  webMethod(
    Permissions.Anyone,

    async (numero) => {
      const padrao =
        normalizarWhatsapp(
          numero
        );

      if (!padrao) {
        return null;
      }

      const completoSemMais =
        padrao.replace(/^\\+/, "");

      const nacional =
        completoSemMais.replace(/^55/, "");

      const variantes = [
        padrao,
        completoSemMais,
        nacional
      ];

      const encontrados = [];

      for (const variante of variantes) {
        try {
          const resultado =
            await wixData
              .query(COLLECTION)
              .eq(
                "whatsapp",
                variante
              )
              .limit(50)
              .find(DB_OPTS);

          encontrados.push(
            ...(resultado.items || [])
          );
        } catch (erro) {
          console.warn(
            "Falha ao consultar cliente cadastrado:",
            erro?.message || erro
          );
        }
      }

      encontrados.sort(
        (a, b) =>
          new Date(
            b?._updatedDate ||
            b?._createdDate ||
            0
          ).getTime() -
          new Date(
            a?._updatedDate ||
            a?._createdDate ||
            0
          ).getTime()
      );

      return clientePublico(
        encontrados[0] || null
      );
    }
  );
'''

    s = replace_once(
        s,
        anchor,
        addition,
        'buscarCliente em clientes.web.js'
    )

write(path, s)


# ============================================================
# 2. PÁGINA: SÓ CLIENTE CADASTRADO DE VERDADE AUTORIZA SKIP
# ============================================================
path = 'src/pages/checkout-projeto-pronto.i9aj1.js'
s = read(path)

s = s.replace(
    'import { criarCliente, buscarCliente } from "backend/clientes.web";',
    'import { criarCliente, buscarClienteCadastrado } from "backend/clientes.web";'
)

s = s.replace(
    'waitTimeout(buscarCliente(n), 3500, "")',
    'waitTimeout(buscarClienteCadastrado(n), 3500, "")'
)

if 'buscarCliente(n)' in s:
    raise SystemExit('A página ainda usa buscarCliente genérico para o skip.')

write(path, s)


# ============================================================
# 3. CUSTOM ELEMENT: NÃO PISCAR FORMULÁRIO VAZIO + TÍTULO VISUAL
# ============================================================
path = 'src/public/custom-elements/pelego-checkout-pronto.js'
s = read(path)

if 'body{padding:7px;visibility:hidden}' not in s:
    s = replace_once(
        s,
        'body{padding:7px}',
        'body{padding:7px;visibility:hidden}',
        'body inicial do checkout'
    )

helper = r'''
function stageDisplayTitle(value,type,projectCode){
 var original=decodeEntities(value);
 if(!original)return "Projeto Pronto";
 var qm=original.match(/\b(00[1-9]|01[0-4])\b\s*$/i);
 var q=qm?qm[1]:"";
 var cut=original.replace(/\s*\bPELEGO\s+BOX\b[\s\S]*$/i,"").replace(/\s+/g," ").trim();
 cut=prettyTitle(cut);
 var found=cut.match(/^\s*#?\s*(\d+)\s+(.*)$/);
 var code=found?found[1]:digits(projectCode);
 var body=found?found[2]:cut;
 body=body.replace(/^(?:Medidas\s+Projeto\s+Pronto|Gráficos\s+Projeto\s+Pronto|Graficos\s+Projeto\s+Pronto|Projeto\s+Pronto\s+Completo)\s+/i,"").trim();
 var normalized=safe(type).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[\s-]+/g,"_");
 var prefix=normalized==="GRAFICOS"?"Gráficos Projeto Pronto":normalized==="PROJETO_COMPLETO"?"Projeto Pronto Completo":"Medidas Projeto Pronto";
 return [code?"#"+code:"",prefix,body,q].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}
'''

if 'function stageDisplayTitle(' not in s:
    marker = 'function hydrate(ctx){'
    if marker not in s:
        raise SystemExit('hydrate não encontrado no Custom Element.')
    s = s.replace(marker, helper + '\n' + marker, 1)

s = s.replace(
    'E.title.textContent=prettyTitle(S.ctx.titulo||S.ctx.produto||S.ctx.name);',
    'E.title.textContent=stageDisplayTitle(S.ctx.titulo||S.ctx.produto||S.ctx.name,S.ctx.tipoProduto,S.ctx.codigoProjeto);'
)

old_init = 'if(type==="INIT"){S.checkoutId=safe(d.checkoutId);hydrate(d.ctx||{});setStep(1);if(d.skipIdentity===true){S.paymentReady=false;showPayment()}else{layoutMode("INITIAL")}return}'
new_init = 'if(type==="INIT"){S.checkoutId=safe(d.checkoutId);hydrate(d.ctx||{});document.body.style.visibility="visible";setStep(1);if(d.skipIdentity===true){S.paymentReady=false;showPayment()}else{layoutMode("INITIAL")}return}'

if old_init in s:
    s = s.replace(old_init, new_init, 1)
elif 'document.body.style.visibility="visible"' not in s:
    raise SystemExit('Handler INIT do Custom Element não encontrado.')

write(path, s)


# ============================================================
# 4. CARTÃO: PRODUTO/PREÇO/TÍTULO EXATOS NA VALIDAPAY
# ============================================================
path = 'src/backend/validaPayCartaoProjetosProntos.jsw'
s = read(path)

import_marker = 'import { getSecret } from "wix-secrets-backend";'
import_line = 'import { tituloEtapaProjetoPronto, normalizarTituloProduto, extrairCodigoQuestionarioTitulo } from "backend/projetosProntosNormalizacao";'

if import_line not in s:
    s = replace_once(
        s,
        import_marker,
        import_marker + '\n' + import_line,
        'import normalização cartão'
    )

s = s.replace(
    'const produto = decodeTitle(input.produto || ctx.produto || ctx.titulo || "Projeto Pronto");',
    'const produto = tituloEtapaProjetoPronto(input.produto || ctx.produto || ctx.titulo || "Projeto Pronto", tipoProduto, codigoProjeto);'
)

s = s.replace(
    'async function reusablePriceId({ codigoProjeto, tipoProduto, valor }) {',
    'async function reusablePriceId({ codigoProjeto, tipoProduto, produto, valor }) {'
)

s = s.replace(
    'safe(item?.validaPayPriceId) && Math.abs(Number(item?.valor || 0) - Number(valor || 0)) <= 0.01',
    'safe(item?.validaPayPriceId) && normalizarTituloProduto(item?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase() && Math.abs(Number(item?.valor || 0) - Number(valor || 0)) <= 0.01'
)

s = s.replace(
    'if (safe(current?.validaPayPriceId)) return safe(current.validaPayPriceId);',
    'if (safe(current?.validaPayPriceId) && normalizarTituloProduto(current?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase()) return safe(current.validaPayPriceId);'
)

s = s.replace(
    'const reused = await reusablePriceId({ codigoProjeto, tipoProduto, valor });',
    'const reused = await reusablePriceId({ codigoProjeto, tipoProduto, produto, valor });'
)

s = s.replace(
    'name: decodeTitle(produto),',
    'name: produto,'
)

s = s.replace(
    'description: `${label} - Pelego Box Projetos Prontos`,',
    'description: produto,'
)

s = s.replace(
    'title: label,\n      amount: valor,',
    'title: produto,\n      amount: valor,'
)

if 'codigoQuestionario: extrairCodigoQuestionarioTitulo(produto)' not in s:
    target = '''      codigoProjeto,
      tipoProduto
    },
    prices: [{'''
    repl = '''      codigoProjeto,
      tipoProduto,
      codigoQuestionario: extrairCodigoQuestionarioTitulo(produto)
    },
    prices: [{'''
    s = replace_once(
        s,
        target,
        repl,
        'metadata produto cartão'
    )

# stageLabel deixa de ser necessário porque o nome da própria etapa vira o título do produto/preço.
s = re.sub(
    r'\nfunction stageLabel\(tipoProduto\) \{.*?\n\}\n',
    '\n',
    s,
    count=1,
    flags=re.S
)
s = s.replace('  const label = stageLabel(tipoProduto);\n', '')

write(path, s)


# ============================================================
# 5. PIX: MESMO TÍTULO CANÔNICO E ITEM DE PRODUTO NA VALIDAPAY
# ============================================================
path = 'src/backend/validaPayPixProjetosProntosCore.jsw'
s = read(path)

if import_line not in s:
    s = replace_once(
        s,
        import_marker,
        import_marker + '\n' + import_line,
        'import normalização Pix'
    )

s = s.replace(
    'const isWrite = scope === "checkouts/write";',
    'const isWrite = scope.includes("write");'
)

s = s.replace(
    'const scope = method.toLowerCase() === "post" ? "checkouts/write" : "pix.cob/read";',
    'const scope = method.toLowerCase() === "post" ? "checkouts/write products/write checkouts/read" : "pix.cob/read";'
)

s = s.replace(
    'const produto = decodeTitle(first(input.produto, ctx.produto, ctx.titulo, "Projeto Pronto"));',
    'const produto = tituloEtapaProjetoPronto(first(input.produto, ctx.produto, ctx.titulo, "Projeto Pronto"), tipoProduto, codigoProjeto);'
)

if 'async function ensurePriceId({' not in s:
    anchor = '''async function saveSession(checkoutId, patch, known = undefined) {
  const existing = known === undefined ? await findSession(checkoutId) : known;
  const item = { ...(existing || {}), ...(patch || {}), checkoutId: safe(checkoutId) };
  const whatsapp = normalizePhone(item.whatsapp || item.whatsappE164 || item.whatsApp);
  if (whatsapp) item.whatsapp = whatsapp;
  delete item.whatsApp;
  delete item.whatsappE164;
  delete item.sku;
  delete item.codigoCheckout;
  if (item.produto) item.produto = decodeTitle(item.produto);
  return existing ? wixData.update(SESSIONS, item, DB) : wixData.insert(SESSIONS, item, DB);
}
'''

    helpers = '''
async function reusablePriceId({ codigoProjeto, tipoProduto, produto, valor }) {
  try {
    const result = await wixData
      .query(SESSIONS)
      .eq("codigoProjeto", safe(codigoProjeto))
      .eq("tipoProduto", safe(tipoProduto))
      .descending("_updatedDate")
      .limit(100)
      .find(DB);

    const found = (result.items || []).find(item =>
      safe(item?.validaPayPriceId) &&
      normalizarTituloProduto(item?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase() &&
      Math.abs(Number(item?.valor || 0) - Number(valor || 0)) <= 0.01
    );

    return safe(found?.validaPayPriceId);
  } catch (error) {
    console.warn("Não foi possível reutilizar priceId ValidaPay no Pix:", error?.message || error);
    return "";
  }
}

async function ensurePriceId({ checkoutId, codigoProjeto, tipoProduto, produto, valor }) {
  const current = await findSession(checkoutId);

  if (
    safe(current?.validaPayPriceId) &&
    normalizarTituloProduto(current?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase()
  ) {
    return safe(current.validaPayPriceId);
  }

  const reused = await reusablePriceId({ codigoProjeto, tipoProduto, produto, valor });

  if (reused) {
    await saveSession(checkoutId, { validaPayPriceId: reused, updatedAtDate: new Date() });
    return reused;
  }

  const response = await requestValidaPay("/v1/products", "post", {
    name: produto,
    description: produto,
    type: "ONE_TIME",
    statementDescriptor: "PELEGO BOX",
    isActive: true,
    metadata: {
      origem: "PELEGO_BOX_PROJETOS_PRONTOS",
      codigoProjeto,
      tipoProduto,
      codigoQuestionario: extrairCodigoQuestionarioTitulo(produto)
    },
    prices: [{
      title: produto,
      amount: valor,
      currency: "BRL",
      recurrenceType: "ONE_TIME",
      recurrenceInterval: 1
    }]
  });

  if (!response.ok) {
    console.warn("Produto ValidaPay não pôde ser criado para o Pix:", response.error);
    return "";
  }

  const priceId = safe(response.data?.prices?.[0]?.priceId);

  if (priceId) {
    await saveSession(checkoutId, { validaPayPriceId: priceId, updatedAtDate: new Date() });
  }

  return priceId;
}
'''

    s = replace_once(
        s,
        anchor,
        anchor + helpers,
        'helpers priceId Pix'
    )

old_body = '''    const body = {
      paymentMethod: "pix",
      externalId: checkoutId,
      externalTxid: externalTxid(checkoutId, codigoProjeto, tipoProduto, valor),
      customer: { name: nome, email, phone: whatsapp, documentNumber: cpfCnpj },
      amount: valor,
      metadata: {'''

new_body = '''    const priceId = await ensurePriceId({
      checkoutId,
      codigoProjeto,
      tipoProduto,
      produto,
      valor
    });

    if (!priceId) {
      return {
        ok: false,
        checkoutId,
        error: "Não foi possível vincular o produto à cobrança ValidaPay. Nenhuma cobrança foi criada."
      };
    }

    const body = {
      paymentMethod: "pix",
      externalId: checkoutId,
      externalTxid: externalTxid(checkoutId, codigoProjeto, tipoProduto, valor),
      customer: { name: nome, email, phone: whatsapp, documentNumber: cpfCnpj },
      items: [{ priceId, quantity: 1 }],
      metadata: {'''

if old_body in s:
    s = s.replace(old_body, new_body, 1)
elif 'items: [{ priceId, quantity: 1 }]' not in s:
    raise SystemExit('Body Pix esperado não encontrado.')

write(path, s)


# ============================================================
# 6. ENTREGA: LIMPAR PELEGO BOX SEM PERDER 001–014
# ============================================================
path = 'src/backend/entregaProjetosProntos.jsw'
s = read(path)

s = s.replace(
    'import { normalizarWhatsappBrasil } from "backend/projetosProntosNormalizacao";',
    'import { normalizarWhatsappBrasil, normalizarTituloProduto } from "backend/projetosProntosNormalizacao";'
)

old_clean = '''function cleanProjectTitle(value) {
  return decodeTitle(value)
    .split(/\\bPELEGO(?:\\s*BOX)?\\b/i)[0]
    .replace(/\\s+/g, " ")
    .trim();
}'''

new_clean = '''function cleanProjectTitle(value) {
  return normalizarTituloProduto(
    value
  );
}'''

if old_clean in s:
    s = s.replace(old_clean, new_clean, 1)

s = s.replace(
    'const real = decodeTitle(project?.titulo_video || session?.produto);',
    'const real = normalizarTituloProduto(project?.titulo_video || session?.produto);'
)

write(path, s)


# ============================================================
# 7. TRAVAS
# ============================================================
assert 'buscarClienteCadastrado' in read('src/pages/checkout-projeto-pronto.i9aj1.js')
assert 'buscarClienteCadastrado' in read('src/backend/clientes.web.js')
assert 'body{padding:7px;visibility:hidden}' in read('src/public/custom-elements/pelego-checkout-pronto.js')
assert 'document.body.style.visibility="visible"' in read('src/public/custom-elements/pelego-checkout-pronto.js')
assert 'stageDisplayTitle' in read('src/public/custom-elements/pelego-checkout-pronto.js')
assert 'tituloEtapaProjetoPronto' in read('src/backend/validaPayCartaoProjetosProntos.jsw')
assert 'items = [{ priceId, quantity: 1 }]' in read('src/backend/validaPayCartaoProjetosProntos.jsw')
assert 'tituloEtapaProjetoPronto' in read('src/backend/validaPayPixProjetosProntosCore.jsw')
assert 'items: [{ priceId, quantity: 1 }]' in read('src/backend/validaPayPixProjetosProntosCore.jsw')
assert 'normalizarTituloProduto(project?.titulo_video' in read('src/backend/entregaProjetosProntos.jsw')

print('FIX_CHECKOUT_OK')
