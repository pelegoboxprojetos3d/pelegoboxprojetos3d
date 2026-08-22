const fs = require('fs');

const radioFile = 'src/public/custom-elements/pelego-radio.js';
const coreFile = 'src/public/custom-elements/pelego-radio-core.js';
const persistentFile = 'src/public/radioPelegoPersistente.js';

let radio = fs.readFileSync(radioFile, 'utf8');
let core = fs.readFileSync(coreFile, 'utf8');
let persistent = fs.readFileSync(persistentFile, 'utf8');

// 1) Copia a skin mobile canônica final para dentro do CORE.
// Assim o primeiro render já nasce no layout aprovado, antes do módulo de skin carregar.
const skinStartToken = 'const MOBILE_CLEAN_SKIN = `';
const skinEndToken = '`;\n/* END_MOBILE_V33_CANONICAL_FLOW */';
const skinStart = radio.indexOf(skinStartToken);
const skinEnd = radio.indexOf(skinEndToken, skinStart + skinStartToken.length);
if (skinStart < 0 || skinEnd < 0) throw new Error('V41: não encontrou MOBILE_CLEAN_SKIN canônica.');
const mobileSkin = radio.slice(skinStart + skinStartToken.length, skinEnd);

const coreBlock = `\n/* PB_CORE_CANONICAL_MOBILE_V41 */\n@media(max-width:640px){\n${mobileSkin}\n}\n/* END_PB_CORE_CANONICAL_MOBILE_V41 */\n`;
const coreBlockRegex = /\n\/\* PB_CORE_CANONICAL_MOBILE_V41 \*\/[\s\S]*?\/\* END_PB_CORE_CANONICAL_MOBILE_V41 \*\/\n/;
if (coreBlockRegex.test(core)) {
  core = core.replace(coreBlockRegex, coreBlock);
} else {
  const closeStyle = core.indexOf('</style>');
  if (closeStyle < 0) throw new Error('V41: </style> principal do core não encontrado.');
  core = core.slice(0, closeStyle) + coreBlock + core.slice(closeStyle);
}

// 2) Uma única Media Session: somente a janela que contém o <audio> real.
// Remove a sessão duplicada criada na página controladora pela V40.
persistent = persistent.replace(/\n\s*try\{syncControllerMediaSession\(\);\}catch\(_\)\{\}\n/g, '\n');
persistent = persistent.replace(/\n  let controllerMediaPosition=1800;[\s\S]*?\n  installControllerMediaSession\(\);\n/g, '\n');

// 3) Reinstala os handlers quando o áudio realmente entra em reprodução.
const oldPlaying = "  audio.addEventListener('playing',()=>{state.sessionStarted=true;scheduleRandom();broadcast();});";
const newPlaying = "  audio.addEventListener('playing',()=>{state.sessionStarted=true;scheduleRandom();installMediaSessionControls();broadcast();});";
if (persistent.includes(oldPlaying)) persistent = persistent.replace(oldPlaying, newPlaying);
else if (!persistent.includes(newPlaying)) throw new Error('V41: listener playing não encontrado.');

// 4) Diagnóstico interno da última tecla recebida. Não altera a UI.
const popupKeyNeedle = "      const key=String(event.key||event.code||'');const keyCode=Number(event.keyCode||event.which||0);/* PB_MEDIA_KEYS_V39_LEGACY */";
const popupKeyPatch = popupKeyNeedle + "\n      try{localStorage.setItem('PELEGO_RADIO_LAST_MEDIA_KEY',JSON.stringify({scope:'popup',key,keyCode,type:event.type,at:Date.now()}));}catch(_){}";
if (persistent.includes(popupKeyNeedle) && !persistent.includes("scope:'popup'")) persistent = persistent.replace(popupKeyNeedle, popupKeyPatch);

const controllerKeyNeedle = "      const key=String(event.key||event.code||'');const keyCode=Number(event.keyCode||event.which||0);/* PB_MEDIA_KEYS_V39_LEGACY */";
let first = persistent.indexOf(controllerKeyNeedle);
let second = persistent.indexOf(controllerKeyNeedle, first + controllerKeyNeedle.length);
if (second >= 0 && !persistent.slice(second, second + 500).includes("scope:'controller'")) {
  persistent = persistent.slice(0, second) + controllerKeyNeedle + "\n      try{localStorage.setItem('PELEGO_RADIO_LAST_MEDIA_KEY',JSON.stringify({scope:'controller',key,keyCode,type:event.type,at:Date.now()}));}catch(_){}" + persistent.slice(second + controllerKeyNeedle.length);
}

// 5) Marcadores de consolidação.
if (!persistent.includes('PB_MEDIA_SESSION_SINGLE_OWNER_V41')) {
  persistent = persistent.replace('/* PB_MEDIA_KEYS_V40_SESSION_BRIDGE */', '/* PB_MEDIA_KEYS_V40_SESSION_BRIDGE */\n  /* PB_MEDIA_SESSION_SINGLE_OWNER_V41 */');
}

fs.writeFileSync(coreFile, core, 'utf8');
fs.writeFileSync(persistentFile, persistent, 'utf8');

const requiredCore = [
  'PB_CORE_CANONICAL_MOBILE_V41',
  'MOBILE_V34_TITLE_LOCK',
  'MOBILE_V35_FINISH',
  "content:'ANALISADOR - 8 BANDAS'!important",
  "content:'⚙ EQUALIZADOR 8 BANDAS'!important",
  '.filters{height:140px!important;min-height:140px!important;max-height:140px!important}',
  '.playbox{height:220px!important;min-height:220px!important;max-height:220px!important}'
];
for (const token of requiredCore) if (!core.includes(token)) throw new Error('V41 core sem token: ' + token);

const requiredPersistent = [
  'PB_MEDIA_SESSION_SINGLE_OWNER_V41',
  "nexttrack:goNext",
  "previoustrack:goPrevious",
  "installMediaSessionControls();broadcast();",
  'PELEGO_RADIO_LAST_MEDIA_KEY'
];
for (const token of requiredPersistent) if (!persistent.includes(token)) throw new Error('V41 persistente sem token: ' + token);
if (persistent.includes('installControllerMediaSession();')) throw new Error('V41: Media Session duplicada ainda presente.');

console.log('V41 aplicada: layout mobile dentro do core e uma única Media Session no áudio real.');
