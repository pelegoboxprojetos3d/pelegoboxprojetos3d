from pathlib import Path

# ==============================================================
# ENTREGA PROJETOS PRONTOS
# ==============================================================
entrega = Path("src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js")
e = entrega.read_text(encoding="utf-8")

old_preparar = '''async function prepararSecoesEntrega() {
  await esconderSecao(SECOES_ENTREGA.banners);
  await esconderSecao(SECOES_ENTREGA.final);

  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") await principal.expand();
    if (typeof principal.show === "function") await principal.show();
  } catch (_) {}
}'''

new_preparar = '''async function prepararSecoesEntrega() {
  // SESSAO4VAZIA é parte permanente do desenho da página.
  // Nunca esconder nem recolher, inclusive enquanto a impressora está ativa.
  await mostrarSecao(SECOES_ENTREGA.vazia);

  await esconderSecao(SECOES_ENTREGA.banners);
  await esconderSecao(SECOES_ENTREGA.final);

  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") await principal.expand();
    if (typeof principal.show === "function") await principal.show();
  } catch (_) {}
}'''

if old_preparar in e:
    e = e.replace(old_preparar, new_preparar, 1)
elif "SESSAO4VAZIA é parte permanente do desenho da página." not in e:
    raise SystemExit("Bloco prepararSecoesEntrega não encontrado")

old_hide = '''    // PB: saída suave da seção vazia junto com a impressora.
    // Primeiro ambas desaparecem em fade; só depois o espaço é recolhido.
    let secaoVazia = null;
    try {
      secaoVazia = $w(SECOES_ENTREGA.vazia);
    } catch (_) {}

    const transicoesSaida = [];

    if (typeof processando.hide === "function") {
      transicoesSaida.push(processando.hide("fade", { duration: 650 }));
    }

    if (secaoVazia && typeof secaoVazia.hide === "function") {
      transicoesSaida.push(secaoVazia.hide("fade", { duration: 650 }));
    }

    await Promise.allSettled(transicoesSaida);

    if (typeof processando.collapse === "function") {
      await processando.collapse();
    }

    if (secaoVazia && typeof secaoVazia.collapse === "function") {
      await secaoVazia.collapse();
    }'''

new_hide = '''    // A impressora sai suavemente, mas a SESSAO4VAZIA permanece sempre.
    if (typeof processando.hide === "function") {
      await processando.hide("fade", { duration: 650 });
    }

    if (typeof processando.collapse === "function") {
      await processando.collapse();
    }

    await mostrarSecao(SECOES_ENTREGA.vazia);'''

if old_hide in e:
    e = e.replace(old_hide, new_hide, 1)
elif "A impressora sai suavemente, mas a SESSAO4VAZIA permanece sempre." not in e:
    raise SystemExit("Bloco esconderProcessamento não encontrado")

entrega.write_text(e, encoding="utf-8")

# ==============================================================
# SEM PRODUTO OU NÃO LOGADO
# ==============================================================
aviso = Path("src/pages/sem produto ou nao logado.xu6gd.js")
a = aviso.read_text(encoding="utf-8")

anchor = '''const IDS = {
  titulo: "#textomaior",
  texto: "#textomenor"
};'''
replacement = '''const IDS = {
  titulo: "#textomaior",
  texto: "#textomenor"
};

const SESSAO_VAZIA = "#SESSAO4VAZIA";'''

if 'const SESSAO_VAZIA = "#SESSAO4VAZIA";' not in a:
    if anchor not in a:
        raise SystemExit("Âncora IDS da página de aviso não encontrada")
    a = a.replace(anchor, replacement, 1)

helper_anchor = "function ocultarMensagemInicial() {"
helper = '''async function garantirSessaoVaziaVisivel() {
  try {
    const secao = $w(SESSAO_VAZIA);

    if (typeof secao.expand === "function") {
      await secao.expand();
    }

    if (typeof secao.show === "function") {
      await secao.show();
    }
  } catch (_) {}
}

'''

if "async function garantirSessaoVaziaVisivel()" not in a:
    if helper_anchor not in a:
        raise SystemExit("Âncora do helper da página de aviso não encontrada")
    a = a.replace(helper_anchor, helper + helper_anchor, 1)

old_ready = '''$w.onReady(function () {
  /*
    Esta página é apenas de aviso/triagem. As três seções desenhadas no Editor
    permanecem visíveis: texto, banners dos três botões e aviso importante.
    Nenhuma impressora ou seção da página de entrega é controlada aqui.
  */'''

new_ready = '''$w.onReady(function () {
  /*
    Esta página é apenas de aviso/triagem. As seções desenhadas no Editor
    permanecem visíveis. A SESSAO4VAZIA é estrutural e deve aparecer sempre,
    tanto logado quanto não logado e independentemente do motivo da página.
  */

  garantirSessaoVaziaVisivel().catch(() => {});'''

if old_ready in a:
    a = a.replace(old_ready, new_ready, 1)
elif "garantirSessaoVaziaVisivel().catch(() => {});" not in a:
    raise SystemExit("Bloco onReady da página de aviso não encontrado")

aviso.write_text(a, encoding="utf-8")
