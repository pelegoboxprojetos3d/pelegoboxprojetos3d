const STATIONS = [
  ["groovesalad", "Groove Salad", "Ambient / Downtempo"],
  ["groovesalad2", "Groove Salad 2", "Ambient / Downtempo"],
  ["dronezone", "Drone Zone", "Ambient / Drone"],
  ["spacestation", "Space Station Soma", "Eletrônica / Ambient"],
  ["secretagent", "Secret Agent", "Lounge / Exótica"],
  ["u80s", "Underground 80s", "Anos 80 / New Wave"],
  ["seventies", "Left Coast 70s", "Anos 70 / Rock / Pop"],
  ["indiepop", "Indie Pop Rocks!", "Indie / Pop / Rock"],
  ["poptron", "PopTron", "Indie Pop / Eletrônica"],
  ["metal", "Metal Detector", "Metal"],
  ["doomed", "Doomed", "Doom / Stoner Metal"],
  ["reggae", "Heavyweight Reggae", "Reggae / Dub"],
  ["bootliquor", "Boot Liquor", "Americana / Country"],
  ["sonicuniverse", "Sonic Universe", "Jazz"],
  ["beatblender", "Beat Blender", "Deep House / Chill"],
  ["cliqhop", "cliqhop idm", "IDM / Eletrônica"],
  ["thetrip", "The Trip", "Trance / Eletrônica"],
  ["dubstep", "Dub Step Beyond", "Dubstep / Bass"],
  ["fluid", "Fluid", "Instrumental Hip-Hop / Beats"],
  ["digitalis", "Digitalis", "Indie / Eletrônica"],
  ["lush", "Lush", "Dream Pop / Vocais"],
  ["covers", "Covers", "Covers / Alternativo"],
  ["deepspaceone", "Deep Space One", "Space Ambient"],
  ["defcon", "DEF CON Radio", "Eletrônica"],
  ["seven", "Seven Inch Soul", "Soul / Funk"],
  ["folkfwd", "Folk Forward", "Folk / Indie Folk"],
  ["illstreet", "Illinois Street Lounge", "Lounge / Exótica"],
  ["vaporwaves", "Vaporwaves", "Vaporwave / Chill"],
  ["synphaera", "Synphaera Radio", "Ambient / Eletrônica"]
].map(([id, name, genre]) => ({ id, name, genre }));

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display:block;
    width:100%;
    height:100%;
    min-height:0;
    font-family:Arial,Helvetica,sans-serif;
    color:#f6fff8;
    --green:#27e36e;
    --green2:#0c8f3f;
    --line:rgba(39,227,110,.32);
    --panel:#09110c;
    --muted:#96a49b;
  }
  *{box-sizing:border-box}
  .app{
    width:100%;height:100%;min-height:0;
    padding:10px;
    border:1px solid rgba(255,255,255,.08);
    border-radius:16px;
    overflow:hidden;
    background:
      radial-gradient(circle at 50% -20%,rgba(39,227,110,.15),transparent 42%),
      linear-gradient(180deg,#071009 0%,#030604 100%);
  }
  .head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 12px 10px;border-bottom:1px solid var(--line)}
  .brand strong{display:block;font-size:clamp(20px,2.2vw,31px);line-height:1;letter-spacing:.6px}.brand strong span{color:var(--green)}
  .brand small{display:block;color:var(--muted);font-size:11px;margin-top:6px}
  .live{display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:#bdfbd2;font-size:10px;font-weight:800;letter-spacing:.7px;background:rgba(39,227,110,.07)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green)}
  .main{height:calc(100% - 61px);min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:10px;padding-top:10px}
  .stage{min-height:0;position:relative;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:#050806;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
  .gridbg{position:absolute;inset:0;opacity:.55;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:30px 30px;pointer-events:none}
  .bars{height:105px;display:flex;align-items:flex-end;justify-content:center;gap:6px;position:relative;z-index:1;margin-bottom:12px}
  .bars i{display:block;width:7px;min-height:8px;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#8bffb7,var(--green));box-shadow:0 0 12px rgba(39,227,110,.22);animation:eq 1s ease-in-out infinite alternate;animation-play-state:paused}
  .playing .bars i{animation-play-state:running}.bars i:nth-child(2n){animation-delay:-.31s}.bars i:nth-child(3n){animation-delay:-.67s}.bars i:nth-child(5n){animation-delay:-.17s}
  .station{position:relative;z-index:1;text-align:center}.station h2{margin:0;color:#fff;font-size:clamp(21px,2.1vw,32px);letter-spacing:.5px}.station p{margin:7px 0 0;color:var(--muted);font-size:12px}
  .controls{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px;flex-wrap:wrap}
  button{border:1px solid rgba(255,255,255,.15);border-radius:10px;background:linear-gradient(180deg,#18221b,#0b100d);color:#f5fff7;padding:10px 16px;font-weight:800;cursor:pointer;transition:.15s ease}
  button:hover{transform:translateY(-1px);border-color:var(--line)}
  #play{min-width:118px;background:linear-gradient(180deg,#169d49,#08712f);border-color:rgba(39,227,110,.7)}
  #stop{border-color:rgba(255,75,75,.5);color:#ffaaaa}
  .volume{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:10px;margin-left:3px}.volume input{accent-color:var(--green);width:120px}
  .status{position:relative;z-index:1;min-height:15px;margin-top:10px;color:#8fa197;font-size:10px}
  .side{min-height:0;border:1px solid var(--line);border-radius:13px;background:rgba(8,15,10,.86);overflow:hidden;display:flex;flex-direction:column}
  .sidehead{padding:12px 13px 9px;border-bottom:1px solid rgba(39,227,110,.18);font-size:12px;font-weight:800;color:var(--green);letter-spacing:.4px}
  .list{overflow:auto;padding:7px;min-height:0;scrollbar-width:thin;scrollbar-color:#1c8c44 #071009}
  .stationbtn{width:100%;text-align:left;padding:9px 10px;margin:0 0 5px;border-radius:8px;background:#0b120e;border:1px solid rgba(255,255,255,.07)}
  .stationbtn b{display:block;font-size:11px}.stationbtn span{display:block;margin-top:3px;color:#7f9186;font-size:9px;font-weight:400}
  .stationbtn.active{border-color:rgba(39,227,110,.72);background:rgba(39,227,110,.11);color:#caffd9}
  audio{display:none}
  @keyframes eq{from{height:10px;opacity:.45}to{height:96px;opacity:1}}
  @media(max-width:780px){
    .app{padding:7px;border-radius:11px}.head{padding:7px 8px 9px}.brand small{font-size:9px}.live{padding:6px 8px;font-size:8px}
    .main{grid-template-columns:1fr;height:calc(100% - 55px);overflow:auto}.stage{min-height:330px}.side{min-height:250px}.list{max-height:240px}
    .volume{width:100%;justify-content:center;margin:2px 0 0}.volume input{width:150px}
  }
</style>
<section class="app" id="app">
  <header class="head">
    <div class="brand"><strong>PELEGO <span>RADIO</span></strong><small>Rádio Pelego Box • Player oficial</small></div>
    <div class="live"><span class="dot"></span> ONLINE</div>
  </header>
  <div class="main">
    <main class="stage">
      <div class="gridbg"></div>
      <div class="bars" aria-hidden="true">${"<i></i>".repeat(24)}</div>
      <div class="station"><h2 id="name">Groove Salad</h2><p id="genre">Ambient / Downtempo</p></div>
      <div class="controls">
        <button id="prev" type="button">◀ ANTERIOR</button>
        <button id="play" type="button">▶ TOCAR</button>
        <button id="next" type="button">PRÓXIMA ▶</button>
        <button id="stop" type="button">■ PARAR</button>
        <label class="volume">VOLUME <input id="volume" type="range" min="0" max="100" value="32"></label>
      </div>
      <div class="status" id="status">Escolha uma estação e clique em TOCAR.</div>
      <audio id="audio" preload="none" crossorigin="anonymous"></audio>
    </main>
    <aside class="side"><div class="sidehead">ESCOLHA O QUE QUER OUVIR</div><div class="list" id="list"></div></aside>
  </div>
</section>`;

class PelegoRadio extends HTMLElement {
  constructor(){
    super();
    this.attachShadow({mode:"open"});
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.index=0;
    this.server=5;
  }

  connectedCallback(){
    this.app=this.shadowRoot.getElementById("app");
    this.audio=this.shadowRoot.getElementById("audio");
    this.nameEl=this.shadowRoot.getElementById("name");
    this.genreEl=this.shadowRoot.getElementById("genre");
    this.statusEl=this.shadowRoot.getElementById("status");
    this.listEl=this.shadowRoot.getElementById("list");
    this.playEl=this.shadowRoot.getElementById("play");
    this.renderList();
    this.select(0,false);

    this.shadowRoot.getElementById("prev").onclick=()=>this.select((this.index-1+STATIONS.length)%STATIONS.length,true);
    this.shadowRoot.getElementById("next").onclick=()=>this.select((this.index+1)%STATIONS.length,true);
    this.shadowRoot.getElementById("stop").onclick=()=>this.stop();
    this.playEl.onclick=()=>this.toggle();
    this.shadowRoot.getElementById("volume").oninput=e=>{this.audio.volume=Number(e.target.value)/100};
    this.audio.volume=.32;
    this.audio.addEventListener("playing",()=>this.setPlaying(true));
    this.audio.addEventListener("pause",()=>this.setPlaying(false));
    this.audio.addEventListener("waiting",()=>this.setStatus("Conectando à estação..."));
    this.audio.addEventListener("error",()=>this.handleStreamError());
  }

  streamUrl(station,server=this.server){
    return `https://ice${server}.somafm.com/${station.id}-128-mp3`;
  }

  renderList(){
    this.listEl.replaceChildren(...STATIONS.map((station,i)=>{
      const b=document.createElement("button");
      b.className="stationbtn";
      b.type="button";
      b.dataset.index=String(i);
      b.innerHTML=`<b>${station.name}</b><span>${station.genre}</span>`;
      b.onclick=()=>this.select(i,true);
      return b;
    }));
  }

  select(index,autoplay=false){
    this.index=index;
    this.server=5;
    const station=STATIONS[index];
    this.nameEl.textContent=station.name;
    this.genreEl.textContent=station.genre;
    this.listEl.querySelectorAll(".stationbtn").forEach((el,i)=>el.classList.toggle("active",i===index));
    this.audio.src=this.streamUrl(station,5);
    this.audio.load();
    this.setStatus(autoplay?"Conectando à estação...":"Escolha uma estação e clique em TOCAR.");
    if(autoplay)this.play().catch(()=>{});
  }

  async play(){
    try{
      await this.audio.play();
      this.setStatus(`Tocando agora: ${STATIONS[this.index].name}`);
    }catch(error){
      this.setStatus("Clique em TOCAR para liberar o áudio no navegador.");
      throw error;
    }
  }

  toggle(){
    if(this.audio.paused)this.play().catch(()=>{});else this.audio.pause();
  }

  stop(){
    this.audio.pause();
    try{this.audio.currentTime=0}catch(_){}
    this.setStatus("Rádio parada.");
  }

  handleStreamError(){
    if(this.server===5){
      this.server=2;
      const wasPlaying=!this.audio.paused;
      this.audio.src=this.streamUrl(STATIONS[this.index],2);
      this.audio.load();
      this.setStatus("Trocando para servidor alternativo...");
      if(wasPlaying)this.play().catch(()=>{});
      return;
    }
    this.setPlaying(false);
    this.setStatus("Estação indisponível agora. Escolha outra estação.");
  }

  setPlaying(playing){
    this.app.classList.toggle("playing",playing);
    this.playEl.textContent=playing?"❚❚ PAUSAR":"▶ TOCAR";
    if(playing)this.setStatus(`Tocando agora: ${STATIONS[this.index].name}`);
  }

  setStatus(text){this.statusEl.textContent=text}
}

if(!customElements.get("pelego-radio"))customElements.define("pelego-radio",PelegoRadio);
