const fs = require("fs");

const FILE = "src/backend/validaPayCartaoProjetosProntos.jsw";
let code = fs.readFileSync(FILE, "utf8");

code = code
  .replace('import { currentMember as currentMemberBackend } from "wix-members-backend";\n', '')
  .replace('import { tokenize } from "@validapay/tokenize";\n', '')
  .replace('import { buscarMetodoPagamentoPrivadoPorEmail, salvarMetodoPagamentoAprovado } from "backend/metodosPagamentoProjetosProntos";\n', '');

code = code.replace(
  /async function identidadeMembroAtualCartao\(\)[\s\S]*?\/\/ CARTÃO TRANSPARENTE VALIDAPAY/,
  '// CARTÃO TRANSPARENTE VALIDAPAY'
);

code = code.replace(/\n\s*await persistirMetodoPagamentoAprovado\(session, chargeId\);/, '');

const oldFunction = `export async function criarCobrancaCartaoTransparente(input = {}) {
  const card = input.card || {};
  const number = digits(card.number);
  const cvv = digits(card.cvv);
  const month = digits(card.month).padStart(2, "0").slice(-2);
  let year = digits(card.year);
  if (year.length === 2) year = \`20\${year}\`;
  const holder = safe(card.name).replace(/\\s+/g, " ").toUpperCase();

  try {
    const ctx = input.ctx || {};
    const checkoutId = safe(input.checkoutId);
    const codigoProjeto = digits(input.codigoProjeto || ctx.codigoProjeto);
    const tipoProduto = productType(input.tipoProduto || ctx.tipoProduto);
    const produto = tituloEtapaProjetoPronto(input.produto || ctx.produto || ctx.titulo || "Projeto Pronto", tipoProduto, codigoProjeto);
    const valor = money(input.valor ?? ctx.valor ?? ctx.price);
    const clienteId = safe(input.clienteId || ctx.clienteId);
    const nome = safe(input.nome || input.nomeCliente || ctx.nome || ctx.nomeCliente);
    const email = safe(input.email || ctx.email).toLowerCase();
    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);
    const whatsapp = phone(input.whatsappE164 || input.whatsapp || ctx.whatsappE164 || ctx.whatsapp);
    const cardDocument = digits(input.cardDocument || cpfCnpj);
    const installments = Math.min(12, Math.max(1, Number(input.installments || 1)));

    if (!checkoutId || !codigoProjeto || !(valor > 0)) return { ok: false, error: "Dados do produto incompletos." };
    if (!clienteId || nome.length < 3 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(email) || !whatsapp || ![11, 14].includes(cpfCnpj.length)) {
      return { ok: false, error: "Dados do comprador incompletos." };
    }
    if (!luhn(number)) return { ok: false, error: "Número do cartão inválido." };
    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year)) return { ok: false, error: "Validade do cartão inválida." };
    if (!/^\\d{3,4}$/.test(cvv)) return { ok: false, error: "CVV inválido." };
    if (holder.length < 3) return { ok: false, error: "Nome impresso no cartão inválido." };
    if (![11, 14].includes(cardDocument.length)) return { ok: false, error: "CPF/CNPJ do portador inválido." };

    const previousSession = await findSession(checkoutId);
    const previousMethod = safe(previousSession?.paymentMethod).toUpperCase();
    const previousChargeId = previousMethod === "CARD"
      ? safe(previousSession?.validaPayChargeId || previousSession?.paymentId)
      : "";
    const previousStatus = safe(previousSession?.status).toLowerCase();
    let cardAttempt = Math.max(1, Number(previousSession?.cardAttempt || 1));

    if (previousChargeId) {
      const previousResponse = await api("get", \`/v1/charges/\${encodeURIComponent(previousChargeId)}\`);

      if (!previousResponse.ok) {
        return {
          ok: true,
          recoverable: true,
          processing: true,
          chargeId: previousChargeId,
          status: previousStatus || "pending",
          error: "A tentativa anterior ainda está sendo conferida pela operadora."
        };
      }

      const previousData = previousResponse.data?.data || previousResponse.data?.charge || previousResponse.data || {};
      const liveStatus = extractChargeStatus(previousData);

      if (isApprovedCardStatus(liveStatus)) {
        await saveSession(checkoutId, {
          status: "approved",
          paymentMethod: "CARD",
          validaPayChargeId: previousChargeId,
          paymentId: previousChargeId,
          cardAttempt,
          updatedAtDate: new Date()
        });
        const finalization = await finalizeApprovedCard({ checkoutId, chargeId: previousChargeId });
        return {
          ok: true,
          approved: true,
          checkoutId,
          chargeId: previousChargeId,
          status: liveStatus,
          compraRegistrada: finalization.compraRegistrada === true,
          purchaseId: safe(finalization.purchaseId),
          tokenEntrega: safe(finalization.tokenEntrega),
          make: finalization.make
        };
      }

      if (!isTerminalCardFailure(liveStatus)) {
        await saveSession(checkoutId, {
          status: liveStatus || "pending",
          paymentMethod: "CARD",
          validaPayChargeId: previousChargeId,
          paymentId: previousChargeId,
          cardAttempt,
          updatedAtDate: new Date()
        });
        return {
          ok: true,
          recoverable: true,
          processing: true,
          chargeId: previousChargeId,
          status: liveStatus || "pending",
          error: "Já existe uma tentativa de cartão em análise. Aguardando a operadora antes de permitir outra cobrança."
        };
      }

      cardAttempt += 1;
    } else if (previousMethod === "CARD" && isTerminalCardFailure(previousStatus)) {
      cardAttempt += 1;
    }

    await saveSession(checkoutId, {
      status: "pending",
      paymentMethod: "CARD",
      clienteId,
      nomeCliente: nome,
      whatsapp,
      email,
      cpfCnpj,
      codigoProjeto,
      tipoProduto,
      produto,
      img: safe(input.img || ctx.img || ctx.imagem),
      valor,
      returnUrl: safe(input.returnUrl || ctx.returnUrl),
      compraRegistrada: false,
      cardAttempt,
      updatedAtDate: new Date()
    });

    const priceId = await ensurePriceId({ checkoutId, codigoProjeto, tipoProduto, produto, valor });
    if (!priceId) return { ok:false, error:"Não foi possível vincular o produto à cobrança ValidaPay. Nenhuma cobrança foi criada." };

    const chargePayload = {
      paymentMethod: "creditcard",
      externalId: cardAttemptExternalId(checkoutId, cardAttempt),
      externalTxid: \`PP-\${codigoProjeto}-CARD-\${safe(checkoutId).replace(/[^a-z0-9]/gi, "").slice(-8)}\`.slice(0, 35),
      customer: {
        name: nome,
        email,
        documentNumber: cpfCnpj,
        phone: whatsapp
      },
      card: {
        number,
        cvv,
        name: holder,
        expiration: \`\${month}/\${year}\`
      },
      installments,
      passFeesToCustomer: false,
      freeInstallments: 1,
      metadata: {
        origem: "PELEGO_BOX_PROJETOS_PRONTOS",
        checkoutId,
        clienteId,
        codigoProjeto,
        tipoProduto,
        produto,
        phone: whatsapp,
        whatsapp,
        email
      }
    };

    chargePayload.items = [{ priceId, quantity: 1 }];

    const response = await api("post", "/v1/charges", chargePayload);

    if (!response.ok) {
      if (response.statusCode === 409) {
        const id = extractChargeId(response.data || {});
        if (id) {
          await saveSession(checkoutId, {
            validaPayChargeId: id,
            paymentId: id,
            paymentMethod: "CARD",
            status: "pending",
            cardAttempt,
            updatedAtDate: new Date()
          });
          return {
            ok: false,
            recoverable: true,
            chargeId: id,
            error: "A cobrança já foi enviada. Aguarde a confirmação antes de tentar novamente."
          };
        }
      }
      const declined = response.statusCode === 402;
      if (declined) {
        await saveSession(checkoutId, {
          status: "rejected",
          paymentMethod: "CARD",
          validaPayChargeId: "",
          paymentId: "",
          cardAttempt,
          updatedAtDate: new Date()
        });
      }
      return {
        ok: false,
        declined,
        status: declined ? "rejected" : "",
        error: response.error || "Cartão não aprovado."
      };
    }

    const id = extractChargeId(response.data || {});
    const status = extractChargeStatus(response.data || {});
    const approved = response.data?.success !== false && isApprovedCardStatus(status);

    await saveSession(checkoutId, {
      validaPayChargeId: id,
      paymentId: id,
      paymentMethod: "CARD",
      cardAttempt,
      status: approved ? "approved" : (status || "pending"),
      updatedAtDate: new Date()
    });

    let finalization = {
      compraRegistrada: false,
      make: { skipped: true, reason: "payment_not_approved_yet" }
    };

    if (approved) {
      finalization = await finalizeApprovedCard({ checkoutId, chargeId: id });
    }

    return {
      ok: response.data?.success !== false,
      approved,
      checkoutId,
      chargeId: id,
      status: status || (approved ? "approved" : "pending"),
      cardBrand: safe(response.data?.cardBrand) || brand(number),
      cardLastFour: number.slice(-4),
      installments,
      amount: valor,
      productLinked: Boolean(priceId),
      phoneSent: whatsapp,
      compraRegistrada: finalization.compraRegistrada === true,
      purchaseId: safe(finalization.purchaseId),
      tokenEntrega: safe(finalization.tokenEntrega),
      make: finalization.make
    };
  } catch (error) {
    console.error("ERRO CARTAO VALIDAPAY:", error?.message || error);
    return { ok: false, error: error?.message || "Não foi possível processar o cartão." };
  }
}`;

const marker = 'export async function consultarCobrancaCartaoTransparente(input = {}) {';
const pattern = /export async function criarCobrancaCartaoTransparente\(input = \{\}\) \{[\s\S]*?\n\}\n\nexport async function consultarCobrancaCartaoTransparente\(input = \{\}\) \{/;
if (!pattern.test(code)) throw new Error("Função atual do cartão não localizada para hotfix.");
code = code.replace(pattern, oldFunction + '\n\n' + marker);

fs.writeFileSync(FILE, code, "utf8");
console.log("Hotfix aplicado: cartão voltou ao fluxo direto /v1/charges; SDK de tokenização removido do backend.");
