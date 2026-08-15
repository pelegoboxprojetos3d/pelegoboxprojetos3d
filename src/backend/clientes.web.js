import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";

import {
  webMethod,
  Permissions
} from "wix-web-module";

import {
  normalizarWhatsapp,
  buscarCliente as buscarClienteInterno,
  criarCliente as criarClienteInterno,
  atualizarUltimoAcesso as atualizarUltimoAcessoInterno,
  atualizarEmail as atualizarEmailInterno
} from "backend/clientes";

const COLLECTION = "Campo";
const SESSIONS_COLLECTION = "SessoesProjetosProntos2";
const PURCHASES_COLLECTION = "ComprasProjetos";

const DB_OPTS = {
  suppressAuth: true
};


// ======================================================
// HELPERS
// ======================================================

function safe(value) {
  return String(value ?? "").trim();
}


function limparEmail(email) {
  return safe(email).toLowerCase();
}


function limparNome(nome) {
  return safe(nome)
    .replace(/\s+/g, " ")
    .trim();
}


function limparCpfCnpj(value) {
  return safe(value).replace(/\D/g, "");
}


function whatsappNacional(numero) {
  const whatsapp =
    normalizarWhatsapp(numero);

  if (!whatsapp) {
    return "";
  }

  return whatsapp.replace(
    /^\+55/,
    ""
  );
}


// ======================================================
// VALIDAÇÃO DE CPF
// ======================================================

function cpfValido(value) {
  const cpf =
    limparCpfCnpj(value);

  if (
    cpf.length !== 11 ||
    /^(\d)\1{10}$/.test(cpf)
  ) {
    return false;
  }

  let soma = 0;

  for (
    let index = 0;
    index < 9;
    index += 1
  ) {
    soma +=
      Number(cpf[index]) *
      (10 - index);
  }

  let digito1 =
    (soma * 10) % 11;

  if (digito1 === 10) {
    digito1 = 0;
  }

  if (
    digito1 !==
    Number(cpf[9])
  ) {
    return false;
  }

  soma = 0;

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    soma +=
      Number(cpf[index]) *
      (11 - index);
  }

  let digito2 =
    (soma * 10) % 11;

  if (digito2 === 10) {
    digito2 = 0;
  }

  return (
    digito2 ===
    Number(cpf[10])
  );
}


// ======================================================
// VALIDAÇÃO DE CNPJ
// ======================================================

function calcularDigitoCnpj(
  base,
  pesos
) {
  let soma = 0;

  for (
    let index = 0;
    index < pesos.length;
    index += 1
  ) {
    soma +=
      Number(base[index]) *
      pesos[index];
  }

  const resto = soma % 11;

  return (
    resto < 2
      ? 0
      : 11 - resto
  );
}


function cnpjValido(value) {
  const cnpj =
    limparCpfCnpj(value);

  if (
    cnpj.length !== 14 ||
    /^(\d)\1{13}$/.test(cnpj)
  ) {
    return false;
  }

  const base =
    cnpj.slice(0, 12);

  const digito1 =
    calcularDigitoCnpj(
      base,
      [
        5, 4, 3, 2,
        9, 8, 7, 6,
        5, 4, 3, 2
      ]
    );

  const digito2 =
    calcularDigitoCnpj(
      base + digito1,
      [
        6, 5, 4, 3, 2,
        9, 8, 7, 6,
        5, 4, 3, 2
      ]
    );

  return (
    cnpj ===
    base +
    digito1 +
    digito2
  );
}


function validarCpfCnpjInformado(
  value
) {
  const documento =
    limparCpfCnpj(value);

  /*
    CPF/CNPJ permanece opcional
    enquanto o checkout ainda estiver
    sendo adaptado.
  */

  if (!documento) {
    return "";
  }

  if (
    documento.length === 11 &&
    cpfValido(documento)
  ) {
    return documento;
  }

  if (
    documento.length === 14 &&
    cnpjValido(documento)
  ) {
    return documento;
  }

  throw new Error(
    "CPF ou CNPJ inválido."
  );
}


// ======================================================
// RETORNO PÚBLICO
// ======================================================

function clientePublico(item) {
  if (!item) {
    return null;
  }

  const primeiroValor = (...valores) =>
    valores.find((valor) => safe(valor)) ?? "";

  const whatsapp =
    normalizarWhatsapp(
      primeiroValor(
        item.whatsapp,
        item.Whatsapp
      )
    );

  const id =
    safe(
      primeiroValor(
        item._id,
        item.clienteId,
        item["Cliente ID"]
      )
    );

  return {
    _id:
      id,

    clienteId:
      safe(
        primeiroValor(
          item.clienteId,
          item["Cliente ID"],
          id
        )
      ),

    nome:
      limparNome(
        primeiroValor(
          item.nome,
          item.nomeCliente,
          item.Nomecliente,
          item.title,
          item.Title
        )
      ),

    /*
      Padrão oficial usado internamente:
      +5547988419261
    */
    whatsapp,

    whatsappE164:
      whatsapp,

    /*
      Formato nacional sem DDI.
    */
    whatsappNacional:
      whatsappNacional(whatsapp),

    email:
      limparEmail(
        primeiroValor(
          item.email,
          item.Email
        )
      ),

    cpfCnpj:
      limparCpfCnpj(
        primeiroValor(
          item.cpfCnpj,
          item.cpfcnpj,
          item.Cpfcnpj,
          item["CPF/CNPJ"]
        )
      ),

    status:
      safe(item.status),

    ativo:
      item.ativo !== false
  };
}



// LOGIN_MEMBRO_BUSCA_COMPRAS_V1
// A conta Wix autenticada é a âncora. Se o cadastro em Campo estiver
// incompleto, recupera Nome/WhatsApp/CPF diretamente de ComprasProjetos
// usando SOMENTE o mesmo e-mail autenticado. Assim limpar histórico ou
// trocar de celular nunca obriga cliente recorrente a preencher tudo de novo.
async function completarClientePorCompraDoMembro(
  cliente,
  memberEmail,
  memberName
) {
  const emailMembro = limparEmail(memberEmail);
  const atual = cliente ? { ...cliente } : null;

  const documentoAtual = limparCpfCnpj(atual?.cpfCnpj);
  if (
    atual &&
    safe(atual.whatsapp) &&
    limparNome(atual.nome).length >= 3 &&
    (documentoAtual.length === 11 || documentoAtual.length === 14)
  ) {
    atual.email = emailMembro;
    return atual;
  }

  const encontrados = [];
  for (const campo of ["email", "Email"]) {
    try {
      const resultado = await wixData
        .query(PURCHASES_COLLECTION)
        .eq(campo, emailMembro)
        .limit(50)
        .find(DB_OPTS);
      encontrados.push(...(resultado.items || []));
    } catch (_) {}
  }

  const unicos = Array.from(
    new Map(
      encontrados
        .filter(Boolean)
        .map((item) => [safe(item?._id), item])
    ).values()
  ).filter((item) => safe(item?._id));

  const pontuar = (item) => {
    let pontos = 0;
    const emailCompra = limparEmail(item?.email || item?.Email);
    const documento = limparCpfCnpj(
      item?.cpfCnpj || item?.cpf || item?.cpfcnpj || item?.Cpfcnpj || item?.["CPF/CNPJ"]
    );
    const whatsapp = normalizarWhatsapp(
      item?.whatsappE164 || item?.whatsapp || item?.whatsApp || item?.Whatsapp || item?.WhatsApp
    );
    const nome = limparNome(
      item?.nomeCliente || item?.nome || item?.Nomecliente || item?.title || item?.Title
    );
    const clienteId = safe(item?.clienteId || item?.clienteID || item?.["Cliente ID"]);
    const status = safe(item?.statusCompra || item?.pagamento).toLowerCase();

    if (emailCompra === emailMembro) pontos += 100;
    if (documento.length === 11 || documento.length === 14) pontos += 50;
    if (whatsapp) pontos += 30;
    if (nome.length >= 3) pontos += 20;
    if (clienteId) pontos += 10;
    if (["approved", "paid", "aprovado", "aprovada", "pago", "paga"].includes(status)) pontos += 10;
    return pontos;
  };

  const compra = [...unicos]
    .sort((a, b) => {
      const diferenca = pontuar(b) - pontuar(a);
      if (diferenca) return diferenca;
      return (
        new Date(b?.dataCompra || b?._updatedDate || b?._createdDate || 0).getTime() -
        new Date(a?.dataCompra || a?._updatedDate || a?._createdDate || 0).getTime()
      );
    })[0] || null;

  if (!compra) {
    if (atual) atual.email = emailMembro;
    return atual;
  }

  const whatsappCompra = normalizarWhatsapp(
    compra?.whatsappE164 || compra?.whatsapp || compra?.whatsApp || compra?.Whatsapp || compra?.WhatsApp
  );
  const cpfCompra = limparCpfCnpj(
    compra?.cpfCnpj || compra?.cpf || compra?.cpfcnpj || compra?.Cpfcnpj || compra?.["CPF/CNPJ"]
  );
  const nomeCompra = limparNome(
    compra?.nomeCliente || compra?.nome || compra?.Nomecliente || compra?.title || compra?.Title
  );
  const clienteIdCompra = safe(
    compra?.clienteId || compra?.clienteID || compra?.["Cliente ID"]
  );

  const final = atual || {
    _id: clienteIdCompra,
    clienteId: clienteIdCompra,
    nome: "",
    whatsapp: "",
    whatsappE164: "",
    whatsappNacional: "",
    email: emailMembro,
    cpfCnpj: "",
    status: "",
    ativo: true
  };

  final._id = safe(final._id) || clienteIdCompra;
  final.clienteId = safe(final.clienteId) || clienteIdCompra || safe(final._id);
  final.nome = limparNome(final.nome) || nomeCompra || limparNome(memberName);
  final.whatsapp = normalizarWhatsapp(final.whatsapp) || whatsappCompra;
  final.whatsappE164 = final.whatsapp;
  final.whatsappNacional = whatsappNacional(final.whatsapp);
  final.email = emailMembro;
  final.cpfCnpj = limparCpfCnpj(final.cpfCnpj) || cpfCompra;

  return final;
}


// CLIENTE_RECORRENTE_COMPRA_ANTERIOR_V3
// O e-mail vem do membro Wix autenticado no backend. Se o cadastro Campo
// estiver incompleto, completamos SOMENTE campos ausentes com uma sessao
// anterior pertencente ao mesmo e-mail autenticado.
async function completarClientePorSessaoDoMembro(
  cliente,
  memberEmail,
  memberName
) {
  const emailMembro =
    limparEmail(memberEmail);

  const atual =
    cliente
      ? { ...cliente }
      : null;

  const documentoAtual =
    limparCpfCnpj(
      atual?.cpfCnpj
    );

  if (
    atual &&
    safe(atual.whatsapp) &&
    limparNome(atual.nome).length >= 3 &&
    (
      documentoAtual.length === 11 ||
      documentoAtual.length === 14
    )
  ) {
    atual.email =
      emailMembro;

    return atual;
  }

  const encontrados = [];

  for (const campo of ["email", "Email"]) {
    try {
      const resultado =
        await wixData
          .query(
            SESSIONS_COLLECTION
          )
          .eq(
            campo,
            emailMembro
          )
          .descending(
            "_updatedDate"
          )
          .limit(50)
          .find(DB_OPTS);

      encontrados.push(
        ...(resultado.items || [])
      );
    } catch (_) {}
  }

  const unicos =
    Array.from(
      new Map(
        encontrados
          .filter(Boolean)
          .map(
            (item) => [
              safe(item?._id),
              item
            ]
          )
      ).values()
    ).filter(
      (item) =>
        safe(item?._id)
    );

  const pontuar = (item) => {
    let pontos = 0;

    const emailSessao =
      limparEmail(
        item?.email ||
        item?.Email
      );

    const documento =
      limparCpfCnpj(
        item?.cpfCnpj ||
        item?.cpf ||
        item?.cpfcnpj ||
        item?.Cpfcnpj ||
        item?.["CPF/CNPJ"]
      );

    const whatsapp =
      normalizarWhatsapp(
        item?.whatsappE164 ||
        item?.whatsapp ||
        item?.whatsApp ||
        item?.Whatsapp ||
        item?.WhatsApp
      );

    const nome =
      limparNome(
        item?.nomeCliente ||
        item?.nome ||
        item?.Nomecliente ||
        item?.title ||
        item?.Title
      );

    if (
      emailSessao ===
      emailMembro
    ) {
      pontos += 100;
    }

    if (
      documento.length === 11 ||
      documento.length === 14
    ) {
      pontos += 50;
    }

    if (whatsapp) {
      pontos += 30;
    }

    if (
      nome.length >= 3
    ) {
      pontos += 20;
    }

    return pontos;
  };

  const sessao =
    [...unicos]
      .sort(
        (a, b) => {
          const diferenca =
            pontuar(b) -
            pontuar(a);

          if (diferenca) {
            return diferenca;
          }

          return (
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
        }
      )[0] ||
    null;

  if (!sessao) {
    if (atual) {
      atual.email =
        emailMembro;
    }

    return atual;
  }

  const whatsappSessao =
    normalizarWhatsapp(
      sessao?.whatsappE164 ||
      sessao?.whatsapp ||
      sessao?.whatsApp ||
      sessao?.Whatsapp ||
      sessao?.WhatsApp
    );

  const cpfSessao =
    limparCpfCnpj(
      sessao?.cpfCnpj ||
      sessao?.cpf ||
      sessao?.cpfcnpj ||
      sessao?.Cpfcnpj ||
      sessao?.["CPF/CNPJ"]
    );

  const nomeSessao =
    limparNome(
      sessao?.nomeCliente ||
      sessao?.nome ||
      sessao?.Nomecliente ||
      sessao?.title ||
      sessao?.Title
    );

  const clienteIdSessao =
    safe(
      sessao?.clienteId ||
      sessao?.["Cliente ID"]
    );

  const final =
    atual || {
      _id:
        clienteIdSessao,

      clienteId:
        clienteIdSessao,

      nome:
        "",

      whatsapp:
        "",

      whatsappE164:
        "",

      whatsappNacional:
        "",

      email:
        emailMembro,

      cpfCnpj:
        "",

      status:
        "",

      ativo:
        true
    };

  final._id =
    safe(final._id) ||
    clienteIdSessao;

  final.clienteId =
    safe(final.clienteId) ||
    clienteIdSessao ||
    safe(final._id);

  final.nome =
    limparNome(
      final.nome
    ) ||
    nomeSessao ||
    limparNome(memberName);

  final.whatsapp =
    normalizarWhatsapp(
      final.whatsapp
    ) ||
    whatsappSessao;

  final.whatsappE164 =
    final.whatsapp;

  final.whatsappNacional =
    whatsappNacional(
      final.whatsapp
    );

  final.email =
    emailMembro;

  final.cpfCnpj =
    limparCpfCnpj(
      final.cpfCnpj
    ) ||
    cpfSessao;

  return final;
}


// ======================================================
// BUSCAR CLIENTE
// ======================================================

export const buscarCliente =
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


// ======================================================
// BUSCAR CLIENTE PELO MEMBRO WIX AUTENTICADO
// ======================================================

export const buscarClienteDoMembroAtual =
  webMethod(
    Permissions.SiteMember,

    async () => {
      const membro =
        await currentMemberBackend.getMember();

      const memberId =
        safe(membro?._id);

      const emailsContato =
        Array.isArray(
          membro?.contactDetails?.emails
        )
          ? membro.contactDetails.emails
          : [];

      const memberEmail =
        limparEmail(
          membro?.loginEmail ||
          emailsContato[0] ||
          membro?.contactDetails?.email
        );

      const memberName =
        limparNome(
          membro?.profile?.nickname ||
          [
            membro?.contactDetails?.firstName,
            membro?.contactDetails?.lastName
          ]
            .filter(Boolean)
            .join(" ")
        );

      if (!memberId || !memberEmail) {
        return {
          memberId,
          email: memberEmail,
          nome: memberName,
          cliente: null,
          ambiguo: false
        };
      }

      const encontrados = [];

      for (const campo of ["email", "Email"]) {
        try {
          const resultado =
            await wixData
              .query(COLLECTION)
              .eq(campo, memberEmail)
              .limit(20)
              .find(DB_OPTS);

          encontrados.push(
            ...(resultado.items || [])
          );
        } catch (_) {}
      }

      const unicos =
        Array.from(
          new Map(
            encontrados
              .filter(Boolean)
              .map((item) => [safe(item?._id), item])
          ).values()
        ).filter((item) => safe(item?._id));

      // CLIENTE_RECORRENTE_EMAIL_CANONICO_V1
      // A conta Wix autenticada já fixa o e-mail. Cadastros duplicados com
      // esse MESMO e-mail não devem obrigar o cliente a preencher tudo outra vez.
      // Escolhemos o registro mais completo e, em empate, o mais recente.
      const pontuarCadastro = (item) => {
        const publico = clientePublico(item);
        if (!publico) return -1;

        let pontos = 0;
        const documento = limparCpfCnpj(publico.cpfCnpj);

        if (limparEmail(publico.email) === memberEmail) pontos += 100;
        if (safe(publico.whatsapp)) pontos += 30;
        if (limparNome(publico.nome).length >= 3) pontos += 20;
        if (documento.length === 11 || documento.length === 14) pontos += 30;
        if (safe(publico.clienteId)) pontos += 10;
        if (publico.ativo !== false) pontos += 5;

        return pontos;
      };

      const timestampCadastro = (item) =>
        new Date(
          item?._updatedDate ||
          item?._createdDate ||
          0
        ).getTime();

      const ordenados =
        [...unicos].sort((a, b) => {
          const diferencaPontos =
            pontuarCadastro(b) -
            pontuarCadastro(a);

          if (diferencaPontos) {
            return diferencaPontos;
          }

          return (
            timestampCadastro(b) -
            timestampCadastro(a)
          );
        });

      const clienteCanonico =
        ordenados[0] ||
        null;

      const clientePorCompra =
        await completarClientePorCompraDoMembro(
          clientePublico(
            clienteCanonico
          ),
          memberEmail,
          memberName
        );

      const clienteResolvido =
        await completarClientePorSessaoDoMembro(
          clientePorCompra,
          memberEmail,
          memberName
        );

      return {
        memberId,
        email: memberEmail,
        nome: memberName,
        cliente: clienteResolvido,
        ambiguo: unicos.length > 1,
        totalCadastrosMesmoEmail: unicos.length
      };
    }
  );

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
        padrao.replace(/^\+/, "");

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


// ======================================================
// CRIAR OU ATUALIZAR CLIENTE
// ======================================================

export const criarCliente =
  webMethod(
    Permissions.Anyone,

    async (dados = {}) => {
      const whatsapp =
        normalizarWhatsapp(
          dados.whatsapp
        );

      const email =
        limparEmail(
          dados.email
        );

      const nome =
        limparNome(
          dados.nome
        );

      /*
        Aceita nomes antigos apenas como
        entrada, mas salva exclusivamente
        no campo cpfCnpj.
      */
      const cpfCnpj =
        validarCpfCnpjInformado(
          dados.cpfCnpj ||
          dados.cpf ||
          dados.cnpj
        );

      if (!whatsapp) {
        throw new Error(
          "WhatsApp inválido. Informe DDD e número."
        );
      }

      if (!email) {
        throw new Error(
          "E-mail não informado."
        );
      }

      const cliente =
        await criarClienteInterno({
          whatsapp,
          email,
          nome,
          cpfCnpj,
          origem:
            safe(dados.origem) ||
            "CHECKOUT_PROJETOS_PRONTOS"
        });

      return clientePublico(
        cliente
      );
    }
  );


// ======================================================
// ATUALIZAR ÚLTIMO ACESSO
// ======================================================

export const atualizarUltimoAcesso =
  webMethod(
    Permissions.Anyone,

    async (_id) => {
      const id =
        safe(_id);

      if (!id) {
        throw new Error(
          "ID do cliente não informado."
        );
      }

      const cliente =
        await atualizarUltimoAcessoInterno(
          id
        );

      return clientePublico(
        cliente
      );
    }
  );


// ======================================================
// ATUALIZAR E-MAIL
// ======================================================

export const atualizarEmail =
  webMethod(
    Permissions.Anyone,

    async (
      _id,
      email
    ) => {
      const id =
        safe(_id);

      const emailLimpo =
        limparEmail(email);

      if (!id) {
        throw new Error(
          "ID do cliente não informado."
        );
      }

      if (!emailLimpo) {
        throw new Error(
          "E-mail não informado."
        );
      }

      const cliente =
        await atualizarEmailInterno(
          id,
          emailLimpo
        );

      return clientePublico(
        cliente
      );
    }
  );


// ======================================================
// ATUALIZAR CPF/CNPJ
// ======================================================

export const atualizarCpfCnpj =
  webMethod(
    Permissions.Anyone,

    async (
      _id,
      cpfCnpj
    ) => {
      const id =
        safe(_id);

      const documento =
        validarCpfCnpjInformado(
          cpfCnpj
        );

      if (!id) {
        throw new Error(
          "ID do cliente não informado."
        );
      }

      if (!documento) {
        throw new Error(
          "CPF ou CNPJ não informado."
        );
      }

      const cliente =
        await wixData.get(
          COLLECTION,
          id,
          DB_OPTS
        );

      cliente.cpfCnpj =
        documento;

      cliente.ultimoAcesso =
        new Date();

      if (
        cliente.whatsapp
      ) {
        const whatsapp =
          normalizarWhatsapp(
            cliente.whatsapp
          );

        if (whatsapp) {
          cliente.whatsapp =
            whatsapp;
        }
      }

      if (
        !safe(cliente.clienteId)
      ) {
        cliente.clienteId =
          id;
      }

      const atualizado =
        await wixData.update(
          COLLECTION,
          cliente,
          DB_OPTS
        );

      return clientePublico(
        atualizado
      );
    }
  );


// ======================================================
// OBTER OU CRIAR CLIENTE
// ======================================================

export const obterOuCriarCliente =
  webMethod(
    Permissions.Anyone,

    async (dados = {}) => {
      const whatsapp =
        normalizarWhatsapp(
          dados.whatsapp
        );

      const email =
        limparEmail(
          dados.email
        );

      const nome =
        limparNome(
          dados.nome
        );

      const cpfCnpj =
        validarCpfCnpjInformado(
          dados.cpfCnpj ||
          dados.cpf ||
          dados.cnpj
        );

      if (!whatsapp) {
        throw new Error(
          "WhatsApp inválido. Informe DDD e número."
        );
      }

      const existente =
        await buscarClienteInterno(
          whatsapp
        );

      if (
        existente ||
        email
      ) {
        const cliente =
          await criarClienteInterno({
            whatsapp,
            email,
            nome,
            cpfCnpj,
            origem:
              safe(dados.origem) ||
              "CHECKOUT_PROJETOS_PRONTOS"
          });

        return clientePublico(
          cliente
        );
      }

      return null;
    }
  );


// AUTORIZACAO_CARTAO_NO_CLIENTES_V1
// Reutiliza o mesmo módulo de membro que já alimenta o checkout corretamente.
// A autorização é vinculada ao checkoutId e nunca depende de e-mail vindo do HTML.
export const autorizarPagamentoCartaoMembro =
  webMethod(
    Permissions.SiteMember,

    async (input = {}) => {
      try {
        const checkoutId =
          safe(input?.checkoutId);

        if (!checkoutId) {
          return {
            ok: false,
            error: "Checkout inválido. Atualize a página e tente novamente."
          };
        }

        const membro =
          await currentMemberBackend.getMember();

        const memberId =
          safe(membro?._id);

        const emailsContato =
          Array.isArray(
            membro?.contactDetails?.emails
          )
            ? membro.contactDetails.emails
            : [];

        const memberEmail =
          limparEmail(
            membro?.loginEmail ||
            emailsContato[0] ||
            membro?.contactDetails?.email
          );

        if (!memberId || !memberEmail) {
          return {
            ok: false,
            error: "Não foi possível confirmar a conta Wix ativa."
          };
        }

        const resultado =
          await wixData
            .query(SESSIONS_COLLECTION)
            .eq("checkoutId", checkoutId)
            .limit(1)
            .find({
              ...DB_OPTS,
              consistentRead: true
            });

        const agora = new Date();

        if (resultado.items.length) {
          const sessao = {
            ...resultado.items[0],
            memberId,
            email: memberEmail,
            updatedAtDate: agora
          };

          delete sessao.whatsApp;
          delete sessao.whatsappE164;

          await wixData.update(
            SESSIONS_COLLECTION,
            sessao,
            DB_OPTS
          );
        } else {
          await wixData.insert(
            SESSIONS_COLLECTION,
            {
              checkoutId,
              memberId,
              email: memberEmail,
              status: "pending_auth",
              updatedAtDate: agora
            },
            DB_OPTS
          );
        }

        return {
          ok: true,
          memberId,
          email: memberEmail
        };
      } catch (error) {
        console.error(
          "AUTORIZACAO CARTAO MEMBRO:",
          error?.message || error
        );

        return {
          ok: false,
          error: "Não foi possível confirmar a conta Wix ativa."
        };
      }
    }
  );
