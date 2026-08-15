const fs = require('fs');

const file = 'src/backend/clientes.web.js';
let src = fs.readFileSync(file, 'utf8');

const MARKER = 'LOGIN_MEMBRO_BUSCA_COMPRAS_V1';
if (src.includes(MARKER)) {
  console.log('Hotfix já aplicado.');
  process.exit(0);
}

const sessionsConst = 'const SESSIONS_COLLECTION = "SessoesProjetosProntos2";';
if (!src.includes(sessionsConst)) {
  throw new Error('Constante SESSIONS_COLLECTION não encontrada.');
}
src = src.replace(
  sessionsConst,
  `${sessionsConst}\nconst PURCHASES_COLLECTION = "ComprasProjetos";`
);

const insertBefore = '// CLIENTE_RECORRENTE_COMPRA_ANTERIOR_V3';
if (!src.includes(insertBefore)) {
  throw new Error('Ponto de inserção do fallback de compras não encontrado.');
}

const helper = `// LOGIN_MEMBRO_BUSCA_COMPRAS_V1\n// A conta Wix autenticada é a âncora. Se o cadastro em Campo estiver\n// incompleto, recupera Nome/WhatsApp/CPF diretamente de ComprasProjetos\n// usando SOMENTE o mesmo e-mail autenticado. Assim limpar histórico ou\n// trocar de celular nunca obriga cliente recorrente a preencher tudo de novo.\nasync function completarClientePorCompraDoMembro(\n  cliente,\n  memberEmail,\n  memberName\n) {\n  const emailMembro = limparEmail(memberEmail);\n  const atual = cliente ? { ...cliente } : null;\n\n  const documentoAtual = limparCpfCnpj(atual?.cpfCnpj);\n  if (\n    atual &&\n    safe(atual.whatsapp) &&\n    limparNome(atual.nome).length >= 3 &&\n    (documentoAtual.length === 11 || documentoAtual.length === 14)\n  ) {\n    atual.email = emailMembro;\n    return atual;\n  }\n\n  const encontrados = [];\n  for (const campo of [\"email\", \"Email\"]) {\n    try {\n      const resultado = await wixData\n        .query(PURCHASES_COLLECTION)\n        .eq(campo, emailMembro)\n        .limit(50)\n        .find(DB_OPTS);\n      encontrados.push(...(resultado.items || []));\n    } catch (_) {}\n  }\n\n  const unicos = Array.from(\n    new Map(\n      encontrados\n        .filter(Boolean)\n        .map((item) => [safe(item?._id), item])\n    ).values()\n  ).filter((item) => safe(item?._id));\n\n  const pontuar = (item) => {\n    let pontos = 0;\n    const emailCompra = limparEmail(item?.email || item?.Email);\n    const documento = limparCpfCnpj(\n      item?.cpfCnpj || item?.cpf || item?.cpfcnpj || item?.Cpfcnpj || item?.[\"CPF/CNPJ\"]\n    );\n    const whatsapp = normalizarWhatsapp(\n      item?.whatsappE164 || item?.whatsapp || item?.whatsApp || item?.Whatsapp || item?.WhatsApp\n    );\n    const nome = limparNome(\n      item?.nomeCliente || item?.nome || item?.Nomecliente || item?.title || item?.Title\n    );\n    const clienteId = safe(item?.clienteId || item?.clienteID || item?.[\"Cliente ID\"]);\n    const status = safe(item?.statusCompra || item?.pagamento).toLowerCase();\n\n    if (emailCompra === emailMembro) pontos += 100;\n    if (documento.length === 11 || documento.length === 14) pontos += 50;\n    if (whatsapp) pontos += 30;\n    if (nome.length >= 3) pontos += 20;\n    if (clienteId) pontos += 10;\n    if ([\"approved\", \"paid\", \"aprovado\", \"aprovada\", \"pago\", \"paga\"].includes(status)) pontos += 10;\n    return pontos;\n  };\n\n  const compra = [...unicos]\n    .sort((a, b) => {\n      const diferenca = pontuar(b) - pontuar(a);\n      if (diferenca) return diferenca;\n      return (\n        new Date(b?.dataCompra || b?._updatedDate || b?._createdDate || 0).getTime() -\n        new Date(a?.dataCompra || a?._updatedDate || a?._createdDate || 0).getTime()\n      );\n    })[0] || null;\n\n  if (!compra) {\n    if (atual) atual.email = emailMembro;\n    return atual;\n  }\n\n  const whatsappCompra = normalizarWhatsapp(\n    compra?.whatsappE164 || compra?.whatsapp || compra?.whatsApp || compra?.Whatsapp || compra?.WhatsApp\n  );\n  const cpfCompra = limparCpfCnpj(\n    compra?.cpfCnpj || compra?.cpf || compra?.cpfcnpj || compra?.Cpfcnpj || compra?.[\"CPF/CNPJ\"]\n  );\n  const nomeCompra = limparNome(\n    compra?.nomeCliente || compra?.nome || compra?.Nomecliente || compra?.title || compra?.Title\n  );\n  const clienteIdCompra = safe(\n    compra?.clienteId || compra?.clienteID || compra?.[\"Cliente ID\"]\n  );\n\n  const final = atual || {\n    _id: clienteIdCompra,\n    clienteId: clienteIdCompra,\n    nome: \"\",\n    whatsapp: \"\",\n    whatsappE164: \"\",\n    whatsappNacional: \"\",\n    email: emailMembro,\n    cpfCnpj: \"\",\n    status: \"\",\n    ativo: true\n  };\n\n  final._id = safe(final._id) || clienteIdCompra;\n  final.clienteId = safe(final.clienteId) || clienteIdCompra || safe(final._id);\n  final.nome = limparNome(final.nome) || nomeCompra || limparNome(memberName);\n  final.whatsapp = normalizarWhatsapp(final.whatsapp) || whatsappCompra;\n  final.whatsappE164 = final.whatsapp;\n  final.whatsappNacional = whatsappNacional(final.whatsapp);\n  final.email = emailMembro;\n  final.cpfCnpj = limparCpfCnpj(final.cpfCnpj) || cpfCompra;\n\n  return final;\n}\n\n\n`;

src = src.replace(insertBefore, helper + insertBefore);

const oldBlock = `      const clienteResolvido =\n        await completarClientePorSessaoDoMembro(\n          clientePublico(\n            clienteCanonico\n          ),\n          memberEmail,\n          memberName\n        );`;

if (!src.includes(oldBlock)) {
  throw new Error('Bloco clienteResolvido não encontrado.');
}

const newBlock = `      const clientePorCompra =\n        await completarClientePorCompraDoMembro(\n          clientePublico(\n            clienteCanonico\n          ),\n          memberEmail,\n          memberName\n        );\n\n      const clienteResolvido =\n        await completarClientePorSessaoDoMembro(\n          clientePorCompra,\n          memberEmail,\n          memberName\n        );`;

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(file, src);
console.log('Hotfix aplicado: membro logado reaproveita dados de ComprasProjetos.');
