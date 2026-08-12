from pathlib import Path
import re

path = Path("src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js")
text = path.read_text(encoding="utf-8")

# 1) Remove hover em Velo que altera borderWidth e força relayout/repaint.
pattern_hover = re.compile(
    r"function ligarDestaqueAoPassarMouse\([\s\S]*?function ligarDestaquesDosAvisos\(\) \{[\s\S]*?\n\}\n\n\n// ======================================================\n// ESTADO DAS ETAPAS",
    re.M,
)
text, n = pattern_hover.subn(
    "// ======================================================\n// ESTADO DAS ETAPAS",
    text,
    count=1,
)
if n != 1:
    raise SystemExit("Bloco de hover nao encontrado")

# 2) Não some com thumbnail/título/botões enquanto o CMS responde.
pattern_hide = re.compile(
    r"function esconderConteudoPrincipal\(\) \{[\s\S]*?\n\}\n\nasync function mostrarProjetoCompleto",
    re.M,
)
replacement_hide = """function esconderConteudoPrincipal() {
  /*
    Preserva o conteúdo visual no Voltar/BFCache enquanto o CMS responde.
    Segurança continua garantida porque os botões ficam desabilitados até
    a identificação e os acessos serem restaurados.
  */
  bloquearSemIdentificacao();
}

async function mostrarProjetoCompleto"""
text, n = pattern_hide.subn(replacement_hide, text, count=1)
if n != 1:
    raise SystemExit("esconderConteudoPrincipal nao encontrado")

# Remove eventual chamada que tenha sobrevivido fora do bloco.
text = text.replace("  ligarDestaquesDosAvisos();\n\n", "", 1)

# 3) Revalidação direta de acessos. Evita buscarCliente + obterAcessos em série.
marker = "async function iniciarPagina() {"
if marker not in text:
    raise SystemExit("iniciarPagina nao encontrado")

helper = """async function revalidarAcessosSalvos(data = identificacao) {
  if (!projeto || !cadastroProntoParaPagamento(data)) {
    return;
  }

  const telefone = normalizarTelefone(data);

  try {
    const resultado = await comTimeout(
      obterAcessosProjeto({
        codigoProjeto: codigoPublico(projeto),
        clienteId: safe(data.clienteId),
        email: normalizeEmail(data.email),
        whatsapp: onlyDigits(telefone.whatsappE164)
      }),
      6000,
      "A atualização dos acessos demorou mais que o esperado."
    );

    if (!resultado?.ok || !resultado?.access) {
      return;
    }

    acessos = {
      medidas: resultado.access.medidas === true,
      graficos: resultado.access.graficos === true,
      projeto: resultado.access.projeto === true
    };

    capturarDownloads(resultado);
    salvarAcessosLocais(codigoPublico(projeto), acessos);
    consultaConcluida = true;
    await mostrarValoresEAcessos();
  } catch (error) {
    console.warn(
      "Revalidação de acessos em segundo plano falhou:",
      error?.message || error
    );
  }
}


"""
text = text.replace(marker, helper + marker, 1)

# 4) Identidade completa pinta a tela imediatamente e revalida em segundo plano
# em TODOS os navegadores, inclusive desktop. Cache não é mais a fonte final.
pattern_fast = re.compile(
    r"    if \(confirmacaoAtualValida\) \{[\s\S]*?      await identificarCliente\(salva\);\n      return;\n    \}",
    re.M,
)
replacement_fast = """    if (confirmacaoAtualValida) {
      const acessosSalvos =
        lerAcessosLocais(
          codigoPublico(projeto)
        );

      if (cadastroProntoParaPagamento(salva)) {
        identificado = true;
        consultaConcluida = Boolean(acessosSalvos);

        acessos = acessosSalvos || {
          medidas: false,
          graficos: false,
          projeto: false
        };

        clienteAtual = {
          _id: safe(salva.clienteId),
          clienteId: safe(salva.clienteId),
          nome: safe(salva.nome),
          title: safe(salva.nome),
          email: normalizeEmail(salva.email),
          cpfCnpj: onlyDigits(salva.cpfCnpj)
        };

        capturarDownloads({ access: acessos });
        await mostrarValoresEAcessos();

        /*
          O cache serve só para pintar rápido. A verdade volta do backend
          em segundo plano, tanto no desktop quanto no mobile.
        */
        revalidarAcessosSalvos(salva)
          .catch((error) => {
            console.error(
              "Erro ao atualizar acessos em segundo plano:",
              error?.message || error
            );
          });

        return;
      }

      /* Identificação antiga/incompleta ainda usa o caminho de restauração. */
      await identificarCliente(salva);
      return;
    }"""
text, n = pattern_fast.subn(replacement_fast, text, count=1)
if n != 1:
    raise SystemExit("Bloco de restauracao rapida nao encontrado")

path.write_text(text.rstrip() + "\n", encoding="utf-8")
print("Patch cross-browser aplicado")
