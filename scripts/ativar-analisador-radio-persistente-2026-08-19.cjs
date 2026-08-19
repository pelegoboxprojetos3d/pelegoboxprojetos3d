const fs = require('fs');
const path = 'src/public/custom-elements/pelego-radio-core.js';
let s = fs.readFileSync(path, 'utf8');

const re = /  syncPersistentState\(\)\{[\s\S]*?\n  refreshRandomMode\(\)\{/;
if (!re.test(s)) throw new Error('syncPersistentState não encontrado.');

const replacement = `  syncPersistentState(){const engine=this.persistentRadio;if(!engine)return;engine.setStations(STATIONS);engine.setPlaylist(this.persistentPool());engine.setConfig(this.config);const applyGraph=()=>{const live=engine.snapshot?.();if(live?.audioCtx&&live?.analyser){this.audioCtx=live.audioCtx;this.analyser=live.analyser;this.filters=live.filters||[];this.gainNode=live.gainNode;this.drawAnalyzer();return true;}return false;};const snap=engine.snapshot?.();if(engine.currentStation)this.currentStation={...engine.currentStation};if(snap?.audioCtx){this.audioCtx=snap.audioCtx;this.analyser=snap.analyser;this.filters=snap.filters||[];this.gainNode=snap.gainNode;if(this.analyser)this.drawAnalyzer();}if(engine.currentStation&&!this.audio.paused){this.$('play').textContent='❚❚ PAUSAR';this.status.textContent=\`Tocando: \${engine.currentStation.name||'PELEGO RADIO'}\`;this.updatePlayMeta();if(!applyGraph()&&typeof engine.ensureGraph==='function'){Promise.resolve(engine.ensureGraph()).then(()=>{applyGraph();if(this.audioCtx?.state==='suspended')return this.audioCtx.resume?.();}).then(()=>applyGraph()).catch(()=>{});}}}\n  refreshRandomMode(){`;

s = s.replace(re, replacement);
fs.writeFileSync(path, s, 'utf8');
