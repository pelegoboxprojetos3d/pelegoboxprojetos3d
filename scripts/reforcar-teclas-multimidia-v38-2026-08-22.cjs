const fs = require('fs');

const file = 'src/public/radioPelegoPersistente.js';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('PB_MEDIA_KEYS_V37')) throw new Error('V38 exige V37 aplicada antes.');
if (src.includes('PB_MEDIA_KEYS_V38')) {
  console.log('V38 já aplicada.');
  process.exit(0);
}

const oldPopupFallback = `  function installHardwareKeyFallback(){
    window.addEventListener('keydown',event=>{
      const key=String(event.key||event.code||'');
      const hasMediaSession='mediaSession' in navigator;
      if(!hasMediaSession&&key==='MediaPlayPause'){event.preventDefault();toggle();return;}
      if(!hasMediaSession&&key==='MediaTrackNext'){event.preventDefault();next();return;}
      if(!hasMediaSession&&key==='MediaTrackPrevious'){event.preventDefault();previous();return;}
      if(!hasMediaSession&&key==='MediaStop'){event.preventDefault();stop();return;}
      if(key==='AudioVolumeUp'){event.preventDefault();setVolume(Number(state.volume||0)+5);return;}
      if(key==='AudioVolumeDown'){event.preventDefault();setVolume(Number(state.volume||0)-5);return;}
      if(key==='AudioVolumeMute'){event.preventDefault();if(Number(state.volume||0)>0){lastNonZeroVolume=Number(state.volume||32);setVolume(0);}else setVolume(lastNonZeroVolume||32);}
    },true);
  }
`;

const newPopupFallback = `  /* PB_MEDIA_KEYS_V38 */
  let lastHardwareActionName='';let lastHardwareActionAt=0;
  function runHardwareAction(name,fn){
    const now=Date.now();
    if(name===lastHardwareActionName&&now-lastHardwareActionAt<180)return;
    lastHardwareActionName=name;lastHardwareActionAt=now;
    try{fn();}catch(_){}
  }
  function installHardwareKeyFallback(){
    const handler=event=>{
      const key=String(event.key||event.code||'');
      const nextKeys=['MediaTrackNext','MediaNextTrack','NextTrack','BrowserForward'];
      const prevKeys=['MediaTrackPrevious','MediaPreviousTrack','PreviousTrack','BrowserBack'];
      const playKeys=['MediaPlayPause','MediaPlay','PlayPause'];
      const stopKeys=['MediaStop','StopMedia'];
      const upKeys=['AudioVolumeUp','VolumeUp'];
      const downKeys=['AudioVolumeDown','VolumeDown'];
      const muteKeys=['AudioVolumeMute','VolumeMute'];
      if(nextKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('next',()=>next());return;}
      if(prevKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('previous',()=>previous());return;}
      if(playKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('playpause',()=>toggle());return;}
      if(stopKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('stop',()=>stop());return;}
      if(upKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('volup',()=>setVolume(Number(state.volume||0)+5));return;}
      if(downKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('voldown',()=>setVolume(Number(state.volume||0)-5));return;}
      if(muteKeys.includes(key)){event.preventDefault();event.stopPropagation();runHardwareAction('mute',()=>{if(Number(state.volume||0)>0){lastNonZeroVolume=Number(state.volume||32);setVolume(0);}else setVolume(lastNonZeroVolume||32);});return;}
    };
    window.addEventListener('keydown',handler,true);
    document.addEventListener('keydown',handler,true);
  }
`;

if (!src.includes(oldPopupFallback)) throw new Error('V38 não encontrou fallback V37 do popup.');
src = src.replace(oldPopupFallback, newPopupFallback);

const controllerNeedle = `  function setOutputDevice(id) {
    sendCommand({ type: 'SET_OUTPUT_DEVICE', id });
    return Promise.resolve();
  }

  channel?.addEventListener('message', event => {
`;

const controllerPatch = `  function setOutputDevice(id) {
    sendCommand({ type: 'SET_OUTPUT_DEVICE', id });
    return Promise.resolve();
  }

  let controllerLastHardwareAction='';
  let controllerLastHardwareAt=0;
  let controllerLastNonZeroVolume=Number(remote.volume||32)||32;
  function controllerRunHardware(name,fn){
    const now=Date.now();
    if(name===controllerLastHardwareAction&&now-controllerLastHardwareAt<180)return;
    controllerLastHardwareAction=name;controllerLastHardwareAt=now;
    try{fn();}catch(_){}
  }
  function installControllerHardwareKeys(){
    const handler=event=>{
      if(!remote.sessionStarted&&!remote.currentStation)return;
      const key=String(event.key||event.code||'');
      const nextKeys=['MediaTrackNext','MediaNextTrack','NextTrack','BrowserForward'];
      const prevKeys=['MediaTrackPrevious','MediaPreviousTrack','PreviousTrack','BrowserBack'];
      const playKeys=['MediaPlayPause','MediaPlay','PlayPause'];
      const stopKeys=['MediaStop','StopMedia'];
      const upKeys=['AudioVolumeUp','VolumeUp'];
      const downKeys=['AudioVolumeDown','VolumeDown'];
      const muteKeys=['AudioVolumeMute','VolumeMute'];
      if(nextKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('next',()=>next());return;}
      if(prevKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('previous',()=>previous());return;}
      if(playKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('playpause',()=>toggle());return;}
      if(stopKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('stop',()=>stop());return;}
      if(upKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('volup',()=>setVolume(Number(remote.volume||0)+5));return;}
      if(downKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('voldown',()=>setVolume(Number(remote.volume||0)-5));return;}
      if(muteKeys.includes(key)){event.preventDefault();event.stopPropagation();controllerRunHardware('mute',()=>{if(Number(remote.volume||0)>0){controllerLastNonZeroVolume=Number(remote.volume||32);setVolume(0);}else setVolume(controllerLastNonZeroVolume||32);});return;}
    };
    window.addEventListener('keydown',handler,true);
    document.addEventListener('keydown',handler,true);
  }
  installControllerHardwareKeys();

  channel?.addEventListener('message', event => {
`;

if (!src.includes(controllerNeedle)) throw new Error('V38 não encontrou ponto de instalação no controlador.');
src = src.replace(controllerNeedle, controllerPatch);

fs.writeFileSync(file, src, 'utf8');

const required = [
  'PB_MEDIA_KEYS_V38',
  "BrowserForward",
  "BrowserBack",
  "MediaNextTrack",
  "MediaPreviousTrack",
  "VolumeMute",
  "installControllerHardwareKeys();"
];
for (const token of required) if (!src.includes(token)) throw new Error('Validação V38 falhou: ' + token);

console.log('V38 aplicada: fallback multimídia reforçado no popup e na página principal, sem alterar layout.');
