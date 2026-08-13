const fs = require("fs");

const FILE = "src/backend/entregaProjetosProntos.jsw";

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) {
    throw new Error(`${label}: trecho original não encontrado.`);
  }
  return code.replace(from, to);
}

function replaceFunction(code, signature, nextSignature, replacement, label) {
  const start = code.indexOf(signature);
  const end = code.indexOf(nextSignature, start);
  if (start < 0 || end < 0) {
    throw new Error(`${label}: limites da função não encontrados.`);
  }
  return code.slice(0, start) + replacement + "\n\n" + code.slice(end);
}

let code = fs.readFileSync(FILE, "utf8");

// 1) O membro atual precisa vir com os dados completos, inclusive loginEmail.
code = replaceOnce(
  code,
  "    membro = await currentMember.getMember();",
  "    membro = await currentMember.getMember({ fieldsets: [\"FULL\"] });",
  "CurrentMember FULL"
);

// 2) O e-mail REAL de login fica explícito e tem prioridade sobre cadastros duplicados.
code = replaceOnce(
  code,
  `    email: firstValue(\n      payloadCliente.email,\n      normalizeEmail(sessao?.email),\n      normalizeEmail(sessao?.Email),\n      email\n    ),`,
  `    loginEmail: email,\n    email: firstValue(\n      email,\n      payloadCliente.email,\n      normalizeEmail(sessao?.email),\n      normalizeEmail(sessao?.Email)\n    ),`,
  "Prioridade do e-mail de login"
);

// 3) Central do membro: autorização exclusivamente pelo e-mail da conta logada.
const queryByIdentity = `async function queryPurchasesByIdentity(identity = {}) {
  const loginEmail = normalizeEmail(
    identity?.loginEmail || identity?.email
  );

  if (!loginEmail) {
    return [];
  }

  const found = new Map();

  for (const field of ["email", "Email"]) {
    try {
      const result = await wixData
        .query(PURCHASES_COLLECTION)
        .eq(field, loginEmail)
        .limit(1000)
        .find(READ_OPTS);

      for (const item of result.items || []) {
        if (purchaseEmail(item) !== loginEmail) continue;
        const id = safe(item?._id);
        if (id) found.set(id, item);
      }
    } catch (error) {
      console.warn(
        \`Busca de compras do membro por e-mail em \${field} falhou:\`,
        error?.message || error
      );
    }
  }

  if (!found.size) {
    try {
      let result = await wixData
        .query(PURCHASES_COLLECTION)
        .limit(1000)
        .find(READ_OPTS);

      while (result) {
        for (const item of result.items || []) {
          if (purchaseEmail(item) === loginEmail) {
            const id = safe(item?._id);
            if (id) found.set(id, item);
          }
        }

        if (
          typeof result.hasNext !== "function" ||
          !result.hasNext()
        ) {
          break;
        }

        result = await result.next();
      }
    } catch (error) {
      console.warn(
        "Varredura por e-mail das compras do membro falhou:",
        error?.message || error
      );
    }
  }

  return [...found.values()];
}`;

code = replaceFunction(
  code,
  "async function queryPurchasesByIdentity(identity = {}) {",
  "function acessoDescricao(access = {}) {",
  queryByIdentity,
  "Consulta de compras do membro"
);

// 4) Segunda via também usa exclusivamente o e-mail autenticado.
code = replaceOnce(
  code,
  `  const purchases = allPurchases\n    .filter(approvedPurchase)\n    .filter((purchase) =>\n      purchaseMatchesIdentity(purchase, identity)\n    );`,
  `  const loginEmail = normalizeEmail(\n    identity?.loginEmail || identity?.email\n  );\n\n  const purchases = allPurchases\n    .filter(approvedPurchase)\n    .filter((purchase) =>\n      Boolean(\n        loginEmail &&\n        purchaseEmail(purchase) === loginEmail\n      )\n    );`,
  "Segunda via autenticada por e-mail"
);

// 5) Depois que a compra foi autenticada pelo e-mail, os dados visuais vêm da própria compra.
code = replaceOnce(
  code,
  `  const client = {\n    ...clientPayload(identity.cliente),\n    clienteId: firstValue(\n      identity.clienteId,\n      identity.cliente?._id\n    ),\n    nome: identity.nome,\n    email: identity.email,\n    whatsapp: identity.whatsapp\n  };`,
  `  const compraMaisRecente = newestFirst(purchases)[0] || {};\n\n  const client = {\n    ...clientPayload(identity.cliente),\n    clienteId: firstValue(\n      purchaseClientId(compraMaisRecente),\n      identity.clienteId,\n      identity.cliente?._id\n    ),\n    nome: firstValue(\n      compraMaisRecente?.nomeCliente,\n      identity.nome\n    ),\n    email: loginEmail,\n    whatsapp: firstValue(\n      purchaseWhatsapp(compraMaisRecente),\n      identity.whatsapp\n    )\n  };`,
  "Dados da segunda via"
);

fs.writeFileSync(FILE, code, "utf8");
console.log("Central Seus Projetos Prontos: login FULL + autorização exclusiva por e-mail aplicada.");
