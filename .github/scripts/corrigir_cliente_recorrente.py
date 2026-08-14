from pathlib import Path

path = Path("src/backend/clientes.web.js")
text = path.read_text(encoding="utf-8")

if 'const SESSIONS_COLLECTION = "SessoesProjetosProntos2";' not in text:
    anchor = 'const COLLECTION = "Campo";\n\nconst DB_OPTS = {'
    replacement = 'const COLLECTION = "Campo";\nconst SESSIONS_COLLECTION = "SessoesProjetosProntos2";\n\nconst DB_OPTS = {'
    if anchor not in text:
        raise SystemExit("Ancora da colecao nao encontrada")
    text = text.replace(anchor, replacement, 1)

marker = "CLIENTE_RECORRENTE_COMPRA_ANTERIOR_V3"

helper = r'''
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
'''

if marker not in text:
    helper_anchor = "\n\n// ======================================================\n// BUSCAR CLIENTE\n// ======================================================\n"
    if helper_anchor not in text:
        raise SystemExit("Ancora do helper nao encontrada")
    text = text.replace(
        helper_anchor,
        "\n\n" + helper + helper_anchor,
        1
    )

old_return = '''      return {
        memberId,
        email: memberEmail,
        nome: memberName,
        cliente: clientePublico(clienteCanonico),
        ambiguo: unicos.length > 1,
        totalCadastrosMesmoEmail: unicos.length
      };'''

new_return = '''      const clienteResolvido =
        await completarClientePorSessaoDoMembro(
          clientePublico(
            clienteCanonico
          ),
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
      };'''

if old_return in text:
    text = text.replace(
        old_return,
        new_return,
        1
    )
elif "cliente: clienteResolvido" not in text:
    raise SystemExit("Retorno canonico nao encontrado")

path.write_text(
    text,
    encoding="utf-8"
)
