const fs = require('fs');

const file = 'src/public/radioPelegoPersistente.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('PB_MEDIA_KEYS_V37')) {
  console.log('V37 já aplicada.');
  process.exit(0);
}

const replaceOne = (from, to, label) => {
  if (!src.includes(from)) throw new Error(`V37 não encontrou: ${label}`);
  src = src.replace(from, to);
};

replaceOne(
  "  let audioCtx=null,sourceNode=null,filters=[],gainNode=null,analyser=null,randomTimer=null,tickTimer=null;\n",
  "  let audioCtx=null,sourceNode=null,filters=[],gainNode=null,analyser=null,randomTimer=null,tickTimer=null;\n  let mediaHistory=[];let mediaMetaStationId='';let mediaPlaybackState='';let lastNonZeroVolume=32;\n",
  'estado do player popup'
);

replaceOne(
  "  function render(){ui.name.textContent=state.currentStation?.name||'PELEGO RADIO';ui.genre.textContent=state.currentStation?.genre||'Rádio pronta para tocar';ui.toggle.textContent=audio.paused?'▶ TOCAR':'❚❚ PAUSAR';ui.volume.value=String(state.volume);ui.volText.textContent=state.volume+'%';document.title=(audio.paused?'':'▶ ')+(state.currentStation?.name||'PELEGO RADIO');}\n",
  "  function render(){ui.name.textContent=state.currentStation?.name||'PELEGO RADIO';ui.genre.textContent=state.currentStation?.genre||'Rádio pronta para tocar';ui.toggle.textContent=audio.paused?'▶ TOCAR':'❚❚ PAUSAR';ui.volume.value=String(state.volume);ui.volText.textContent=state.volume+'%';document.title=(audio.paused?'':'▶ ')+(state.currentStation?.name||'PELEGO RADIO');syncMediaSession();}\n",
  'render do popup'
);

replaceOne(
  "  async function playStation(station,server=5){",
  "  async function playStation(station,server=5,options={}){if(!options.skipHistory&&state.currentStation?.id&&state.currentStation.id!==station?.id){mediaHistory.push({...state.currentStation});if(mediaHistory.length>30)mediaHistory.shift();}",
  'playStation do popup'
);

const nextMatch = src.match(/  async function next\(\)\{[^\n]*\}\n/);
if (!nextMatch) throw new Error('V37 não encontrou: next do popup');
src = src.replace(
  nextMatch[0],
  nextMatch[0] + "  async function previous(){const st=mediaHistory.pop();if(!st)return false;const sec=Math.max(0,Number(state.crossfadeSeconds||0));await fadeTo(0,sec/2);return playStation(st,5,{skipHistory:true});}\n"
);

replaceOne(
  "  function setVolume(value){state.volume=clamp(value,0,50);if(gainNode)gainNode.gain.value=state.volume/100;else audio.volume=state.volume/100;broadcast();}\n",
  "  function setVolume(value){state.volume=clamp(value,0,50);if(state.volume>0)lastNonZeroVolume=state.volume;if(gainNode)gainNode.gain.value=state.volume/100;else audio.volume=state.volume/100;broadcast();}\n",
  'setVolume do popup'
);

const mediaFunctions = `  /* PB_MEDIA_KEYS_V37 */\n  function syncMediaSession(){\n    if(!('mediaSession' in navigator))return;\n    const station=state.currentStation;\n    const stationId=station?.id||'';\n    if(stationId!==mediaMetaStationId){\n      mediaMetaStationId=stationId;\n      try{\n        if(typeof MediaMetadata==='function'){\n          navigator.mediaSession.metadata=new MediaMetadata({\n            title:station?.name||'PELEGO RADIO',\n            artist:'PELEGO BOX',\n            album:station?.genre||'Rádio Pelego Box'\n          });\n        }\n      }catch(_){}\n    }\n    const playback=audio.paused?'paused':'playing';\n    if(playback!==mediaPlaybackState){\n      mediaPlaybackState=playback;\n      try{navigator.mediaSession.playbackState=playback;}catch(_){}\n    }\n  }\n\n  function installMediaSessionControls(){\n    if(!('mediaSession' in navigator))return;\n    const handlers={\n      play:()=>{if(audio.paused)toggle();},\n      pause:()=>{if(!audio.paused){audio.pause();broadcast();}},\n      stop:()=>stop(),\n      nexttrack:()=>next(),\n      previoustrack:()=>previous(),\n      seekforward:()=>next(),\n      seekbackward:()=>previous()\n    };\n    Object.entries(handlers).forEach(([action,handler])=>{try{navigator.mediaSession.setActionHandler(action,handler);}catch(_){}});\n    syncMediaSession();\n  }\n\n  function installHardwareKeyFallback(){\n    window.addEventListener('keydown',event=>{\n      const key=String(event.key||event.code||'');\n      const hasMediaSession='mediaSession' in navigator;\n      if(!hasMediaSession&&key==='MediaPlayPause'){event.preventDefault();toggle();return;}\n      if(!hasMediaSession&&key==='MediaTrackNext'){event.preventDefault();next();return;}\n      if(!hasMediaSession&&key==='MediaTrackPrevious'){event.preventDefault();previous();return;}\n      if(!hasMediaSession&&key==='MediaStop'){event.preventDefault();stop();return;}\n      if(key==='AudioVolumeUp'){event.preventDefault();setVolume(Number(state.volume||0)+5);return;}\n      if(key==='AudioVolumeDown'){event.preventDefault();setVolume(Number(state.volume||0)-5);return;}\n      if(key==='AudioVolumeMute'){event.preventDefault();if(Number(state.volume||0)>0){lastNonZeroVolume=Number(state.volume||32);setVolume(0);}else setVolume(lastNonZeroVolume||32);}\n    },true);\n  }\n\n`;

replaceOne(
  "  function setEqGains(values){if(!Array.isArray(values)||values.length!==24)return;state.eqGains=values.map(v=>clamp(v,-12,12));filters.forEach((f,i)=>{f.gain.value=state.eqGains[i];});}\n",
  mediaFunctions + "  function setEqGains(values){if(!Array.isArray(values)||values.length!==24)return;state.eqGains=values.map(v=>clamp(v,-12,12));filters.forEach((f,i)=>{f.gain.value=state.eqGains[i];});}\n",
  'ponto de inserção das funções Media Session'
);

replaceOne(
  "case 'NEXT':next();break;case 'STOP':stop();break;",
  "case 'NEXT':next();break;case 'PREVIOUS':previous();break;case 'STOP':stop();break;",
  'comando PREVIOUS do popup'
);

replaceOne(
  "  channel?.addEventListener('message',event=>{const data=event.data||{};if(data.source==='controller')window.pelegoRadioCommand(data);});\n",
  "  installMediaSessionControls();\n  installHardwareKeyFallback();\n  channel?.addEventListener('message',event=>{const data=event.data||{};if(data.source==='controller')window.pelegoRadioCommand(data);});\n",
  'instalação dos controles multimídia'
);

const controllerNext = `  function next() {\n    if (!preparePlayer()) return Promise.resolve(false);\n    sendCommand({ type: 'NEXT' });\n    return Promise.resolve(true);\n  }\n`;
const controllerPrevious = controllerNext + `\n  function previous() {\n    if (!preparePlayer()) return Promise.resolve(false);\n    sendCommand({ type: 'PREVIOUS' });\n    return Promise.resolve(true);\n  }\n`;
replaceOne(controllerNext, controllerPrevious, 'função previous do controlador');

replaceOne(
  "    next,\n    stop,\n",
  "    next,\n    previous,\n    stop,\n",
  'export previous do controlador'
);

fs.writeFileSync(file, src, 'utf8');

const required = [
  'PB_MEDIA_KEYS_V37',
  "setActionHandler(action,handler)",
  "nexttrack:()=>next()",
  "previoustrack:()=>previous()",
  "MediaPlayPause",
  "AudioVolumeUp",
  "case 'PREVIOUS':previous();break",
  "sendCommand({ type: 'PREVIOUS' })",
  'previous,\n    stop,'
];
for (const token of required) if (!src.includes(token)) throw new Error('Validação V37 falhou: ' + token);

console.log('V37 aplicada: teclas multimídia, Media Session, anterior/próxima e fallback de volume sem alterar layout.');
