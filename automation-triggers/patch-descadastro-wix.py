from pathlib import Path

path = Path('src/backend/http-functions.js')
text = path.read_text(encoding='utf-8')

start = '// ======================================================\n// REMARKETING_UNSUBSCRIBE_PAGE_V1'
end = 'export async function post_descadastrarRemarketingSubmit(request) {'

if 'REMARKETING_UNSUBSCRIBE_PAGE_V2' in text:
    print('Layout V2 já aplicado')
    raise SystemExit(0)

if start not in text or end not in text:
    raise SystemExit('Bloco atual de descadastro não encontrado')

block = r'''// ======================================================
// REMARKETING_UNSUBSCRIBE_PAGE_V2
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

  const emailHtml = escapeHtmlRemarketing(email || "E-mail não informado");
  const nomeHtml = escapeHtmlRemarketing(nome);

  const page = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#15191e">
<title>Preferências de e-mail | PELEGO BOX</title>
<style>
:root{--ink:#171b20;--muted:#69737d;--line:#e4e8ec;--soft:#f6f7f9;--brand:#bd333d;--brand2:#9f252e;--green:#167a46;--greenbg:#edf8f2}
*{box-sizing:border-box}
html,body{min-height:100%;margin:0}
body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:radial-gradient(circle at 12% 8%,rgba(189,51,61,.09),transparent 30%),linear-gradient(180deg,#fbfbfc 0%,#f1f3f5 100%);-webkit-font-smoothing:antialiased}
.shell{min-height:100vh;display:grid;place-items:center;padding:28px 16px}
.card{width:min(100%,680px);background:#fff;border:1px solid rgba(15,23,42,.08);border-radius:24px;box-shadow:0 26px 75px rgba(20,25,32,.13);overflow:hidden}
.top{padding:27px 30px 21px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:20px}
.logo{display:block;width:205px;max-width:50%;height:auto}
.dots{display:flex;align-items:center;gap:7px}.dot{width:9px;height:9px;border-radius:50%;background:#d8dde2}.dot.active{width:27px;border-radius:99px;background:var(--brand)}
.content{padding:30px}
.kicker{margin-bottom:8px;color:var(--brand);font-size:12px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
h1{margin:0 0 10px;font-size:30px;line-height:1.14;letter-spacing:-.025em;color:#15191e}
.lead{margin:0;color:var(--muted);font-size:15px;line-height:1.58}
.person{margin:23px 0;padding:16px 17px;background:var(--soft);border:1px solid var(--line);border-radius:15px}.person small{display:block;margin-bottom:4px;color:#8b949d;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.person strong{display:block;font-size:16px}.person span{display:block;margin-top:3px;color:#68727c;font-size:14px;overflow-wrap:anywhere}
.title{margin:0 0 11px;font-size:14px;font-weight:900}.reasons{display:grid;gap:9px}.reason{position:relative}.reason input{position:absolute;opacity:0;pointer-events:none}.reason label{display:flex;align-items:center;gap:12px;padding:14px 15px;border:1.5px solid #dfe3e8;border-radius:13px;background:#fff;color:#3b4249;font-size:14px;font-weight:700;cursor:pointer;transition:.16s ease}.circle{width:20px;height:20px;flex:0 0 auto;border:2px solid #bcc4cc;border-radius:50%;display:grid;place-items:center}.circle:after{content:"";width:10px;height:10px;border-radius:50%;background:var(--brand);transform:scale(0);transition:.14s}.reason input:checked+label{border-color:rgba(189,51,61,.55);background:#fff8f8;box-shadow:0 0 0 3px rgba(189,51,61,.07)}.reason input:checked+label .circle{border-color:var(--brand)}.reason input:checked+label .circle:after{transform:scale(1)}
.field{margin-top:21px}.field label{display:block;margin-bottom:8px;font-size:14px;font-weight:900}.field em{font-style:normal;color:#929aa2;font-weight:500}textarea{width:100%;min-height:112px;resize:vertical;border:1.5px solid #dfe3e8;border-radius:13px;padding:14px 15px;background:#fff;color:#242a30;font:inherit;outline:none;transition:.16s}textarea:focus{border-color:#9da7b0;box-shadow:0 0 0 3px rgba(17,24,39,.05)}
.error{display:none;margin-top:16px;padding:14px 15px;border:1px solid #efc1c1;border-radius:12px;background:#fff2f2;color:#9f2626;font-size:13px;font-weight:800;line-height:1.45}
.actions{display:flex;align-items:center;gap:10px;margin-top:22px}.back{padding:12px;color:#6b747d;font-size:13px;font-weight:800;text-decoration:none}.btn{flex:1;min-height:50px;border:0;border-radius:13px;padding:15px 19px;background:linear-gradient(180deg,var(--brand),var(--brand2));box-shadow:0 8px 20px rgba(189,51,61,.23);color:#fff;font-size:14px;font-weight:900;letter-spacing:.02em;cursor:pointer;transition:.16s}.btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(189,51,61,.28)}.btn:disabled{opacity:.6;cursor:wait;transform:none}
.privacy{margin:15px 0 0;text-align:center;color:#969ea6;font-size:11px;line-height:1.5}
.success{display:none;text-align:center;padding:11px 0 3px}.check{width:58px;height:58px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:var(--greenbg);color:var(--green);font-size:30px;font-weight:900}.success h2{margin:0 0 8px;font-size:25px}.success p{margin:0;color:var(--muted);font-size:15px;line-height:1.55}.success .btn{display:block;margin-top:24px;text-decoration:none}
@media(max-width:560px){.shell{padding:10px}.card{border-radius:18px}.top{padding:20px 18px 17px}.logo{width:175px;max-width:60%}.content{padding:23px 18px 25px}h1{font-size:26px}.reason label{padding:13px}.actions{flex-direction:column}.btn,.back{width:100%;text-align:center}.dots{gap:5px}.dot{width:8px;height:8px}.dot.active{width:22px}}
</style>
</head>
<body>
<div class="shell">
  <main class="card">
    <header class="top">
      <img class="logo" src="https://static.wixstatic.com/media/354683_9ff215ccea8743c694cd947f8ab0c73e~mv2.png" alt="PELEGO BOX">
      <div class="dots" aria-label="Preferências"><span class="dot active"></span><span class="dot"></span><span class="dot"></span></div>
    </header>

    <section class="content">
      <div id="formArea">
        <div class="kicker">Preferências de comunicação</div>
        <h1>Quer parar de receber estes e-mails?</h1>
        <p class="lead">Escolha um motivo abaixo e confirme. Seu endereço será incluído na lista de bloqueio deste remarketing.</p>

        <div class="person">
          <small>Solicitação para</small>
          <strong>${nomeHtml}</strong>
          <span>${emailHtml}</span>
        </div>

        <form id="form">
          <p class="title">Qual o principal motivo?</p>
          <div class="reasons">
            <div class="reason"><input type="radio" name="motivo" id="m1" value="Não tenho mais interesse"><label for="m1"><span class="circle"></span><span>Não tenho mais interesse</span></label></div>
            <div class="reason"><input type="radio" name="motivo" id="m2" value="Já comprei o que precisava"><label for="m2"><span class="circle"></span><span>Já comprei o que precisava</span></label></div>
            <div class="reason"><input type="radio" name="motivo" id="m3" value="Estou recebendo e-mails demais"><label for="m3"><span class="circle"></span><span>Estou recebendo e-mails demais</span></label></div>
            <div class="reason"><input type="radio" name="motivo" id="m4" value="O conteúdo não é relevante para mim"><label for="m4"><span class="circle"></span><span>O conteúdo não é relevante para mim</span></label></div>
            <div class="reason"><input type="radio" name="motivo" id="m5" value="Outro motivo"><label for="m5"><span class="circle"></span><span>Outro motivo</span></label></div>
          </div>

          <div class="field">
            <label for="detalhe">Quer deixar uma mensagem? <em>(opcional)</em></label>
            <textarea id="detalhe" maxlength="700" placeholder="Digite sua mensagem aqui..."></textarea>
          </div>

          <div id="err" class="error"></div>
          <div class="actions">
            <a class="back" href="https://www.pelegobox.com.br/">VOLTAR AO SITE</a>
            <button id="btn" class="btn" type="submit">ENVIAR E DESCADASTRAR</button>
          </div>
          <p class="privacy">Seu e-mail será usado apenas para registrar esta preferência e impedir novos envios deste remarketing.</p>
        </form>
      </div>

      <div id="success" class="success">
        <div class="check">✓</div>
        <h2>Descadastro confirmado</h2>
        <p>Pronto. <strong>${emailHtml}</strong> foi colocado na lista de bloqueio deste remarketing.</p>
        <a class="btn" href="https://www.pelegobox.com.br/">VOLTAR AO SITE</a>
      </div>
    </section>
  </main>
</div>
<script>
const email=${JSON.stringify(email)};
const memberId=${JSON.stringify(memberId)};
const nome=${JSON.stringify(nome)};
const form=document.getElementById('form');
const btn=document.getElementById('btn');
const errBox=document.getElementById('err');
const formArea=document.getElementById('formArea');
const success=document.getElementById('success');

form.addEventListener('submit',async(ev)=>{
  ev.preventDefault();
  errBox.style.display='none';
  const selected=document.querySelector('input[name="motivo"]:checked');
  const motivo=selected?selected.value:'';
  const detalhe=document.getElementById('detalhe').value.trim();

  if(!email){errBox.textContent='Não encontramos o e-mail desta solicitação.';errBox.style.display='block';return;}
  if(!motivo){errBox.textContent='Escolha um motivo antes de enviar.';errBox.style.display='block';return;}

  btn.disabled=true;
  btn.textContent='ENVIANDO...';

  try{
    const r=await fetch('/_functions/descadastrarRemarketingSubmit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,member_id:memberId,nome,motivo,detalhe,origem:'remarketing_projetos_prontos'})
    });

    let data={};
    try{data=await r.json();}catch(_e){}
    if(!r.ok||!data.ok)throw new Error(data.error||'Não foi possível concluir o descadastro.');

    formArea.style.display='none';
    success.style.display='block';
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){
    errBox.textContent=e.message||'Não foi possível concluir agora.';
    errBox.style.display='block';
    btn.disabled=false;
    btn.textContent='ENVIAR E DESCADASTRAR';
  }
});
</script>
</body>
</html>`;

  return ok({
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: page
  });
}

'''

before, tail = text.split(start, 1)
_, after = tail.split(end, 1)
updated = before + block + end + after
path.write_text(updated, encoding='utf-8')
print('Layout profissional V2 aplicado ao http-functions.js')
