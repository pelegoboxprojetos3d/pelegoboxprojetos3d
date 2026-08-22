from pathlib import Path

path = Path('src/backend/http-functions.js')
text = path.read_text(encoding='utf-8')
marker = 'REMARKETING_UNSUBSCRIBE_PAGE_V1'
if marker in text:
    print('Página já existe')
    raise SystemExit(0)

block = r'''

// ======================================================
// REMARKETING_UNSUBSCRIBE_PAGE_V1
// Página pública: /_functions/descadastrarRemarketing
// ======================================================

function escapeHtmlRemarketing(value) {
  return safe(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function get_descadastrarRemarketing(request) {
  const email = normalizeEmail(request?.query?.email);
  const memberId = safe(request?.query?.member_id);
  const nome = safe(request?.query?.nome) || "Cliente";
  const hook = safe(request?.query?.hook);

  const emailHtml = escapeHtmlRemarketing(email || "E-mail não informado");
  const nomeHtml = escapeHtmlRemarketing(nome);

  const page = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Descadastrar e-mails | PELEGO BOX</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#171d22;font-family:Arial,Helvetica,sans-serif}.wrap{max-width:640px;margin:0 auto;padding:24px 14px 50px}.card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;overflow:hidden;box-shadow:0 10px 35px rgba(0,0,0,.07)}.logo{padding:28px 26px 12px;text-align:center}.logo img{display:block;width:250px;max-width:100%;height:auto;margin:0 auto}.line{height:1px;background:#e8ebef;margin:4px 28px 0}.body{padding:24px 30px 32px}h1{margin:0 0 10px;font-size:27px;line-height:1.18;color:#111820}p{margin:0 0 16px;color:#626d78;line-height:1.55}.who{background:#f7f8f9;border:1px solid #e5e8eb;border-radius:12px;padding:15px 16px;margin:18px 0}.who b{display:block;margin-bottom:4px;color:#171d22}.who span{overflow-wrap:anywhere;color:#596273}label{display:block;font-weight:800;font-size:13px;margin:18px 0 7px;color:#252b31}select,textarea{width:100%;border:1px solid #ccd2d8;border-radius:10px;padding:13px;font:inherit;background:#fff;color:#222}textarea{min-height:110px;resize:vertical}.btn{width:100%;border:0;border-radius:11px;background:#111;color:#fff;font-weight:900;font-size:15px;padding:16px 14px;margin-top:20px;cursor:pointer}.btn:disabled{opacity:.55;cursor:not-allowed}.note{font-size:12px;color:#7b858f;text-align:center;margin:12px 0 0}.msg{display:none;margin-top:16px;border-radius:11px;padding:14px;font-weight:700;line-height:1.45}.ok{background:#edf8f1;color:#176a39;border:1px solid #bde0c9}.err{background:#fff1f1;color:#9f1d1d;border:1px solid #efbcbc}@media(max-width:520px){.wrap{padding:10px}.body{padding:20px 18px 26px}.logo{padding:22px 18px 10px}h1{font-size:23px}}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="logo"><img src="https://static.wixstatic.com/media/354683_9ff215ccea8743c694cd947f8ab0c73e~mv2.png" alt="PELEGO BOX"></div>
  <div class="line"></div>
  <div class="body">
    <h1>Quer parar de receber nossos e-mails?</h1>
    <p>Sem labirinto. Confirme abaixo e seu e-mail entra na lista de bloqueio do remarketing.</p>
    <div class="who"><b>${nomeHtml}</b><span>${emailHtml}</span></div>
    <form id="form">
      <label for="motivo">Por que você quer sair?</label>
      <select id="motivo" required>
        <option value="">Selecione um motivo</option>
        <option>Não tenho mais interesse</option>
        <option>Já comprei o que precisava</option>
        <option>Estou recebendo e-mails demais</option>
        <option>O conteúdo não é relevante para mim</option>
        <option>Outro motivo</option>
      </select>
      <label for="detalhe">Quer deixar algum comentário? <span style="font-weight:400">(opcional)</span></label>
      <textarea id="detalhe" placeholder="Escreva aqui, se quiser."></textarea>
      <button id="btn" class="btn" type="submit">CONFIRMAR DESCADASTRAMENTO</button>
      <p class="note">A confirmação vale para este fluxo de remarketing da PELEGO BOX.</p>
      <div id="ok" class="msg ok">Pronto. Seu e-mail foi descadastrado.</div>
      <div id="err" class="msg err"></div>
    </form>
  </div>
</div></div>
<script>
const email=${JSON.stringify(email)};
const memberId=${JSON.stringify(memberId)};
const nome=${JSON.stringify(nome)};
const hook=${JSON.stringify(hook)};
const form=document.getElementById('form');
const btn=document.getElementById('btn');
const okBox=document.getElementById('ok');
const errBox=document.getElementById('err');
form.addEventListener('submit',async(ev)=>{
  ev.preventDefault();okBox.style.display='none';errBox.style.display='none';
  const motivo=document.getElementById('motivo').value.trim();
  const detalhe=document.getElementById('detalhe').value.trim();
  if(!email||!motivo){errBox.textContent='Faltou o e-mail ou o motivo.';errBox.style.display='block';return;}
  btn.disabled=true;btn.textContent='PROCESSANDO...';
  try{
    const r=await fetch('/_functions/descadastrarRemarketingSubmit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,member_id:memberId,nome,motivo,detalhe,hook,origem:'remarketing_projetos_prontos'})});
    const data=await r.json();
    if(!r.ok||!data.ok) throw new Error(data.error||'Falha ao descadastrar');
    form.querySelector('select').disabled=true;form.querySelector('textarea').disabled=true;btn.style.display='none';okBox.style.display='block';
  }catch(e){errBox.textContent=e.message||'Não foi possível concluir agora.';errBox.style.display='block';btn.disabled=false;btn.textContent='CONFIRMAR DESCADASTRAMENTO';}
});
</script>
</body></html>`;

  return ok({
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: page
  });
}

export async function post_descadastrarRemarketingSubmit(request) {
  try {
    const data = await readJsonBody(request);
    const email = normalizeEmail(data?.email);
    const motivo = safe(data?.motivo);
    const hook = safe(data?.hook);

    if (!email || !motivo) {
      return badRequest({
        headers: { "Content-Type": "application/json" },
        body: { ok: false, error: "E-mail e motivo são obrigatórios." }
      });
    }

    if (!/^https:\/\/hook\.(?:us\d+\.)?make\.com\//i.test(hook)) {
      return badRequest({
        headers: { "Content-Type": "application/json" },
        body: { ok: false, error: "Descadastro ainda não configurado." }
      });
    }

    const response = await fetch(hook, {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        member_id: safe(data?.member_id),
        nome: safe(data?.nome),
        motivo,
        detalhe: safe(data?.detalhe),
        origem: safe(data?.origem) || "remarketing_projetos_prontos"
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook respondeu ${response.status}`);
    }

    return ok({headers:{"Content-Type":"application/json"},body:{ok:true}});
  } catch (error) {
    return serverError({headers:{"Content-Type":"application/json"},body:{ok:false,error:safe(error?.message)||"descadastro_error"}});
  }
}
'''

path.write_text(text.rstrip() + block + '\n', encoding='utf-8')
print('Página adicionada ao http-functions.js')
