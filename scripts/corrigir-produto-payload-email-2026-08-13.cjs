const fs = require("fs");

const FILE = "src/backend/notificarVendaProjetoPronto.js";
let code = fs.readFileSync(FILE, "utf8");

const from = `  const emailPayload = {\n    ...payload,\n    botaoUrl: payload.botaoUrl + "&via=email",\n    deliveryUrl: payload.deliveryUrl + "&via=email"\n  };`;

const to = `  const emailPayload = {\n    ...payload,\n    // O cenário do Make ainda usa o campo legado \"produto\" no assunto e no HTML.\n    // Para não mexer no checkout nem na ValidaPay, somente o payload do e-mail\n    // sobrescreve esse campo com o título canônico vindo de Videosprojetos.\n    produto: tituloEmailCorreto,\n    tituloProjeto: tituloEmailCorreto,\n    tituloEmail: tituloEmailCorreto,\n    botaoUrl: payload.botaoUrl + "&via=email",\n    deliveryUrl: payload.deliveryUrl + "&via=email"\n  };`;

if (!code.includes(to)) {
  if (!code.includes(from)) throw new Error("Bloco emailPayload não encontrado.");
  code = code.replace(from, to);
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Payload do e-mail agora entrega o título canônico também em produto.");
} else {
  console.log("Payload do e-mail já usa o título canônico no campo produto.");
}
