from pathlib import Path

PAGE = Path("src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js")
text = PAGE.read_text(encoding="utf-8")

alvo = "function configurarRepeater() {\n  const repetidor = $w(IDS.repetidor);\n"
insercao = """async function prepararRepeaterParaCarregamento() {
  /*
    O Editor mantém um item-modelo do Repeater visível antes de os dados reais
    chegarem. Na abertura por e-mail/F5 isso expunha título, valores, botões e
    setas crus. O Repeater fica vazio, oculto e recolhido até receber dados.
  */
  try {
    const repetidor = $w(IDS.repetidor);
    repetidor.data = [];

    if (typeof repetidor.hide === \"function\") {
      await repetidor.hide();
    }

    if (typeof repetidor.collapse === \"function\") {
      await repetidor.collapse();
    }
  } catch (erro) {
    console.warn(
      \"Não foi possível preparar o estado inicial do repeater:\",
      erro?.message || erro
    );
  }
}

function configurarRepeater() {
  const repetidor = $w(IDS.repetidor);
"""

if alvo not in text:
    raise SystemExit("Ponto configurarRepeater não encontrado")
text = text.replace(alvo, insercao, 1)

alvo_ready = "$w.onReady(function () {\n  checkoutEmAndamento = false;\n\n  try {\n    configurarRepeater();\n"
novo_ready = "$w.onReady(async function () {\n  checkoutEmAndamento = false;\n\n  await prepararRepeaterParaCarregamento();\n\n  try {\n    configurarRepeater();\n"

if alvo_ready not in text:
    raise SystemExit("Bloco onReady esperado não encontrado")
text = text.replace(alvo_ready, novo_ready, 1)

PAGE.write_text(text, encoding="utf-8")
