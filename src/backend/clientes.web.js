import wixData from "wix-data";

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