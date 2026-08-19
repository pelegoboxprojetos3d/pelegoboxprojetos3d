(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.PelegoRadioPersistent?.version === '1.0.0') return;

  const AUDIO_ID = 'pelego-radio-persistent-audio';
  const MINI_ID = 'pelego-radio-mini-player';
  const RADIO_PATH = '/radiopelegobox';
  const EQ_FREQS = [40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,6300,10000,16000];

  const state = {
    currentStation: null,
    stations: [],
    playlist: [],
    server: 5,
    volume: 32,
    eqGains: Array(24).fill(0),
    randomMode: 'TEMPO',
    randomTimeMinutes: 30,
    crossfadeSeconds: 2,
    audioCtx: null,
    sourceNode: null,
    filters: [],
    gainNode: null,
    analyser: null,
    randomTimer: null,
    sessionStarted: false,
  };

  let audio = document.getElementById(AUDIO_ID);
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = AUDIO_ID;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    audio.style.display = 'none';
    const attach = () => {
      if (!audio.isConnected && document.body) document.body.appendChild(audio);
    };
    if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach, { once: true });
  }

  const normalizedPath = () => (window.location.pathname || '/').toLowerCase().replace(/\/$/, '') || '/';
  const streamUrl = (station, server = 5) => `https://ice${server}.somafm.com/${station.id}-128-mp3`;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

  function snapshot() {
    return {
      currentStation: state.currentStation ? { ...state.currentStation } : null,
      paused: audio.paused,
      playing: !audio.paused && !!audio.src,
      currentTime: Number(audio.currentTime || 0),
      volume: state.volume,
      server: state.server,
      sessionStarted: state.sessionStarted,
      audioCtx: state.audioCtx,
      analyser: state.analyser,
      filters: state.filters,
      gainNode: state.gainNode,
    };
  }

  function emit() {
    renderMini();
    window.dispatchEvent(new CustomEvent('pelego-radio-state', { detail: snapshot() }));
  }

  function pickNext() {
    const pool = (state.playlist.length ? state.playlist : state.stations).filter(Boolean);
    if (!pool.length) return null;
    const available = state.currentStation && pool.length > 1 ? pool.filter(item => item.id !== state.currentStation.id) : pool;
    return available[Math.floor(Math.random() * available.length)] || pool[0] || null;
  }

  async function ensureGraph() {
    if (state.audioCtx) return state;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      audio.volume = state.volume / 100;
      return state;
    }
    const ctx = new AC();
    const source = ctx.createMediaElementSource(audio);
    let previous = source;
    const filters = EQ_FREQS.map((freq, index) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.05;
      filter.gain.value = Number(state.eqGains[index] || 0);
      previous.connect(filter);
      previous = filter;
      return filter;
    });
    const gain = ctx.createGain();
    gain.gain.value = state.volume / 100;
    previous.connect(gain);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = .72;
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    state.audioCtx = ctx;
    state.sourceNode = source;
    state.filters = filters;
    state.gainNode = gain;
    state.analyser = analyser;
    emit();
    return state;
  }

  async function fadeTo(target, seconds = 0) {
    const value = clamp(target, 0, 1);
    if (!state.gainNode || !state.audioCtx) {
      audio.volume = value;
      return;
    }
    const now = state.audioCtx.currentTime;
    state.gainNode.gain.cancelScheduledValues(now);
    state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, now);
    state.gainNode.gain.linearRampToValueAtTime(Math.max(.0001, value), now + Math.max(.01, Number(seconds) || 0));
    await new Promise(resolve => setTimeout(resolve, Math.max(10, (Number(seconds) || 0) * 1000)));
  }

  function scheduleRandom() {
    clearTimeout(state.randomTimer);
    if (audio.paused || state.randomMode !== 'TEMPO') return;
    const min = Math.max(1, Number(state.randomTimeMinutes || 30));
    state.randomTimer = window.setTimeout(() => next(), min * 60000);
  }

  async function playStation(station, server = 5) {
    if (!station?.id) return false;
    try {
      await ensureGraph();
      if (state.audioCtx?.state === 'suspended') await state.audioCtx.resume();
      await fadeTo(0, .01);
      state.currentStation = { ...station };
      state.server = server;
      state.sessionStarted = true;
      audio.src = streamUrl(state.currentStation, state.server);
      audio.load();
      emit();
      await audio.play();
      await fadeTo(state.volume / 100, Math.max(.15, Number(state.crossfadeSeconds || 0)));
      scheduleRandom();
      emit();
      return true;
    } catch (_) {
      emit();
      return false;
    }
  }

  async function toggle() {
    if (!audio.paused) {
      audio.pause();
      emit();
      return true;
    }
    if (audio.src && state.currentStation) {
      try {
        await ensureGraph();
        if (state.audioCtx?.state === 'suspended') await state.audioCtx.resume();
        await audio.play();
        scheduleRandom();
        emit();
        return true;
      } catch (_) {
        return false;
      }
    }
    const station = pickNext();
    return station ? playStation(station, 5) : false;
  }

  async function next() {
    const station = pickNext();
    if (!station) return false;
    const sec = Math.max(0, Number(state.crossfadeSeconds || 0));
    await fadeTo(0, sec / 2);
    return playStation(station, 5);
  }

  function stop() {
    clearTimeout(state.randomTimer);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state.currentStation = null;
    state.sessionStarted = false;
    emit();
  }

  function setStations(stations) {
    state.stations = Array.isArray(stations) ? stations.map(item => ({ ...item })) : [];
  }

  function setPlaylist(stations) {
    state.playlist = Array.isArray(stations) ? stations.map(item => ({ ...item })) : [];
  }

  function setConfig(config = {}) {
    if (Number.isFinite(Number(config.volume))) setVolume(config.volume);
    if (Array.isArray(config.eqGains) && config.eqGains.length === 24) setEqGains(config.eqGains);
    if (config.randomMode) state.randomMode = config.randomMode;
    if (Number.isFinite(Number(config.randomTimeMinutes))) state.randomTimeMinutes = Number(config.randomTimeMinutes);
    if (Number.isFinite(Number(config.crossfadeSeconds))) state.crossfadeSeconds = Number(config.crossfadeSeconds);
    scheduleRandom();
  }

  function setVolume(value) {
    state.volume = clamp(value, 0, 50);
    if (state.gainNode) state.gainNode.gain.value = state.volume / 100;
    else audio.volume = state.volume / 100;
    emit();
  }

  function setEqGains(values) {
    if (!Array.isArray(values) || values.length !== 24) return;
    state.eqGains = values.map(value => clamp(value, -12, 12));
    state.filters.forEach((filter, index) => { filter.gain.value = state.eqGains[index]; });
  }

  function setEqBand(index, value) {
    if (index < 0 || index >= 24) return;
    state.eqGains[index] = clamp(value, -12, 12);
    if (state.filters[index]) state.filters[index].gain.value = state.eqGains[index];
  }

  function setCurrentStation(station, server = 5) {
    state.currentStation = station ? { ...station } : null;
    state.server = server;
    if (station) state.sessionStarted = true;
    emit();
  }

  async function setOutputDevice(id) {
    if (state.audioCtx && typeof state.audioCtx.setSinkId === 'function') return state.audioCtx.setSinkId(id || '');
    if (typeof audio.setSinkId === 'function') return audio.setSinkId(id || '');
  }

  async function recoverStream() {
    if (!state.currentStation || audio.paused) return;
    if (state.server === 5) return playStation(state.currentStation, 6);
    if (state.server === 6) return playStation(state.currentStation, 2);
    return next();
  }

  function mountMini() {
    if (document.getElementById(MINI_ID) || !document.body) return;
    const root = document.createElement('div');
    root.id = MINI_ID;
    root.innerHTML = `
      <style>
        #${MINI_ID}{position:fixed;left:16px;bottom:16px;z-index:2147482500;width:min(390px,calc(100vw - 32px));font-family:Arial,Helvetica,sans-serif;transition:opacity .2s ease,transform .2s ease}
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
    const shouldShow = state.sessionStarted && !!state.currentStation && normalizedPath() !== RADIO_PATH;
    root.classList.toggle('pb-hidden', !shouldShow);
    const station = state.currentStation;
    const name = root.querySelector('.pb-name');
    const genre = root.querySelector('.pb-genre');
    const toggleButton = root.querySelector('.pb-toggle');
    const range = root.querySelector('.pb-range');
    const volumeValue = root.querySelector('.pb-volume-value');
    if (name) name.textContent = station?.name || 'PELEGO RADIO';
    if (genre) genre.textContent = station?.genre || 'Rádio online';
    if (toggleButton) toggleButton.textContent = audio.paused ? '▶' : '❚❚';
    if (range) range.value = String(state.volume);
    if (volumeValue) volumeValue.textContent = `${state.volume}%`;
  }

  audio.addEventListener('playing', () => { state.sessionStarted = true; scheduleRandom(); emit(); });
  audio.addEventListener('pause', emit);
  audio.addEventListener('timeupdate', () => window.dispatchEvent(new CustomEvent('pelego-radio-time', { detail: snapshot() })));
  audio.addEventListener('error', () => { recoverStream().catch(() => {}); });

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function (...args) { const result = originalPush.apply(this, args); window.setTimeout(renderMini, 0); return result; };
  history.replaceState = function (...args) { const result = originalReplace.apply(this, args); window.setTimeout(renderMini, 0); return result; };
  window.addEventListener('popstate', renderMini);
  window.addEventListener('pageshow', renderMini);

  window.PelegoRadioPersistent = {
    version: '1.0.0',
    audio,
    get currentStation(){ return state.currentStation; },
    get audioCtx(){ return state.audioCtx; },
    get analyser(){ return state.analyser; },
    get filters(){ return state.filters; },
    get gainNode(){ return state.gainNode; },
    snapshot,
    ensureGraph,
    playStation,
    toggle,
    next,
    stop,
    setStations,
    setPlaylist,
    setConfig,
    setVolume,
    setEqGains,
    setEqBand,
    setCurrentStation,
    setOutputDevice,
    renderMini,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderMini, { once: true });
  else renderMini();
})();
