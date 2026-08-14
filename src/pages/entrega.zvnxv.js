import wixLocation from 'wix-location';
import wixData from 'wix-data';
/* =========================
   ENTREGA — PADRÃO FIFA R19.11
   ✔ token segurança
   ✔ nome cliente
   ✔ parse items
   ✔ check oculto
   ✔ check aparece verde ao clicar
   ✔ suporta múltiplos PDFs para o mesmo ML
   ✔ _id único no Repeater para ML duplicado
   ========================= */

function safe(v){
  return String(v ?? '').trim();
}

function stripQuotes(s){
  return safe(s).replace(/^"+|"+$/g,'');
}

function looksLikeDeliveryId(id){
  return /^\d{10,}$/.test(stripQuotes(id));
}

function nomePuro(s){
  const t = safe(s);
  const pos = t.indexOf(' ML ');
  if(pos>=0){
    return t.slice(0,pos).trim();
  }
  return t;
}

function setEmpty(msg){
  $w('#txtTitulo').text = msg;
  $w('#repEntregas').data = [];
}

function deepText(any){
  try{
    if(any===null || any===undefined) return '';
    if(typeof any === 'string') return any;
    if(typeof any === 'number' || typeof any === 'boolean') return String(any);

    if(Array.isArray(any)){
      return any.map(deepText).join(' ');
    }

    if(typeof any === 'object'){
      if(typeof any.text === 'string') return any.text;
      if(typeof any.html === 'string') return any.html;

      let out='';

      for(const k of Object.keys(any)){
        out+=' '+deepText(any[k]);
      }

      return out.trim();
    }

    return String(any);

  }catch(_){
    return '';
  }
}

function safeParseItems(v){
  try{

    if(Array.isArray(v)) return v;

    let s = deepText(v);

    s = safe(s);

    if(!s) return [];

    s = s.replace(/<[^>]*>/g,' ').trim();

    s = s
      .replace(/&quot;/g,'"')
      .replace(/&#34;/g,'"')
      .replace(/&apos;/g,"'")
      .replace(/&#39;/g,"'")
      .replace(/&amp;/g,'&')
      .replace(/&lt;/g,'<')
      .replace(/&gt;/g,'>');

    const iArr = s.indexOf('[');
    const fArr = s.lastIndexOf(']');

    if(iArr>=0 && fArr>iArr){
      s = s.slice(iArr,fArr+1);
    }

    if(!s.startsWith('[') && s.startsWith('{') && s.endsWith('}')){
      s = `[${s}]`;
    }

    const parsed = JSON.parse(s);

    return Array.isArray(parsed) ? parsed : [];

  }catch(_){
    return [];
  }
}

function normalizeItems(items){

  return (items||[])
  .map((it,idx)=>{

    const ml = safe(it?.ml ?? it?.value);

    const pdfUrl = safe(
      it?.pdfUrl ??
      it?.pdf ??
      it?.linkPdf
    );

    const ytUrl = safe(
      it?.ytUrl ??
      it?.yt ??
      it?.youtube ??
      it?.linkYt
    );

    return{
      _id:`ml_${ml}_${idx}`,
      ml,
      pdfUrl,
      ytUrl
    };

  })
  .filter(x=>x.ml);

}

async function findAllByDeliveryId(deliveryIdRaw){

  const deliveryIdStr = stripQuotes(deliveryIdRaw);

  const deliveryIdNum = Number(deliveryIdStr);

  const deliveryIdQuoted = `"${deliveryIdStr}"`;

  let q = wixData.query('Entregas')
  .eq('deliveryId',deliveryIdStr)
  .or(
    wixData.query('Entregas')
    .eq('deliveryId',deliveryIdQuoted)
  );

  if(!Number.isNaN(deliveryIdNum)){

    q = q.or(
      wixData.query('Entregas')
      .eq('deliveryId',deliveryIdNum)
    );

  }

  const r = await q.limit(1000).find();

  return r.items || [];

}

async function getEntregaPack(idRaw){

  const id = stripQuotes(idRaw);

  if(looksLikeDeliveryId(id)){

    const group = await findAllByDeliveryId(id);

    return group.length ? {items:group} : null;

  }

  try{

    const item = await wixData.get('Entregas',id);

    if(!item) throw new Error('not-found');

    const d = item?.deliveryId;

    if(d!==undefined && d!==null && safe(d)!==''){

      const group = await findAllByDeliveryId(d);

      if(group.length){
        return {items:group};
      }

    }

    return {items:[item]};

  }catch(_){

    const group = await findAllByDeliveryId(id);

    return group.length ? {items:group} : null;

  }

}

$w.onReady(async()=>{

  try{

    $w('#repEntregas').data = [];

    const idFromUrl = wixLocation.query.id;
    const tokenFromUrl = wixLocation.query.token;

    if(!idFromUrl || !tokenFromUrl){
      setEmpty('Entrega não encontrada.');
      return;
    }

    const pack = await getEntregaPack(idFromUrl);

    if(!pack || !pack.items?.length){
      setEmpty('Entrega não encontrada.');
      return;
    }

    const first = pack.items[0];

    if(safe(first?.tokenEntrega) !== safe(tokenFromUrl)){
      setEmpty('Entrega não encontrada.');
      return;
    }

    const cliente = nomePuro(first?.cliente) || 'Cliente';

    $w('#txtTitulo').text =
    `${cliente}, segue abaixo a lista com todos os seus projetos em PDF e todos os seus VÍDEOS. É só clicar no botão.`;

    const all=[];

    for(const row of pack.items){

      const raw = row?.itemsJson;

      if(!raw) continue;

      all.push(...safeParseItems(raw));

    }

    // ALTERAÇÃO: não remove mais ML repetido
    const rows = normalizeItems(all);

    if(!rows.length){
      setEmpty('Entrega encontrada, mas itemsJson veio vazio.');
      return;
    }

    $w('#repEntregas').data = rows;

    $w('#repEntregas').onItemReady(($item,itemData)=>{

      $item('#txtMl').text = `ML ${itemData.ml}`;

      if($item('#checkPdf')){
        $item('#checkPdf').checked = false;
        $item('#checkPdf').hide();
      }

      if($item('#checkVideo')){
        $item('#checkVideo').checked = false;
        $item('#checkVideo').hide();
      }

      if(itemData.pdfUrl){

        $item('#btnPdf').link = itemData.pdfUrl;
        $item('#btnPdf').target="_blank";
        $item('#btnPdf').show();

        $item('#btnPdf').onClick(()=>{

          if($item('#checkPdf')){
            $item('#checkPdf').checked = true;
            $item('#checkPdf').show('fade');
          }

        });

      }else{

        $item('#btnPdf').hide();

      }

      if(itemData.ytUrl){

        $item('#btnVideo').link = itemData.ytUrl;
        $item('#btnVideo').target="_blank";
        $item('#btnVideo').show();

        $item('#btnVideo').onClick(()=>{

          if($item('#checkVideo')){
            $item('#checkVideo').checked = true;
            $item('#checkVideo').show('fade');
          }

        });

      }else{

        $item('#btnVideo').hide();

      }

    });

  }catch(e){

    setEmpty('ERRO NO CÓDIGO: '+(e?.message || e));

  }

});