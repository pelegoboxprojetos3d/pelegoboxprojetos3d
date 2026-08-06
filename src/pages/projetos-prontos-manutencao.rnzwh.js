import { testarAutenticacaoValidaPay } from "backend/validaPayProjetosProntos.jsw";

$w.onReady(async () => {
  console.log("INICIANDO TESTE VALIDAPAY...");

  try {
    const resultado = await testarAutenticacaoValidaPay();

    if (resultado?.ok === true) {
      console.log("TESTE VALIDAPAY OK:", JSON.stringify(resultado, null, 2));
      return;
    }

    console.error("TESTE VALIDAPAY RECUSADO:", resultado?.error || resultado);
  } catch (erro) {
    console.error("ERRO TESTE VALIDAPAY:", erro?.message || erro);
  }
});