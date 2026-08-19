(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.PelegoRadioPersistent?.version === '2.0.0') return;

  const VERSION = '2.0.0';
  const CHANNEL_NAME = 'pelego-radio-persistent-v2';
  const STORAGE_KEY = 'pelego_radio_persistent_state_v2';
  const PLAYER_NAME = 'PELEGO_RADIO_PLAYER_V2';
  const MINI_ID = 'pelego-radio-mini-player-v2';
  const RADIO_PATH = '/radiopelegobox';
  const EQ_FREQS = [40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,6300,10000,16000];

  let playerWindow = null;
  let stations = [];
  let playlist = [];
  let config = {
    volume: 32,
    eqGains: Array(24).fill(0),
    randomMode: 'TEMPO',
    randomTimeMinutes: 30,
    crossfadeSeconds: 2,
  };
  let lastSpectrum = new Uint8Array(1024);

  function safeParse(raw, fallback = {}) {
    try { return { ...fallback, ...JSON.parse(String(raw || '{}')) }; }
    catch (_) { return { ...fallback }; }
  }

  const stored = safeParse(localStorage.getItem(STORAGE_KEY), {});
  let remote = {
    currentStation: stored.currentStation || null,
    playing: !!stored.playing,
    paused: stored.playing === false,
    currentTime: Number(stored.currentTime || 0),
    volume: Number(stored.volume ?? 32),
    server: Number(stored.server || 5),
    sessionStarted: !!stored.sessionStarted,
    heartbeat: Number(stored.heartbeat || 0),
    sampleRate: Number(stored.sampleRate || 44100),
    error: '',
  };

  if (!remote.heartbeat || Date.now() - remote.heartbeat > 15000) {
    remote.playing = false;
    remote.paused = true;
    remote.sessionStarted = false;
  }

  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;

  class AudioProxy extends EventTarget {
    get paused() { return !remote.playing; }
    get src() { return remote.currentStation?.id ? `persistent://${remote.currentStation.id}` : ''; }
    get currentTime() { return Number(remote.currentTime || 0); }
    get ended() { return false; }
    get volume() { return Math.max(0, Math.min(1, Number(remote.volume || 0) / 100)); }
    set volume(value) { setVolume(Number(value || 0) * 100); }
    play() { return toggle(); }
    pause() { if (remote.playing) sendCommand({ type: 'PAUSE' }); }
    load() {}
    removeAttribute() {}
    setSinkId(id) { return setOutputDevice(id); }
  }

  const audioProxy = new AudioProxy();
  const audioCtxProxy = {
    get sampleRate() { return Number(remote.sampleRate || 44100); },
    get state() { return remote.playing ? 'running' : 'suspended'; },
    get currentTime() { return Number(remote.currentTime || 0); },
    resume() { return Promise.resolve(); },
  };
  const analyserProxy = {
    fftSize: 2048,
    smoothingTimeConstant: .72,
    frequencyBinCount: 1024,
    getByteFrequencyData(target) {
      if (!target?.length) return;
      if (!lastSpectrum?.length) { target.fill(0); return; }
      const source = lastSpectrum;
      for (let i = 0; i < target.length; i++) {
        const idx = Math.min(source.length - 1, Math.floor(i * source.length / target.length));
        target[i] = source[idx] || 0;
      }
    },
  };
  const gainNodeProxy = { gain: { value: Math.max(.0001, remote.volume / 100) } };

  function normalizedPath() {
    return (window.location.pathname || '/').toLowerCase().replace(/\/$/, '') || '/';
  }

  function persistRemote() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentStation: remote.currentStation || null,
        playing: !!remote.playing,
        currentTime: Number(remote.currentTime || 0),
        volume: Number(remote.volume ?? 32),
        server: Number(remote.server || 5),
        sessionStarted: !!remote.sessionStarted,
        heartbeat: Number(remote.heartbeat || Date.now()),
        sampleRate: Number(remote.sampleRate || 44100),
      }));
    } catch (_) {}
  }

  function snapshot() {
    return {
      currentStation: remote.currentStation ? { ...remote.currentStation } : null,
      paused: !remote.playing,
      playing: !!remote.playing,
      currentTime: Number(remote.currentTime || 0),
      volume: Number(remote.volume ?? 32),
      server: Number(remote.server || 5),
      sessionStarted: !!remote.sessionStarted,
      audioCtx: audioCtxProxy,
      analyser: analyserProxy,
      filters: [],
      gainNode: gainNodeProxy,
    };
  }

  function applyRemote(next = {}, spectrum = null) {
    const wasPlaying = !!remote.playing;
    const oldStationId = remote.currentStation?.id || '';
    remote = {
      ...remote,
      ...next,
      currentStation: next.currentStation === undefined ? remote.currentStation : next.currentStation,
      heartbeat: Number(next.heartbeat || Date.now()),
    };
    remote.paused = !remote.playing;
    gainNodeProxy.gain.value = Math.max(.0001, Number(remote.volume || 0) / 100);

    if (spectrum && typeof spectrum.length === 'number') {
      lastSpectrum = spectrum instanceof Uint8Array ? spectrum : new Uint8Array(spectrum);
    }

    persistRemote();
    renderMini();

    const newStationId = remote.currentStation?.id || '';
    if (!wasPlaying && remote.playing) audioProxy.dispatchEvent(new Event('playing'));
    if (wasPlaying && !remote.playing) audioProxy.dispatchEvent(new Event('pause'));
    if (oldStationId !== newStationId && newStationId) audioProxy.dispatchEvent(new Event('loadedmetadata'));
    audioProxy.dispatchEvent(new Event('timeupdate'));
    if (remote.error) audioProxy.dispatchEvent(new Event('error'));

    window.dispatchEvent(new CustomEvent('pelego-radio-state', { detail: snapshot() }));
  }

  function sendChannel(message) {
    try {
      channel?.postMessage({ source: 'controller', ...message });
      return !!channel;
    } catch (_) { return false; }
  }

  function sendCommand(message) {
    try {
      if (playerWindow && !playerWindow.closed && typeof playerWindow.pelegoRadioCommand === 'function') {
        playerWindow.pelegoRadioCommand({ source: 'controller', ...message });
        return true;
      }
    } catch (_) {}
    return sendChannel(message);
  }

  function popupHtml() {
    const channelName = JSON.stringify(CHANNEL_NAME);
    const storageKey = JSON.stringify(STORAGE_KEY);
    const eqFreqs = JSON.stringify(EQ_FREQS);
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PELEGO RADIO</title>
<style>
html,body{margin:0;width:100%;height:100%;background:#020605;color:#fff;font-family:Arial,Helvetica,sans-serif;overflow:hidden}*{box-sizing:border-box}
.wrap{height:100%;padding:12px;background:radial-gradient(circle at 50% 0,rgba(25,239,93,.12),transparent 48%),#020605}.card{height:100%;border:1px solid #18df58;border-radius:14px;background:linear-gradient(180deg,#07130d,#020704);padding:13px;box-shadow:0 0 22px rgba(24,223,88,.10) inset}.top{display:flex;align-items:center;justify-content:space-between;gap:10px}.brand{color:#20ef64;font-weight:900;font-size:14px;letter-spacing:.5px}.live{font-size:9px;color:#aebcb4}.name{margin-top:10px;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.genre{margin-top:3px;font-size:10px;color:#b7c1bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.controls{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:11px}.controls button{height:34px;border:1px solid #365044;border-radius:8px;background:#0b1510;color:#fff;font-weight:800;cursor:pointer}.controls .play{background:linear-gradient(#0fc14a,#087f31);border-color:#18e45a}.controls .stop{background:linear-gradient(#cf302a,#911c18);border-color:#ef4b43}.vol{display:grid;grid-template-columns:18px minmax(0,1fr) 34px;gap:7px;align-items:center;margin-top:10px}.vol input{width:100%;accent-color:#20ef64}.vol span{font-size:9px;text-align:right}.note{margin-top:8px;font-size:9px;color:#8fa098;text-align:center}.status{color:#20ef64}.tiny{font-size:8px;color:#79877f}
</style></head><body><div class="wrap"><div class="card"><div class="top"><div class="brand">♫ PELEGO RADIO</div><div><span class="status">● ONLINE</span> <span class="live">PLAYER CONTÍNUO</span></div></div><div class="name" id="name">Preparando rádio...</div><div class="genre" id="genre">Você pode navegar pelo site sem interromper o som.</div><div class="controls"><button class="play" id="toggle">▶ TOCAR</button><button id="next">PRÓXIMA ▶</button><button class="stop" id="stop">■ PARAR</button></div><div class="vol"><span>🔊</span><input id="volume" type="range" min="0" max="50" value="32"><span id="volText">32%</span></div><div class="note">Mantenha esta pequena janela aberta enquanto navega pelo site.<br><span class="tiny">Ela é o motor que impede a música de parar na troca de páginas.</span></div><audio id="audio" crossorigin="anonymous" preload="none"></audio></div></div>
<script>
(() => {
  if (window.__PELEGO_RADIO_PLAYER_V2__) return;
  window.__PELEGO_RADIO_PLAYER_V2__ = true;
  const CHANNEL_NAME = ${channelName};
  const STORAGE_KEY = ${storageKey};
  const EQ_FREQS = ${eqFreqs};
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
  const audio = document.getElementById('audio');
  const ui = {name:document.getElementById('name'),genre:document.getElementById('genre'),toggle:document.getElementById('toggle'),next:document.getElementById('next'),stop:document.getElementById('stop'),volume:document.getElementById('volume'),volText:document.getElementById('volText')};
  let stations = [];
  let playlist = [];
  let state = {currentStation:null,server:5,volume:32,eqGains:Array(24).fill(0),randomMode:'TEMPO',randomTimeMinutes:30,crossfadeSeconds:2,sessionStarted:false};
  let audioCtx=null,sourceNode=null,filters=[],gainNode=null,analyser=null,randomTimer=null,tickTimer=null;

  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const streamUrl=(station,server=5)=>'https://ice'+server+'.somafm.com/'+station.id+'-128-mp3';
  const pickNext=()=>{const pool=(playlist.length?playlist:stations).filter(Boolean);if(!pool.length)return null;const available=state.currentStation&&pool.length>1?pool.filter(x=>x.id!==state.currentStation.id):pool;return available[Math.floor(Math.random()*available.length)]||pool[0]||null;};

  function safeStore(payload){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));}catch(_){}}
  function publicState(error=''){return {currentStation:state.currentStation?{...state.currentStation}:null,playing:!audio.paused&&!!audio.src,paused:audio.paused,currentTime:Number(audio.currentTime||0),volume:Number(state.volume||0),server:Number(state.server||5),sessionStarted:!!state.sessionStarted,heartbeat:Date.now(),sampleRate:Number(audioCtx?.sampleRate||44100),error};}
  function render(){ui.name.textContent=state.currentStation?.name||'PELEGO RADIO';ui.genre.textContent=state.currentStation?.genre||'Rádio pronta para tocar';ui.toggle.textContent=audio.paused?'▶ TOCAR':'❚❚ PAUSAR';ui.volume.value=String(state.volume);ui.volText.textContent=state.volume+'%';document.title=(audio.paused?'':'▶ ')+(state.currentStation?.name||'PELEGO RADIO');}
  function broadcast(error=''){const s=publicState(error);safeStore(s);render();let spectrum=null;if(analyser&&!audio.paused){spectrum=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(spectrum);}try{channel?.postMessage({source:'player',type:'STATE',state:s,spectrum});}catch(_){}}

  async function ensureGraph(){if(audioCtx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC){audio.volume=state.volume/100;return;}audioCtx=new AC();sourceNode=audioCtx.createMediaElementSource(audio);let prev=sourceNode;filters=EQ_FREQS.map((freq,i)=>{const f=audioCtx.createBiquadFilter();f.type='peaking';f.frequency.value=freq;f.Q.value=1.05;f.gain.value=Number(state.eqGains[i]||0);prev.connect(f);prev=f;return f;});gainNode=audioCtx.createGain();gainNode.gain.value=state.volume/100;prev.connect(gainNode);analyser=audioCtx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.72;gainNode.connect(analyser);analyser.connect(audioCtx.destination);}
  async function fadeTo(target,seconds=0){const value=clamp(target,0,1);if(!gainNode||!audioCtx){audio.volume=value;return;}const now=audioCtx.currentTime;gainNode.gain.cancelScheduledValues(now);gainNode.gain.setValueAtTime(gainNode.gain.value,now);gainNode.gain.linearRampToValueAtTime(Math.max(.0001,value),now+Math.max(.01,Number(seconds)||0));await new Promise(r=>setTimeout(r,Math.max(10,(Number(seconds)||0)*1000)));}
  function scheduleRandom(){clearTimeout(randomTimer);if(audio.paused||state.randomMode!=='TEMPO')return;const min=Math.max(1,Number(state.randomTimeMinutes||30));randomTimer=setTimeout(()=>next(),min*60000);}
  async function playStation(station,server=5){if(!station?.id)return false;try{await ensureGraph();if(audioCtx?.state==='suspended')await audioCtx.resume();await fadeTo(0,.01);state.currentStation={...station};state.server=server;state.sessionStarted=true;audio.src=streamUrl(state.currentStation,state.server);audio.load();broadcast();await audio.play();await fadeTo(state.volume/100,Math.max(.15,Number(state.crossfadeSeconds||0)));scheduleRandom();broadcast();return true;}catch(err){broadcast(String(err?.message||'Não foi possível iniciar a rádio.'));return false;}}
  async function toggle(){if(!audio.paused){audio.pause();broadcast();return true;}if(audio.src&&state.currentStation){try{await ensureGraph();if(audioCtx?.state==='suspended')await audioCtx.resume();await audio.play();scheduleRandom();broadcast();return true;}catch(err){broadcast(String(err?.message||'Reprodução bloqueada.'));return false;}}const st=pickNext();return st?playStation(st,5):false;}
  async function next(){const st=pickNext();if(!st)return false;const sec=Math.max(0,Number(state.crossfadeSeconds||0));await fadeTo(0,sec/2);return playStation(st,5);}
  function stop(){clearTimeout(randomTimer);audio.pause();audio.removeAttribute('src');audio.load();state.currentStation=null;state.sessionStarted=false;broadcast();}
  function setVolume(value){state.volume=clamp(value,0,50);if(gainNode)gainNode.gain.value=state.volume/100;else audio.volume=state.volume/100;broadcast();}
  function setEqGains(values){if(!Array.isArray(values)||values.length!==24)return;state.eqGains=values.map(v=>clamp(v,-12,12));filters.forEach((f,i)=>{f.gain.value=state.eqGains[i];});}
  function setEqBand(index,value){if(index<0||index>=24)return;state.eqGains[index]=clamp(value,-12,12);if(filters[index])filters[index].gain.value=state.eqGains[index];}
  async function setOutputDevice(id){try{if(audioCtx&&typeof audioCtx.setSinkId==='function')await audioCtx.setSinkId(id||'');else if(typeof audio.setSinkId==='function')await audio.setSinkId(id||'');}catch(_){}}
  async function recover(){if(!state.currentStation)return;if(state.server===5)return playStation(state.currentStation,6);if(state.server===6)return playStation(state.currentStation,2);return next();}

  window.pelegoRadioCommand = function(cmd={}){switch(cmd.type){case 'INIT':stations=Array.isArray(cmd.stations)?cmd.stations.map(x=>({...x})):stations;playlist=Array.isArray(cmd.playlist)?cmd.playlist.map(x=>({...x})):playlist;if(cmd.config)applyConfig(cmd.config);broadcast();break;case 'REQUEST_STATE':broadcast();break;case 'SET_STATIONS':stations=Array.isArray(cmd.stations)?cmd.stations.map(x=>({...x})):[];break;case 'SET_PLAYLIST':playlist=Array.isArray(cmd.playlist)?cmd.playlist.map(x=>({...x})):[];break;case 'SET_CONFIG':applyConfig(cmd.config||{});break;case 'PLAY_STATION':playStation(cmd.station,cmd.server||5);break;case 'TOGGLE':toggle();break;case 'PAUSE':audio.pause();broadcast();break;case 'NEXT':next();break;case 'STOP':stop();break;case 'SET_VOLUME':setVolume(cmd.value);break;case 'SET_EQ_GAINS':setEqGains(cmd.values);break;case 'SET_EQ_BAND':setEqBand(Number(cmd.index),cmd.value);break;case 'SET_OUTPUT_DEVICE':setOutputDevice(cmd.id);break;}}
  function applyConfig(cfg={}){if(Number.isFinite(Number(cfg.volume)))setVolume(cfg.volume);if(Array.isArray(cfg.eqGains)&&cfg.eqGains.length===24)setEqGains(cfg.eqGains);if(cfg.randomMode)state.randomMode=cfg.randomMode;if(Number.isFinite(Number(cfg.randomTimeMinutes)))state.randomTimeMinutes=Number(cfg.randomTimeMinutes);if(Number.isFinite(Number(cfg.crossfadeSeconds)))state.crossfadeSeconds=Number(cfg.crossfadeSeconds);scheduleRandom();}

  channel?.addEventListener('message',event=>{const data=event.data||{};if(data.source==='controller')window.pelegoRadioCommand(data);});
  audio.addEventListener('playing',()=>{state.sessionStarted=true;scheduleRandom();broadcast();});
  audio.addEventListener('pause',broadcast);
  audio.addEventListener('loadedmetadata',broadcast);
  audio.addEventListener('error',()=>{recover().catch(()=>broadcast('Estação indisponível.'));});
  ui.toggle.addEventListener('click',toggle);ui.next.addEventListener('click',next);ui.stop.addEventListener('click',stop);ui.volume.addEventListener('input',e=>setVolume(e.target.value));
  tickTimer=setInterval(broadcast,500);
  window.addEventListener('beforeunload',()=>{clearInterval(tickTimer);clearTimeout(randomTimer);safeStore({...publicState(),playing:false,sessionStarted:false,heartbeat:0});try{channel?.postMessage({source:'player',type:'CLOSED'});}catch(_){}});
  render();broadcast();
})();
<\/script></body></html>`;
  }

  function bootstrapPlayer(win) {
    if (!win || win.closed) return false;
    try {
      if (win.__PELEGO_RADIO_PLAYER_V2__ && typeof win.pelegoRadioCommand === 'function') return true;
      win.document.open();
      win.document.write(popupHtml());
      win.document.close();
      return true;
    } catch (_) { return false; }
  }

  function preparePlayer() {
    try {
      if (!playerWindow || playerWindow.closed) {
        const width = 430;
        const height = 230;
        const left = Math.max(0, (window.screen?.availWidth || 1280) - width - 24);
        const top = Math.max(0, (window.screen?.availHeight || 800) - height - 70);
        playerWindow = window.open('', PLAYER_NAME, `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`);
      }
      if (!playerWindow || playerWindow.closed) return false;
      bootstrapPlayer(playerWindow);
      try { playerWindow.pelegoRadioCommand?.({ type: 'INIT', stations, playlist, config }); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  function mountMini() {
    if (document.getElementById(MINI_ID) || !document.body) return;
    const root = document.createElement('div');
    root.id = MINI_ID;
    root.innerHTML = `
      <style>
        #${MINI_ID}{position:fixed;left:16px;bottom:16px;z-index:2147482500;width:min(410px,calc(100vw - 32px));font-family:Arial,Helvetica,sans-serif;transition:opacity .2s ease,transform .2s ease}
        #${MINI_ID}.pb-hidden{opacity:0;pointer-events:none;transform:translateY(12px)}
        #${MINI_ID} .pb-mini{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;background:linear-gradient(180deg,#07130d,#020704);border:1px solid #18df58;border-radius:12px;padding:9px 10px;color:#fff;box-shadow:0 12px 28px rgba(0,0,0,.34),0 0 16px rgba(18,220,85,.08) inset}
        #${MINI_ID} .pb-logo{width:42px;height:42px;border-radius:9px;background:linear-gradient(180deg,#11b84a,#087b31);display:grid;place-items:center;color:#fff;font-size:21px;font-weight:900}
        #${MINI_ID} .pb-info{min-width:0}.pb-kicker{font-size:9px;color:#21ef66;font-weight:800;letter-spacing:.4px}.pb-name{margin-top:3px;font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pb-genre{margin-top:2px;font-size:9px;color:#b9c5be;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #${MINI_ID} .pb-actions{display:flex;align-items:center;gap:5px}.pb-actions button,.pb-actions a{height:32px;min-width:32px;border:1px solid #31473b;border-radius:7px;background:#0c1611;color:#fff;display:grid;place-items:center;text-decoration:none;cursor:pointer;font-size:13px;font-weight:800;padding:0 8px}.pb-actions button:hover,.pb-actions a:hover{border-color:#18df58}.pb-actions .pb-stop{color:#ff6963}.pb-actions .pb-open{color:#21ef66;font-size:10px}
        #${MINI_ID} .pb-volume{grid-column:2/4;display:grid;grid-template-columns:minmax(0,1fr) 32px;gap:7px;align-items:center;margin-top:-2px}.pb-volume input{width:100%;accent-color:#18df58}.pb-volume span{font-size:9px;color:#d5ddd8;text-align:right}
        @media(max-width:620px){#${MINI_ID}{left:8px;bottom:8px;width:calc(100vw - 16px)}#${MINI_ID} .pb-mini{grid-template-columns:36px minmax(0,1fr) auto;padding:7px 8px}.pb-logo{width:36px!important;height:36px!important}.pb-actions .pb-open{display:none}}
      </style>
      <div class="pb-mini">
        <div class="pb-logo">♫</div>
        <div class="pb-info"><div class="pb-kicker">PELEGO RADIO</div><div class="pb-name">Rádio pronta</div><div class="pb-genre">Continue ouvindo enquanto navega</div></div>
        <div class="pb-actions"><button class="pb-toggle" type="button" aria-label="Tocar ou pausar">❚❚</button><button class="pb-next" type="button" aria-label="Próxima estação">▶</button><button class="pb-stop" type="button" aria-label="Parar">■</button><a class="pb-open" href="${RADIO_PATH}">RÁDIO</a></div>
        <div class="pb-volume"><input class="pb-range" type="range" min="0" max="50" value="32" aria-label="Volume da rádio"><span class="pb-volume-value">32%</span></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.pb-toggle').addEventListener('click', () => toggle());
    root.querySelector('.pb-next').addEventListener('click', () => next());
    root.querySelector('.pb-stop').addEventListener('click', () => stop());
    root.querySelector('.pb-range').addEventListener('input', event => setVolume(event.target.value));
  }

  function renderMini() {
    mountMini();
    const root = document.getElementById(MINI_ID);
    if (!root) return;
    const fresh = remote.heartbeat && Date.now() - remote.heartbeat < 15000;
    const shouldShow = fresh && remote.sessionStarted && !!remote.currentStation && normalizedPath() !== RADIO_PATH;
    root.classList.toggle('pb-hidden', !shouldShow);
    const station = remote.currentStation;
    root.querySelector('.pb-name').textContent = station?.name || 'PELEGO RADIO';
    root.querySelector('.pb-genre').textContent = station?.genre || 'Rádio online';
    root.querySelector('.pb-toggle').textContent = remote.playing ? '❚❚' : '▶';
    root.querySelector('.pb-range').value = String(remote.volume ?? 32);
    root.querySelector('.pb-volume-value').textContent = `${Number(remote.volume ?? 32)}%`;
  }

  function setStations(value) {
    stations = Array.isArray(value) ? value.map(item => ({ ...item })) : [];
    sendCommand({ type: 'SET_STATIONS', stations });
  }

  function setPlaylist(value) {
    playlist = Array.isArray(value) ? value.map(item => ({ ...item })) : [];
    sendCommand({ type: 'SET_PLAYLIST', playlist });
  }

  function setConfig(value = {}) {
    config = { ...config, ...value };
    if (Number.isFinite(Number(value.volume))) config.volume = Number(value.volume);
    if (Array.isArray(value.eqGains) && value.eqGains.length === 24) config.eqGains = value.eqGains.slice();
    sendCommand({ type: 'SET_CONFIG', config });
  }

  function setVolume(value) {
    config.volume = Math.max(0, Math.min(50, Number(value) || 0));
    remote.volume = config.volume;
    gainNodeProxy.gain.value = Math.max(.0001, config.volume / 100);
    renderMini();
    sendCommand({ type: 'SET_VOLUME', value: config.volume });
  }

  function setEqGains(values) {
    if (!Array.isArray(values) || values.length !== 24) return;
    config.eqGains = values.slice();
    sendCommand({ type: 'SET_EQ_GAINS', values: config.eqGains });
  }

  function setEqBand(index, value) {
    if (!Array.isArray(config.eqGains) || config.eqGains.length !== 24) config.eqGains = Array(24).fill(0);
    config.eqGains[index] = Number(value || 0);
    sendCommand({ type: 'SET_EQ_BAND', index, value });
  }

  function ensureGraph() {
    preparePlayer();
    return Promise.resolve(snapshot());
  }

  function playStation(station, server = 5) {
    if (!station?.id) return Promise.resolve(false);
    if (!preparePlayer()) return Promise.resolve(false);
    remote.currentStation = { ...station };
    remote.sessionStarted = true;
    remote.playing = true;
    remote.paused = false;
    remote.server = server;
    remote.heartbeat = Date.now();
    persistRemote();
    renderMini();
    sendCommand({ type: 'PLAY_STATION', station: { ...station }, server });
    return Promise.resolve(true);
  }

  function toggle() {
    if (!preparePlayer()) return Promise.resolve(false);
    sendCommand({ type: 'TOGGLE' });
    return Promise.resolve(true);
  }

  function next() {
    if (!preparePlayer()) return Promise.resolve(false);
    sendCommand({ type: 'NEXT' });
    return Promise.resolve(true);
  }

  function stop() {
    sendCommand({ type: 'STOP' });
    applyRemote({ currentStation: null, playing: false, paused: true, sessionStarted: false, currentTime: 0, heartbeat: Date.now() });
  }

  function setCurrentStation(station, server = 5) {
    remote.currentStation = station ? { ...station } : null;
    remote.server = server;
    remote.sessionStarted = !!station;
    persistRemote();
    renderMini();
  }

  function setOutputDevice(id) {
    sendCommand({ type: 'SET_OUTPUT_DEVICE', id });
    return Promise.resolve();
  }

  channel?.addEventListener('message', event => {
    const data = event.data || {};
    if (data.source !== 'player') return;
    if (data.type === 'STATE') applyRemote(data.state || {}, data.spectrum || null);
    if (data.type === 'CLOSED') applyRemote({ playing: false, paused: true, sessionStarted: false, heartbeat: 0 });
  });

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const next = safeParse(event.newValue, {});
    if (next.heartbeat && next.heartbeat !== remote.heartbeat) applyRemote(next);
  });

  window.addEventListener('pageshow', () => {
    renderMini();
    sendChannel({ type: 'REQUEST_STATE' });
  });
  window.addEventListener('popstate', renderMini);

  window.PelegoRadioPersistent = {
    version: VERSION,
    audio: audioProxy,
    preparePlayer,
    ensureGraph,
    snapshot,
    setStations,
    setPlaylist,
    setConfig,
    setVolume,
    setEqGains,
    setEqBand,
    setCurrentStation,
    setOutputDevice,
    playStation,
    toggle,
    next,
    stop,
    get currentStation() { return remote.currentStation ? { ...remote.currentStation } : null; },
    get audioCtx() { return audioCtxProxy; },
    get analyser() { return analyserProxy; },
    get gainNode() { return gainNodeProxy; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderMini, { once: true });
  else renderMini();
  sendChannel({ type: 'REQUEST_STATE' });
})();
