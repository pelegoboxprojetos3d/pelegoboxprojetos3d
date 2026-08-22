const fs = require('fs');

const file = 'src/public/radioPelegoPersistente.js';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('PB_MEDIA_KEYS_V39_LEGACY')) throw new Error('V40 exige V39 consolidada.');
if (src.includes('PB_MEDIA_KEYS_V40_SESSION_BRIDGE')) {
  console.log('V40 já aplicada.');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`V40 não encontrou: ${label}`);
  src = src.replace(from, to);
}

// 1) Reforça a Media Session no player real. Para rádio ao vivo o duration é infinito,
// então criamos uma posição virtual finita apenas para o SO habilitar seek/forward/back.
const popupStart = src.indexOf("  function syncMediaSession(){");
const popupEnd = src.indexOf("  /* PB_MEDIA_KEYS_V38 */", popupStart);
if (popupStart < 0 || popupEnd < 0) throw new Error('V40 não encontrou bloco Media Session do popup.');

const popupMedia = `  /* PB_MEDIA_KEYS_V40_SESSION_BRIDGE */\n  let mediaVirtualPosition=1800;\n  function syncMediaSession(){\n    if(!('mediaSession' in navigator))return;\n    const station=state.currentStation;\n    const stationId=station?.id||'';\n    if(stationId!==mediaMetaStationId){\n      mediaMetaStationId=stationId;\n      try{\n        if(typeof MediaMetadata==='function'){\n          navigator.mediaSession.metadata=new MediaMetadata({\n            title:station?.name||'PELEGO RADIO',\n            artist:'PELEGO BOX',\n            album:station?.genre||'Rádio Pelego Box'\n          });\n        }\n      }catch(_){}\n    }\n    const playback=audio.paused?'paused':'playing';\n    if(playback!==mediaPlaybackState){\n      mediaPlaybackState=playback;\n      try{navigator.mediaSession.playbackState=playback;}catch(_){}\n    }\n    try{\n      const position=Math.max(1,Math.min(3599,Number(mediaVirtualPosition)||1800));\n      navigator.mediaSession.setPositionState({duration:3600,playbackRate:1,position});\n    }catch(_){}\n  }\n\n  function installMediaSessionControls(){\n    if(!('mediaSession' in navigator))return;\n    const goNext=()=>{mediaVirtualPosition=Math.min(3599,mediaVirtualPosition+30);next();syncMediaSession();};\n    const goPrevious=()=>{mediaVirtualPosition=Math.max(1,mediaVirtualPosition-30);previous();syncMediaSession();};\n    const handlers={\n      play:()=>{if(audio.paused)toggle();},\n      pause:()=>{if(!audio.paused){audio.pause();broadcast();}},\n      stop:()=>stop(),\n      nexttrack:goNext,\n      previoustrack:goPrevious,\n      seekforward:goNext,\n      seekbackward:goPrevious,\n      seekto:details=>{\n        const target=Number(details?.seekTime);\n        if(!Number.isFinite(target))return;\n        if(target>=mediaVirtualPosition)goNext();else goPrevious();\n      }\n    };\n    Object.entries(handlers).forEach(([action,handler])=>{try{navigator.mediaSession.setActionHandler(action,handler);}catch(_){}});\n    syncMediaSession();\n  }\n\n`;

src = src.slice(0, popupStart) + popupMedia + src.slice(popupEnd);

// 2) Captura também keyup. Alguns drivers só entregam a tecla multimídia ao soltar.
replaceOnce(
  "    window.addEventListener('keydown',handler,true);\n    document.addEventListener('keydown',handler,true);\n  }\n\n  function setEqGains",
  "    window.addEventListener('keydown',handler,true);\n    document.addEventListener('keydown',handler,true);\n    window.addEventListener('keyup',handler,true);\n    document.addEventListener('keyup',handler,true);\n  }\n\n  function setEqGains",
  'keyup do popup'
);

// Evita ação dupla keydown+keyup quando o driver entrega ambos.
src = src.replace(
  "if(name===lastHardwareActionName&&now-lastHardwareActionAt<180)return;",
  "if(name===lastHardwareActionName&&now-lastHardwareActionAt<420)return;"
);

// 3) Media Session também no documento controlador. Se o Windows eleger a aba principal
// como sessão ativa, os comandos são encaminhados para o player persistente.
const controllerMarker = "  installControllerHardwareKeys();\n\n  channel?.addEventListener('message', event => {";
const controllerBridge = `  installControllerHardwareKeys();\n\n  let controllerMediaPosition=1800;\n  function syncControllerMediaSession(){\n    if(!('mediaSession' in navigator))return;\n    try{\n      if(typeof MediaMetadata==='function'){\n        navigator.mediaSession.metadata=new MediaMetadata({\n          title:remote.currentStation?.name||'PELEGO RADIO',\n          artist:'PELEGO BOX',\n          album:remote.currentStation?.genre||'Rádio Pelego Box'\n        });\n      }\n    }catch(_){}\n    try{navigator.mediaSession.playbackState=remote.playing?'playing':'paused';}catch(_){}\n    try{navigator.mediaSession.setPositionState({duration:3600,playbackRate:1,position:Math.max(1,Math.min(3599,controllerMediaPosition))});}catch(_){}\n  }\n  function installControllerMediaSession(){\n    if(!('mediaSession' in navigator))return;\n    const goNext=()=>{controllerMediaPosition=Math.min(3599,controllerMediaPosition+30);next();syncControllerMediaSession();};\n    const goPrevious=()=>{controllerMediaPosition=Math.max(1,controllerMediaPosition-30);previous();syncControllerMediaSession();};\n    const handlers={\n      play:()=>toggle(),\n      pause:()=>sendCommand({type:'PAUSE'}),\n      stop:()=>stop(),\n      nexttrack:goNext,\n      previoustrack:goPrevious,\n      seekforward:goNext,\n      seekbackward:goPrevious,\n      seekto:details=>{const target=Number(details?.seekTime);if(!Number.isFinite(target))return;if(target>=controllerMediaPosition)goNext();else goPrevious();}\n    };\n    Object.entries(handlers).forEach(([action,handler])=>{try{navigator.mediaSession.setActionHandler(action,handler);}catch(_){}});\n    syncControllerMediaSession();\n  }\n  installControllerMediaSession();\n\n  channel?.addEventListener('message', event => {`;
replaceOnce(controllerMarker, controllerBridge, 'Media Session do controlador');

replaceOnce(
  "    persistRemote();\n    renderMini();\n\n    const newStationId",
  "    persistRemote();\n    renderMini();\n    try{syncControllerMediaSession();}catch(_){}\n\n    const newStationId",
  'sincronização Media Session em applyRemote'
);

replaceOnce(
  "    window.addEventListener('keydown',handler,true);\n    document.addEventListener('keydown',handler,true);\n  }\n  installControllerHardwareKeys();",
  "    window.addEventListener('keydown',handler,true);\n    document.addEventListener('keydown',handler,true);\n    window.addEventListener('keyup',handler,true);\n    document.addEventListener('keyup',handler,true);\n  }\n  installControllerHardwareKeys();",
  'keyup do controlador'
);

src = src.replace(
  "if(name===controllerLastHardwareAction&&now-controllerLastHardwareAt<180)return;",
  "if(name===controllerLastHardwareAction&&now-controllerLastHardwareAt<420)return;"
);

fs.writeFileSync(file, src, 'utf8');

const required = [
  'PB_MEDIA_KEYS_V40_SESSION_BRIDGE',
  'setPositionState({duration:3600',
  'seekto:details=>',
  "window.addEventListener('keyup',handler,true)",
  'installControllerMediaSession();',
  'syncControllerMediaSession();'
];
for (const token of required) if (!src.includes(token)) throw new Error('Validação V40 falhou: ' + token);

console.log('V40 aplicada: Media Session reforçada no player e controlador, seek/next/previous e keyup sem tocar no layout.');
