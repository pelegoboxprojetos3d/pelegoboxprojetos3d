const fs = require('fs');

const corePath = 'src/public/custom-elements/pelego-radio-core.js';
const masterPath = 'src/pages/masterPage.js';

function replaceExact(text, from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

let master = fs.readFileSync(masterPath, 'utf8');
if (!master.includes("import 'public/buscadorPopupPelegoBox.js';")) {
  master = replaceExact(
    master,
    "import wixLocation from 'wix-location';\n",
    "import wixLocation from 'wix-location';\nimport 'public/buscadorPopupPelegoBox.js';\n",
    'import popup buscador'
  );
}
if (!master.includes("import 'public/radioPelegoPersistente.js';")) {
  master = master.replace(
    "import 'public/buscadorPopupPelegoBox.js';\n",
    "import 'public/buscadorPopupPelegoBox.js';\nimport 'public/radioPelegoPersistente.js';\n"
  );
}
fs.writeFileSync(masterPath, master);

let core = fs.readFileSync(corePath, 'utf8');

core = replaceExact(
  core,
  "  connectedCallback(){this.cache();this.buildGenres();this.buildEq();this.buildPreset();this.bind();this.applyConfig();this.renderProducts();this.startCatalogRotation();this.setupCanvas();this.refreshDevices();requestAnimationFrame(()=>this.applyPlayerUi());}",
  "  connectedCallback(){this.cache();this.buildGenres();this.buildEq();this.buildPreset();this.bind();this.applyConfig();this.syncPersistentState();this.renderProducts();this.startCatalogRotation();this.setupCanvas();this.refreshDevices();requestAnimationFrame(()=>{this.applyPlayerUi();this.syncPersistentState();});}",
  'connectedCallback'
);

core = replaceExact(
  core,
  "  cache(){const $=id=>this.shadowRoot.getElementById(id);this.$=$;this.shell=$('shell');this.audio=$('audio');this.canvas=$('analyzer');this.ctx2d=this.canvas.getContext('2d');this.status=$('status');this.volume=$('volume');this.volumeValue=$('volumeValue');this.device=$('device');this.preset=$('preset');this.eqgrid=$('eqgrid');this.genresEl=$('genres');this.international=$('international');this.national=$('national');}",
  "  cache(){const $=id=>this.shadowRoot.getElementById(id);this.$=$;this.shell=$('shell');this.localAudio=$('audio');this.persistentRadio=window.PelegoRadioPersistent||null;this.audio=this.persistentRadio?.audio||this.localAudio;this.canvas=$('analyzer');this.ctx2d=this.canvas.getContext('2d');this.status=$('status');this.volume=$('volume');this.volumeValue=$('volumeValue');this.device=$('device');this.preset=$('preset');this.eqgrid=$('eqgrid');this.genresEl=$('genres');this.international=$('international');this.national=$('national');}",
  'cache persistent audio'
);

core = replaceExact(
  core,
  "this.refreshGenreButtons();};return b;}));}",
  "this.refreshGenreButtons();this.syncPersistentState();};return b;}));}",
  'genre click sync'
);

core = replaceExact(
  core,
  "if(this.filters[i])this.filters[i].gain.value=val;};return band;}));}",
  "if(this.filters[i])this.filters[i].gain.value=val;this.persistentRadio?.setEqBand?.(i,val);};return band;}));}",
  'eq band sync'
);

core = replaceExact(
  core,
  "this.$('transition').value=`${Number(this.config.crossfadeSeconds||2)} s`;this.refreshGenreButtons();this.refreshRandomMode();}",
  "this.$('transition').value=`${Number(this.config.crossfadeSeconds||2)} s`;this.refreshGenreButtons();this.refreshRandomMode();this.syncPersistentState();}",
  'applyConfig sync'
);

core = replaceExact(
  core,
  "this.volume.oninput=()=>{this.config.volume=Number(this.volume.value);this.volumeValue.textContent=`${this.config.volume}%`;if(this.gainNode)this.gainNode.gain.value=this.config.volume/100;else this.audio.volume=this.config.volume/100;};",
  "this.volume.oninput=()=>{this.config.volume=Number(this.volume.value);this.volumeValue.textContent=`${this.config.volume}%`;if(this.persistentRadio)this.persistentRadio.setVolume(this.config.volume);else if(this.gainNode)this.gainNode.gain.value=this.config.volume/100;else this.audio.volume=this.config.volume/100;};",
  'volume persistent'
);

core = replaceExact(
  core,
  "this.$('time').onchange=()=>{this.config.randomTimeMinutes=parseInt(this.$('time').value,10)||30;this.config.randomMode='TEMPO';this.refreshRandomMode();this.scheduleRandom();};",
  "this.$('time').onchange=()=>{this.config.randomTimeMinutes=parseInt(this.$('time').value,10)||30;this.config.randomMode='TEMPO';this.refreshRandomMode();this.syncPersistentState();this.scheduleRandom();};",
  'time persistent'
);

core = replaceExact(
  core,
  "this.$('songs').onchange=()=>{this.config.randomSongCount=parseInt(this.$('songs').value,10)||5;this.config.randomMode='MUSICAS';this.refreshRandomMode();};",
  "this.$('songs').onchange=()=>{this.config.randomSongCount=parseInt(this.$('songs').value,10)||5;this.config.randomMode='MUSICAS';this.refreshRandomMode();this.syncPersistentState();};",
  'songs persistent'
);

core = replaceExact(
  core,
  "this.$('transition').onchange=()=>this.config.crossfadeSeconds=parseInt(this.$('transition').value,10)||0;",
  "this.$('transition').onchange=()=>{this.config.crossfadeSeconds=parseInt(this.$('transition').value,10)||0;this.syncPersistentState();};",
  'transition persistent'
);

core = replaceExact(
  core,
  "this.audio.addEventListener('playing',()=>{this.status.textContent=`Tocando: ${this.currentStation?.name||'PELEGO RADIO'}`;this.$('play').textContent='❚❚ PAUSAR';this.updatePlayMeta();this.scheduleRandom();});",
  "this.audio.addEventListener('playing',()=>{if(this.persistentRadio?.currentStation)this.currentStation={...this.persistentRadio.currentStation};this.status.textContent=`Tocando: ${this.currentStation?.name||'PELEGO RADIO'}`;this.$('play').textContent='❚❚ PAUSAR';this.updatePlayMeta();this.scheduleRandom();});",
  'playing sync station'
);

core = replaceExact(
  core,
  "this.audio.addEventListener('error',()=>this.handleStreamError());",
  "this.audio.addEventListener('error',()=>{if(!this.persistentRadio)this.handleStreamError();});",
  'avoid duplicate stream recovery'
);

core = replaceExact(
  core,
  "  applyPreset(name){const gains=(PRESETS[name]||PRESETS.FLAT).slice();this.config.eqPreset=name;this.config.eqGains=gains;this.eqgrid.querySelectorAll('input').forEach((input,i)=>{input.value=String(gains[i]);this.$(`db${i}`).textContent=String(gains[i]);if(this.filters[i])this.filters[i].gain.value=gains[i];});}",
  "  applyPreset(name){const gains=(PRESETS[name]||PRESETS.FLAT).slice();this.config.eqPreset=name;this.config.eqGains=gains;this.eqgrid.querySelectorAll('input').forEach((input,i)=>{input.value=String(gains[i]);this.$(`db${i}`).textContent=String(gains[i]);if(this.filters[i])this.filters[i].gain.value=gains[i];});this.persistentRadio?.setEqGains?.(gains);this.syncPersistentState();}\n  persistentPool(){const selected=this.config.selectedGenres?.length?this.config.selectedGenres:['ROCK','POP','JAZZ','SERTANEJO'];let pool=[];if(this.config.allowInternational)pool=STATIONS.filter(st=>this.stationTags(st).some(tag=>selected.includes(tag)));return pool.length?pool:STATIONS.slice();}\n  syncPersistentState(){const engine=this.persistentRadio;if(!engine)return;engine.setStations(STATIONS);engine.setPlaylist(this.persistentPool());engine.setConfig(this.config);const snap=engine.snapshot?.();if(engine.currentStation)this.currentStation={...engine.currentStation};if(snap?.audioCtx){this.audioCtx=snap.audioCtx;this.analyser=snap.analyser;this.filters=snap.filters||[];this.gainNode=snap.gainNode;}if(engine.currentStation&&!this.audio.paused){this.$('play').textContent='❚❚ PAUSAR';this.status.textContent=`Tocando: ${engine.currentStation.name||'PELEGO RADIO'}`;this.updatePlayMeta();}}",
  'persistent helper methods'
);

core = replaceExact(
  core,
  "  async ensureAudioGraph(){if(this.audioCtx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC){this.audio.volume=this.config.volume/100;return;}this.audioCtx=new AC();this.sourceNode=this.audioCtx.createMediaElementSource(this.audio);let prev=this.sourceNode;this.filters=EQ_FREQS.map((freq,i)=>{const f=this.audioCtx.createBiquadFilter();f.type='peaking';f.frequency.value=freq;f.Q.value=1.05;f.gain.value=Number(this.config.eqGains?.[i]||0);prev.connect(f);prev=f;return f;});this.gainNode=this.audioCtx.createGain();this.gainNode.gain.value=this.config.volume/100;prev.connect(this.gainNode);this.analyser=this.audioCtx.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.72;this.gainNode.connect(this.analyser);this.analyser.connect(this.audioCtx.destination);this.drawAnalyzer();}",
  "  async ensureAudioGraph(){if(this.persistentRadio){await this.persistentRadio.ensureGraph();const snap=this.persistentRadio.snapshot();this.audioCtx=snap.audioCtx;this.analyser=snap.analyser;this.filters=snap.filters||[];this.gainNode=snap.gainNode;this.drawAnalyzer();return;}if(this.audioCtx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC){this.audio.volume=this.config.volume/100;return;}this.audioCtx=new AC();this.sourceNode=this.audioCtx.createMediaElementSource(this.audio);let prev=this.sourceNode;this.filters=EQ_FREQS.map((freq,i)=>{const f=this.audioCtx.createBiquadFilter();f.type='peaking';f.frequency.value=freq;f.Q.value=1.05;f.gain.value=Number(this.config.eqGains?.[i]||0);prev.connect(f);prev=f;return f;});this.gainNode=this.audioCtx.createGain();this.gainNode.gain.value=this.config.volume/100;prev.connect(this.gainNode);this.analyser=this.audioCtx.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.72;this.gainNode.connect(this.analyser);this.analyser.connect(this.audioCtx.destination);this.drawAnalyzer();}",
  'ensure persistent graph'
);

core = replaceExact(
  core,
  "  async play(){if(!this.audio.paused){this.audio.pause();return;}try{await this.ensureAudioGraph();if(this.audioCtx?.state==='suspended')await this.audioCtx.resume();if(!this.currentStation){this.currentStation=this.pickStation();this.server=5;this.audio.src=this.streamUrl(this.currentStation,this.server);this.audio.load();this.updatePlayMeta();}this.status.textContent='Conectando à estação...';await this.fadeTo(0,.01);await this.audio.play();await this.fadeTo(this.config.volume/100,Math.max(.15,Number(this.config.crossfadeSeconds||0)));}catch(e){this.status.textContent='O navegador bloqueou ou a estação não respondeu. Clique em TOCAR novamente.';}}",
  "  async play(){if(this.persistentRadio){try{this.syncPersistentState();await this.ensureAudioGraph();if(!this.audio.paused){await this.persistentRadio.toggle();return;}if(this.persistentRadio.currentStation&&this.audio.src){this.currentStation={...this.persistentRadio.currentStation};this.status.textContent='Retomando a estação...';await this.persistentRadio.toggle();return;}if(!this.currentStation)this.currentStation=this.pickStation();this.status.textContent='Conectando à estação...';const ok=await this.persistentRadio.playStation(this.currentStation,5);if(!ok)throw new Error('play failed');this.syncPersistentState();}catch(e){this.status.textContent='O navegador bloqueou ou a estação não respondeu. Clique em TOCAR novamente.';}return;}if(!this.audio.paused){this.audio.pause();return;}try{await this.ensureAudioGraph();if(this.audioCtx?.state==='suspended')await this.audioCtx.resume();if(!this.currentStation){this.currentStation=this.pickStation();this.server=5;this.audio.src=this.streamUrl(this.currentStation,this.server);this.audio.load();this.updatePlayMeta();}this.status.textContent='Conectando à estação...';await this.fadeTo(0,.01);await this.audio.play();await this.fadeTo(this.config.volume/100,Math.max(.15,Number(this.config.crossfadeSeconds||0)));}catch(e){this.status.textContent='O navegador bloqueou ou a estação não respondeu. Clique em TOCAR novamente.';}}",
  'persistent play'
);

core = replaceExact(
  core,
  "  async nextStation(){const next=this.pickStation();if(!next)return;const sec=Math.max(0,Number(this.config.crossfadeSeconds||0));await this.fadeTo(0,sec/2);this.currentStation=next;this.server=5;this.audio.src=this.streamUrl(next,5);this.audio.load();this.status.textContent=`Conectando: ${next.name}`;this.updatePlayMeta();try{await this.audio.play();await this.fadeTo(this.config.volume/100,sec/2);}catch(_){}}",
  "  async nextStation(){if(this.persistentRadio){this.syncPersistentState();this.status.textContent='Buscando próxima estação...';await this.persistentRadio.next();if(this.persistentRadio.currentStation)this.currentStation={...this.persistentRadio.currentStation};this.updatePlayMeta();return;}const next=this.pickStation();if(!next)return;const sec=Math.max(0,Number(this.config.crossfadeSeconds||0));await this.fadeTo(0,sec/2);this.currentStation=next;this.server=5;this.audio.src=this.streamUrl(next,5);this.audio.load();this.status.textContent=`Conectando: ${next.name}`;this.updatePlayMeta();try{await this.audio.play();await this.fadeTo(this.config.volume/100,sec/2);}catch(_){}}",
  'persistent next'
);

core = replaceExact(
  core,
  "  stop(){clearTimeout(this.randomTimer);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.currentStation=null;this.$('play').textContent='▶ TOCAR';this.status.textContent='Rádio parada.';this.updatePlayMeta();this.drawIdleAnalyzer();}",
  "  stop(){clearTimeout(this.randomTimer);if(this.persistentRadio)this.persistentRadio.stop();else{this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}this.currentStation=null;this.$('play').textContent='▶ TOCAR';this.status.textContent='Rádio parada.';this.updatePlayMeta();this.drawIdleAnalyzer();}",
  'persistent stop'
);

core = replaceExact(
  core,
  "  handleStreamError(){if(!this.currentStation)return;",
  "  handleStreamError(){if(this.persistentRadio)return;if(!this.currentStation)return;",
  'persistent error guard'
);

core = replaceExact(
  core,
  "  scheduleRandom(){clearTimeout(this.randomTimer);if(this.audio.paused)return;if(this.config.randomMode==='TEMPO'){const min=Math.max(1,Number(this.config.randomTimeMinutes||30));this.randomTimer=setTimeout(()=>this.nextStation(),min*60000);}}",
  "  scheduleRandom(){clearTimeout(this.randomTimer);if(this.persistentRadio){this.syncPersistentState();return;}if(this.audio.paused)return;if(this.config.randomMode==='TEMPO'){const min=Math.max(1,Number(this.config.randomTimeMinutes||30));this.randomTimer=setTimeout(()=>this.nextStation(),min*60000);}}",
  'persistent random scheduling'
);

core = replaceExact(
  core,
  "  async setOutputDevice(id){try{if(this.audioCtx&&typeof this.audioCtx.setSinkId==='function')await this.audioCtx.setSinkId(id||'');else if(typeof this.audio.setSinkId==='function')await this.audio.setSinkId(id);this.toast('Saída de áudio alterada.');}catch(_){this.toast('O navegador não permitiu trocar a saída de áudio.');}}",
  "  async setOutputDevice(id){try{if(this.persistentRadio)await this.persistentRadio.setOutputDevice(id);else if(this.audioCtx&&typeof this.audioCtx.setSinkId==='function')await this.audioCtx.setSinkId(id||'');else if(typeof this.audio.setSinkId==='function')await this.audio.setSinkId(id);this.toast('Saída de áudio alterada.');}catch(_){this.toast('O navegador não permitiu trocar a saída de áudio.');}}",
  'persistent output device'
);

fs.writeFileSync(corePath, core);
console.log('Integração persistente aplicada com sucesso.');
