import './pelego-radio-core.js';

const CUBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5-8-4.5m8 4.5v9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const BARS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m4 10V6m4 14V3m4 17V8m4 12v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const HEADPHONES = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v7H5a1 1 0 0 1-1-1v-6Zm16 0h-3v7h2a1 1 0 0 0 1-1v-6Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
const GLOBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3c2.3 2.4 3.5 5.4 3.5 9S14.3 18.6 12 21c-2.3-2.4-3.5-5.4-3.5-9S9.7 5.4 12 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
const BRAZIL = `<svg viewBox="0 0 479.302 479.302" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><path d="M9.948,159.572c-0.2,2.6,1,4.5,2.4,6.5c1,1.5,2.2,3.2,2.4,4.9c0.3,2.8,1.8,3.5,4.1,4c2.6,0.6,4.7,2,5.4,4.8 c0.7,2.6,2.1,3.3,4.7,2.3c5.1-1.9,10.2-4,15.3-6c-0.1,0.6-0.3,1.5-0.4,2.4c-0.4,3.6-1,7.2-0.9,10.7c0.1,3.7,2.4,6,5.8,6 c6.6,0,13.1-0.1,19.7-0.3c3.2-0.1,6-1.3,8.2-3.8c0.3-0.3,0.7-0.8,1-0.7c3.9,0.7,6-2,8.4-4.3c2.7-2.6,5.8-4.4,9.8-4.3 c2.5,0.1,5.1-0.7,8-1.1c0,0,0.4,0.5,0.7,1.1c1.4,2.2,2,4.2,0.3,6.7c-0.8,1.3-0.4,3.4-0.5,5.2c-0.1,1.3,0.2,2.8-0.2,4 c-0.6,1.9-0.7,3.6,0.1,5.5c2.2,4.8,5.6,8.6,9.6,11.9c2.2,1.8,4.6,2.4,7.4,1.9c0.9-0.1,2,0.4,2.9,0.9c1.2,0.7,2.1,2.1,3.3,2.4 c1.8,0.5,3,1.3,4.1,2.6c1.5,1.8,3.4,3,5.8,2.6c1.8-0.3,2.6,0.2,3.1,2c1.1,3.8,3.4,4.9,7.3,4c1.1-0.3,2.6,0,3.7,0.5 c2.5,1.1,4.8,2.6,7.2,3.7c1.6,0.7,2.4,1.7,2.6,3.3c0.3,2.3,0.5,4.5,0.5,6.8c-0.1,3.1,0.3,6.3-2.4,8.8c-0.4,0.3-0.6,1.101-0.6,1.601 c0.3,2.6,0.8,5.1,2.9,6.899c3.5,3,7.6,4.8,12.2,5.2c2,0.2,4.1,0,6.2,0.1c2.7,0.101,3.6,1.4,2.9,3.9c-0.2,0.6-0.4,1.3-0.7,1.9 c-2.6,5.3-1,8.8,4.5,10.5c1.1,0.399,2.7,1.6,2.7,2.399c0.2,4.2,2,8.7-1.3,12.601c-0.4,0.399-0.8,0.899-0.9,1.5 c-0.2,1.1-0.6,2.5-0.2,3.399c0.5,1.101,0.5,1.7-0.2,2.601c-1.5,2-2.5,4-2.7,6.6c-0.3,5.3-1,10.6-1.4,15.9 c-0.2,2.6-0.3,5.3-0.2,7.899c0.1,2.2,1.3,4.101,3.5,4.601c3,0.6,6.1,1,9.1,1c8.1,0,14.1,7.199,12.7,15.199 c-0.4,2.101-0.3,4.4-0.2,6.601c0.1,2.8,1,3.399,3.8,2.899c1.3-0.199,2.6-0.6,3.9-0.699c3.2-0.2,5.5,1.8,5.1,5 c-0.4,3.6-1.1,7.3-2.3,10.699c-1.3,3.801-1.6,3.7,1.7,6.001c3.3,2.3,4.6,5.5,4.1,9.399c-0.3,2.601-1,5.101-1.1,7.7 c-0.1,4-2.8,6.1-5.8,7.1c-8.1,2.5-14.3,7.601-20.3,13.101c-3.7,3.399-6.9,7.2-10.3,10.899c-1.9,2-2,3.301-0.5,5.7 c0.4,0.7,0.8,1.4,1.3,2c2.4,3.101,5.5,5.7,4.5,10.4c-0.4,1.899,1,2.8,2.9,2.2c0.8-0.2,1.5-0.601,2.2-1.101c1.6-1.1,2.9-0.5,3.9,0.7 c3.9,4.9,8.3,9.1,13.2,12.8c2.2,1.601,3.9,3.7,4.3,6.4c0.3,2.3,1.7,2.5,3.5,2.3c1.7-0.2,3.3-0.7,5.1-1.1c1.1,2.3,2.8,2.6,4.4,0.6 c0.7-0.9,1.5-1.9,1.7-3c1.1-4.5,3.2-8.2,6.6-11.4c3.299-3.1,6.2-6.6,9.4-10.1c0.2,0.2,0.6,0.4,0.899,0.7 c2.5,2.6,5.4,2.399,7.301-0.601c1.1-1.8,2.199-3.6,3.1-5.6c1.6-3.4,3.9-5.9,6.9-8.1c2.1-1.601,3.899-3.601,5.399-5.7 c2.4-3.5,3.2-7.8,3.7-11.9c0.5-3.6,0.7-7.3,1.1-10.899c0.101-1.4,0.4-2.801,0.601-4.101c0.7-4.5,4.5-8,3.899-13 c1,0.5,1.7,1,2.5,1.4c1.4,0.6,2.5,0.399,3.2-1.2c1.5-3.6,4.7-5.3,8.101-6.3c2.7-0.9,5-2.101,7.2-3.9c2.5-2.1,5.1-4.1,8.8-3.9 c5.399,0.2,10.399-1.1,14.2-5.3c3.3-3.6,6.8-4.2,11-1.8c2.699,1.5,5.699,1.7,8.8,1.3c6-0.899,11.2-3.5,16.1-6.899 c3.8-2.7,7.2-5.801,9.2-10.2c1.3-2.9,3.3-5.2,6.4-6.4c1-0.399,2-0.8,2.699-1.5c3.9-4.7,7.801-9.5,11.601-14.399 c1.899-2.5,1-5.5,1.2-8.301c0.1-2.6,0.399-5.399,2.699-6.899c4-2.7,6-6.601,7.601-10.8c0.7-1.7,0.7-3.7,1-5.5 c-0.101-0.301,0.6-0.5,0.7-0.801c0.399-1.199,0.699-2.5,0.899-3.8c0.7-3.6,1.4-7.1,2-10.7c0.7-4.3,1.3-8.6,1.9-12.899 c0.6-4,0.8-8,1.6-12c0.5-2.8,2.101-5.3,5-6.2c9.4-3.2,15.9-9.3,18.7-18.8c1.4-4.6,4.1-6.8,8.6-7.6c5.101-0.9,9.801-2.7,12.801-7.3 c0.8-1.3,1.3-2.8,2.3-3.9c2.6-2.8,5.399-5.4,8.1-8.1c6.4-6.3,8.8-13.7,6.601-22.5c-0.801-3-1.2-6-1.7-9.1c-0.4-2.5-0.2-5.2-0.9-7.6 c-1.6-5.3-4.6-9.5-10.7-10.5c-1.699-0.3-3.3-0.8-5-1c-3.699-0.6-6.8-2.2-9.1-5c-4-5.1-7.9-10.4-11.6-15.7 c-2.4-3.4-4.2-7.1-9.101-7.5c-0.6,0-1.3-0.9-1.7-1.6c-2-3.5-5-5.3-8.899-5.7c-2.101-0.2-4.4-0.4-6.3,0.2 c-5.5,1.8-10.5,0.2-15.4-1.7c-2-0.7-4-2-5.4-3.5c-1.8-1.9-4-2.8-6.399-3.1c-4.601-0.7-8.9,0.6-13.101,2.2 c-2.1,0.8-4.3,1.6-6.699,2.4c1.1-4.3,2.1-8.2,3.199-12.1c0.5-1.9,0.301-2.9-1.699-3.7c-3-1.3-5.801-3-8.601-4.7 c-1.399-0.9-2.5-2.2-4-3.1c-5.3-3.2-11.1-5-17.2-6.2c-6.8-1.3-13.199-0.3-18.8,4.1c-2.8,2.2-5.6,4.3-8.3,6.3 c-0.9-2.1-2.2-3.9-3.8-5.3c1-0.1,2.1-0.4,3.1-0.8c2-0.8,4-1.7,5.7-2.9c3-2.3,6-4.7,8.7-7.4c1.6-1.6,1.2-2.9-0.9-3.9 c-5.8-2.8-12-3.9-18.399-3.9c-3,0-5.501,1.2-7.801,2.6c-2.399,1.5-4.5,3.3-7,4.7c-2,1.1-4.1,2.2-7.1,1.5 c0.899-1.9,1.399-3.8,2.5-5.3c4.5-6.2,10.1-11.1,16.8-14.8c1.9-1,3.5-2.3,3.101-4.8c-0.3-1.8,0.399-3,1.8-4 c1.1-0.8,2.1-1.7,3.5-2.9c-1.3-0.7-2.101-1.3-3.101-1.6c-1.899-0.7-4.1-1-5.899-1.9c-1.2-0.6-2.4-1.8-2.7-3 c-0.601-2.3-0.4-4.8-1-7.2c-1.2-5.5-2.7-11-4-16c-2.5-1.7-4.101-0.7-5.5,0.9c-1.4,1.5-3,2.8-4.3,4.4c-0.601,0.8-1.101,2-0.9,3 c0.4,3,0.4,3.5-2.4,4.2c-2.5,0.7-4,2.2-4.8,4.4c-0.6,1.6-1.8,2.4-3.399,2.8c-4.5,1.1-8.9,0.8-13.4,0.2c-3.399-0.5-6.5-1.3-8.5-4.4 c-0.399-0.7-1.399-1.2-2.1-1.3c-2.9-0.5-5.8-0.8-8.7-1.3c-2.1-0.4-3.3,0.3-4.5,2.1c-2.1,3.4-7.1,7.2-12.6,5 c-3.5-1.4-7.2-0.9-10.8,0.3c-3.4,1.1-6.9,1.9-10.4,2.5c-2.5,0.5-5,0.1-7-1.8c-4.3-4-6.8-9-7.5-14.9c-0.6-4.9,1.3-9.1,3.8-13 c2.7-4.1,2.6-4.6-1.1-7.5c-1.8-1.4-2.5-3-2-5.2c0.2-0.9,0.8-1.8,0.6-2.5c-0.2-1.1-0.7-2.5-1.5-2.9c-2.3-1.2-4.1-0.5-5.9,2 c-2.5,3.3-4.7,7-9.2,7.7c-3.2,0.5-6.5,0.8-9.8,1.1c-0.8,0.1-1.6-0.2-2.4-0.1c-2.5,0.1-3.8,1.8-5,3.7c-2.1,3.5-3,3.6-6,0.8 c-0.3-0.2-0.5-0.6-0.8-0.7c-2.7-1.4-5.3-2.8-8-3.9c-0.7-0.3-2.2,0.4-2.7,1.1c-1.8,2.5-1.8,5.4-1.1,8.3c1,3.8,2.8,6.7,6.7,8.5 c3.4,1.6,3.2,5.7,0,7.5c-1,0.6-2.2,0.9-3.2,1.5c-6.8,3.9-13.6,7.8-20.4,11.8c-1.4,0.9-2.7,0.9-4.1,0.3c-2.6-1.2-5.1-1.3-7.5,0.5 c-0.3,0.3-1.2,0.3-1.6,0c-3.1-2.1-5.6-4.6-6.3-8.6c-0.6-3.5-2.3-6.1-6.1-7c-2.6-0.6-4.9,0-7.3,0.8c-3.4,1.1-6.7,1.2-10.3,0.7 c-2.5-0.4-5.1-0.3-7.6,0c-1.7,0.2-2.8,1.6-3,3.4c-0.2,1.9,1,3,2.6,3.7c1.1,0.5,2.3,0.8,3.1,1.6c0.8,0.7,1.5,1.9,1.5,2.8 c0,0.7-1.1,1.7-1.9,2c-1.2,0.4-2.6,0.5-3.9,0.5c-4.7,0.2-6.9,3.1-5,7.4c1.2,2.7,2.9,5.3,4.8,7.6c3.5,4.5,3.9,8.7,0.7,13.3 c-1.8,2.6-3.5,5.3-2.5,8.8c0.2,0.7-0.1,1.6-0.5,2.3c-1.4,3-2.4,6.1-2.3,9.6c0,0.8-0.3,1.7-0.6,2.5c-0.5,1.8-1.4,3.6-1.5,5.4 c-0.3,4.4-2.2,6-6.3,4.7c-3.9-1.3-7.3-0.7-10.8,1.2c-1.2,0.6-2.7,0.7-4.1,0.8c-1.6,0-3.2-0.3-4.9-0.5c-0.4,2.2-1.9,3.1-3.9,3.4 c-0.5,0.1-0.9,0.4-1.3,0.7c-6.4,4.4-8.7,11.2-10.4,18.3c-0.5,1.9-0.6,3.7-2.9,4.8c-1.5,0.7-2.8,2.3-3.8,3.8 c-2.5,3.7-2.4,6.4,0.4,9.9C9.148,155.472,10.148,157.271,9.948,159.572z"/></svg>`;
const SAVE = `<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5V3Zm3 0v6h8V3M8 21v-7h8v7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const EYE = `<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m4 4 16 16" stroke="currentColor" stroke-width="2"/></svg>`;
const TRASH = `<svg viewBox="0 0 24 24"><path d="M5 7h14m-10 0V4h6v3m-8 0 1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

const SKIN = `
:host{width:100%!important;height:720px!important;max-height:none!important;min-height:720px!important;overflow:visible!important}
*{box-sizing:border-box}
.shell{
  width:100%!important;height:720px!important;max-height:none!important;min-height:720px!important;overflow:hidden!important;
  border:0!important;border-radius:0!important;background:#010504!important;box-shadow:none!important;
  padding:6px!important;gap:7px!important;
  grid-template-rows:40px 280px 160px 150px 50px!important;
}
.topbar{padding:0 8px!important;min-height:0!important}
.brandrow{gap:12px!important}.logo-bars{width:30px!important;height:29px!important}.title{font-size:24px!important;font-weight:400!important;letter-spacing:.2px!important}.title .green{font-weight:500!important}.subtitle{font-size:10px!important;margin-top:1px!important;color:#eef3f0!important}.win{gap:25px!important;font-size:17px!important;padding-right:4px!important}
.grid-top{grid-template-columns:1fr 1fr 1.04fr!important;gap:12px!important;min-height:0!important;overflow:hidden!important}
.panel{background:linear-gradient(180deg,#020806,#010504)!important;border:1px solid #13d94f!important;border-radius:10px!important;box-shadow:0 0 9px rgba(0,255,75,.08) inset!important}
.panel-title{height:27px!important;padding:0 10px!important;gap:8px!important;color:#19ef5d!important;font-size:12px!important;font-weight:700!important;letter-spacing:.2px!important}
.panel-title .pb-icon{width:18px!important;height:18px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 18px!important;color:#19ef5d!important}.panel-title .pb-icon svg{width:18px!important;height:18px!important;display:block!important}
.product{height:calc(100% - 27px)!important;padding:0 11px 9px!important;grid-template-rows:minmax(0,1fr) 68px!important;min-height:0!important}
.product>div:last-child{display:grid!important;grid-template-rows:43px 25px!important;min-height:0!important}
.product-visual{min-height:0!important;border:0!important;border-radius:6px!important;overflow:hidden!important;display:flex!important;align-items:stretch!important;justify-content:center!important;background:#020706!important}
.product-visual img{display:block!important;object-fit:contain!important}
.grid-top>.panel:nth-child(1) .product-visual img{width:42%!important;height:100%!important;background:#f4f4f4!important}
.grid-top>.panel:nth-child(2) .product-visual{background:#f2f2f2!important}.grid-top>.panel:nth-child(2) .product-visual img{width:100%!important;height:100%!important;background:#f2f2f2!important}
.product-meta{padding:7px 1px 0!important;min-height:0!important;overflow:hidden!important}.product-code{font-size:12px!important;line-height:1.15!important;color:#19ef5d!important}.product-desc{font-size:9px!important;line-height:1.15!important;margin-top:5px!important;color:#fff!important}
.grid-top>.panel:nth-child(1) .product-code,.grid-top>.panel:nth-child(1) .product-desc{text-align:center!important}
.navrow{grid-template-columns:1fr 1fr 1.08fr!important;gap:5px!important;margin-top:0!important;align-items:end!important}.vbtn{height:25px!important;border-radius:6px!important;padding:0 5px!important;font-size:10px!important;background:linear-gradient(#15201b,#070b09)!important;border:1px solid #33423b!important}.vbtn.buy{background:linear-gradient(#10c94c,#089134)!important;border-color:#16e75b!important;font-size:10px!important}
.analyzer{grid-template-rows:27px minmax(0,1fr) 22px!important}.analyzer canvas{width:calc(100% - 28px)!important;height:100%!important;margin:0 14px!important;border:1px solid #486058!important;background:#020707!important}.bands-label{font-size:8px!important;border-top:0!important}.bands-label span{border-right:1px solid #33443c!important}
.grid-middle{grid-template-columns:1.948fr 1fr!important;gap:12px!important;min-height:0!important;overflow:hidden!important}.filters{padding-bottom:0!important}.filterbody{grid-template-columns:112px minmax(0,1fr)!important;gap:9px!important;padding:0 11px 10px!important;height:calc(100% - 27px)!important}.scopebuttons{gap:8px!important}.scope{border-radius:6px!important;font-size:9px!important;gap:5px!important;background:linear-gradient(#0b1510,#050a07)!important;border-color:#30453b!important}.scope.active{background:linear-gradient(#0ec648,#078a31)!important;border-color:#18ef5d!important}.scope .scope-icon{width:35px!important;height:30px!important;font-size:0!important;color:#c5cbc8!important;display:flex!important;align-items:center!important;justify-content:center!important}.scope.active .scope-icon{color:#fff!important}.scope .scope-icon svg{width:100%!important;height:100%!important;display:block!important;fill:currentColor!important}#national .scope-icon{width:42px!important;height:36px!important;color:#c4cac7!important}#national .scope-icon svg{width:40px!important;height:36px!important;fill:currentColor!important;filter:drop-shadow(0 1px 0 rgba(0,0,0,.75))!important}#national.scope.active .scope-icon{color:#fff!important}
.genres{grid-template-columns:repeat(9,minmax(0,1fr))!important;grid-template-rows:repeat(6,1fr)!important;grid-auto-rows:auto!important;gap:5px!important;padding-top:1px!important;overflow:hidden!important}.genre{height:auto!important;min-height:0!important;border-radius:5px!important;font-size:7px!important;border-color:#35483f!important;background:linear-gradient(#131c18,#070b09)!important}.genre.active{background:linear-gradient(#0fbd47,#087d30)!important;border-color:#12de53!important}
.playbox{grid-template-rows:27px minmax(0,1fr)!important}.playbody{padding:0 14px 10px!important;grid-template-rows:9px 23px 18px 32px 8px 27px!important;gap:1px!important}.label{font-size:8px!important}.playbody select{height:23px!important;font-size:9px!important}.volrow{grid-template-columns:22px minmax(0,1fr) 32px!important;font-size:8px!important}.randomrow{gap:14px!important}.randomrow label{grid-template-rows:9px 21px!important}.randomrow label:first-child .label{background:#049a32!important;border:1px solid #16d954!important;text-align:center!important;padding-top:1px!important}.randomrow .label{font-size:7px!important}.hint{font-size:7px!important}.controls{gap:12px!important}.controls button{height:27px!important;font-size:10px!important;border-radius:5px!important}.controls .play{background:linear-gradient(#0fc14a,#087f31)!important}.controls .stop{background:linear-gradient(#d73931,#9b1c17)!important}
.eqpanel{position:relative!important;grid-template-rows:29px minmax(0,1fr) 23px!important;padding:0 11px 8px!important;min-height:0!important}.eqhead{min-height:0!important}.eqtitle{font-size:12px!important;font-weight:700!important}.preset{font-size:8px!important}.preset select{width:110px!important;height:23px!important;min-width:110px!important}.eqgrid{padding:0 8px 0 38px!important;gap:3px!important;min-height:0!important;overflow:hidden!important}.band{grid-template-rows:12px minmax(0,1fr) 13px!important;font-size:7px!important}.sliderwrap:before{height:88%!important;width:3px!important;background:linear-gradient(#335349,#17e75a,#335349)!important}.band input[type=range]{width:72px!important;height:16px!important}.band input::-webkit-slider-thumb{width:15px!important;height:15px!important;border-radius:1px!important}.eqgroups{margin-left:38px!important;height:23px!important}.eqgroups span{font-size:9px!important;padding-top:4px!important}.eqpanel:before{content:'+12\A 0\A -12';white-space:pre;position:absolute;left:17px;top:47px;bottom:42px;width:22px;display:flex;flex-direction:column;justify-content:space-between;color:#fff;font-size:7px;line-height:31px;pointer-events:none}
.footer{grid-template-columns:1fr 1fr 1.55fr 1.6fr!important;gap:10px!important;min-height:0!important}.footer button,.versionbox{height:100%!important;border:1px solid #293b33!important;border-radius:6px!important;background:linear-gradient(#17201d,#0b0f0d)!important}.footer button{font-size:13px!important;gap:14px!important}.footer .pb-foot-icon{width:23px;height:23px;display:inline-flex}.footer .pb-foot-icon svg{width:23px;height:23px;display:block}.footer .danger{color:#ff5d58!important}.versionbox{font-size:8px!important;color:#b4beb8!important}
@media(max-width:640px){
  :host{width:315px!important;max-width:315px!important;height:auto!important;max-height:none!important;min-height:0!important;margin:0 auto!important;overflow:visible!important}
  .shell{width:315px!important;max-width:315px!important;height:auto!important;min-height:1180px!important;max-height:none!important;overflow:hidden!important;grid-template-rows:auto auto auto auto auto!important;padding:5px!important;gap:7px!important}
  .topbar{min-height:42px!important;padding:0 4px!important}.brandrow{gap:6px!important}.logo-bars{width:22px!important;height:24px!important}.title{font-size:14px!important;white-space:nowrap!important}.subtitle{font-size:5.5px!important;white-space:nowrap!important;margin-top:2px!important}.win{display:none!important}
  .grid-top,.grid-middle{grid-template-columns:1fr!important;gap:7px!important;overflow:visible!important}
  .grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){min-height:270px!important}.grid-top>.panel:nth-child(3){min-height:330px!important}
  .grid-top>.panel:nth-child(1) .product-visual img{width:100%!important;height:100%!important;object-fit:contain!important}
  .panel-title{font-size:10px!important;height:25px!important}.product{height:calc(100% - 25px)!important;padding:0 6px 7px!important}.product-meta{padding-top:4px!important}.product-code{font-size:10px!important}.product-desc{font-size:7px!important}.vbtn,.vbtn.buy{height:24px!important;font-size:8px!important}
  .filters{min-height:300px!important}.filterbody{grid-template-columns:90px minmax(0,1fr)!important;padding:0 7px 8px!important;gap:6px!important}.genres{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-template-rows:none!important;grid-auto-rows:20px!important;overflow:auto!important}.scope{font-size:8px!important}.scope .scope-icon{width:30px!important;height:26px!important}
  .playbox{min-height:235px!important}.playbody{padding:0 8px 8px!important}.randomrow{gap:5px!important}.controls{gap:5px!important}
  .eqpanel{min-height:320px!important;overflow-x:auto!important;padding-left:6px!important;padding-right:6px!important}.eqgrid{min-width:760px!important;padding-left:30px!important}.eqgroups{min-width:760px!important;margin-left:30px!important}.eqpanel:before{left:8px!important}
  .footer{grid-template-columns:1fr 1fr!important;min-height:100px!important}.footer button{min-height:45px!important;font-size:10px!important}.versionbox{min-height:45px!important}
}
`;

function title(el, html){ if(el) el.innerHTML = html; }

function applySkin(el){
  const root = el?.shadowRoot;
  if(!root) return;
  if(!root.getElementById('pb-v548-reference-skin')){
    const style = document.createElement('style');
    style.id = 'pb-v548-reference-skin';
    style.textContent = SKIN;
    root.appendChild(style);
  }

  const top = root.querySelectorAll('.grid-top .panel-title');
  title(top[0], `<span class="pb-icon">${CUBE}</span>PROJETOS FEITOS DO ZERO`);
  title(top[1], `<span class="pb-icon">${CUBE}</span>PROJETOS PRONTOS`);
  title(top[2], `<span class="pb-icon">${BARS}</span>ANALISADOR - 24 BANDAS`);
  title(root.querySelector('.filters .panel-title'), `<span class="pb-icon">${HEADPHONES}</span>ESCOLHA O QUE QUER OUVIR`);
  title(root.querySelector('.playbox .panel-title'), `<span class="pb-icon" style="font-size:18px">♫</span>TOCANDO`);

  const international = root.querySelector('#international .scope-icon');
  if(international) international.innerHTML = GLOBE;
  const national = root.querySelector('#national .scope-icon');
  if(national) national.innerHTML = BRAZIL;

  const save = root.getElementById('save');
  if(save) save.innerHTML = `<span class="pb-foot-icon">${SAVE}</span><span>SALVAR</span>`;
  const hide = root.getElementById('hide');
  if(hide && !hide.dataset.pbSkin){ hide.innerHTML = `<span class="pb-foot-icon">${EYE}</span><span>OCULTAR</span>`; hide.dataset.pbSkin='1'; }
  const uninstall = root.getElementById('uninstall');
  if(uninstall) uninstall.innerHTML = `<span class="pb-foot-icon">${TRASH}</span><span>DESINSTALAR APLICATIVO</span>`;

  requestAnimationFrame(()=>{ try{ el.resizeCanvas?.(); el.drawIdleAnalyzer?.(); }catch(_){} });
}

function patchAnalyzer(Klass){
  if(!Klass || Klass.prototype.__pbReferencePatched) return;
  const p = Klass.prototype;
  p.__pbReferencePatched = true;

  p.drawAnalyzerGrid = function(c,w,h){
    c.fillStyle='#020707'; c.fillRect(0,0,w,h);
    const left=34,right=9,top=14,bottom=29;
    c.strokeStyle='rgba(69,103,90,.50)'; c.lineWidth=1;
    for(let i=0;i<=24;i++){ const x=left+(w-left-right)*(i/24); c.beginPath(); c.moveTo(x,top); c.lineTo(x,h-bottom); c.stroke(); }
    for(let i=0;i<=12;i++){ const y=top+(h-top-bottom)*(i/12); c.beginPath(); c.moveTo(left,y); c.lineTo(w-right,y); c.stroke(); }
    c.fillStyle='#e8eeea'; c.font='7px Arial';
    c.fillText('+12',2,15); c.fillText('+6',5,Math.round(h*.28)); c.fillText('0',8,Math.round(h*.51)); c.fillText('-6',5,Math.round(h*.72)); c.fillText('-12',2,h-26);
    const labels=['40','50','63','80','100','125','160','200','250','315','400','500','630','800','1K','1.25K','1.6K','2K','2.5K','3.15K','4K','6.3K','10K','16K'];
    labels.forEach((t,i)=>{ const x=left+(w-left-right)*((i+.5)/24); c.fillText(t,x-5,h-16); });
  };

  p.__pbDrawSegments = function(values){
    if(!this.ctx2d || !this.canvas) return;
    const r=this.canvas.getBoundingClientRect(),w=r.width,h=r.height,c=this.ctx2d;
    if(w<2||h<2) return;
    this.drawAnalyzerGrid(c,w,h);
    const left=34,right=9,top=14,bottom=30,usableW=w-left-right,usableH=h-top-bottom,bw=usableW/24,segs=12,gap=2,segH=Math.max(2,(usableH-(segs-1)*gap)/segs);
    for(let i=0;i<24;i++){
      const level=Math.max(1,Math.min(segs,Math.round((values[i]||0)*segs)));
      for(let s=0;s<level;s++){
        const y=h-bottom-(s+1)*segH-s*gap;
        c.fillStyle=s>=10?'#4cff7a':'#12d84d';
        c.fillRect(left+i*bw+2,y,Math.max(3,bw-4),segH);
      }
    }
  };

  p.drawIdleAnalyzer = function(){
    const vals=Array.from({length:24},(_,i)=>.25+.45*(.55+.45*Math.sin(i*.55+1.2)));
    this.__pbDrawSegments(vals);
  };

  p.drawAnalyzer = function(){
    cancelAnimationFrame(this.visualFrame);
    const loop=()=>{
      const values=Array(24).fill(.05);
      if(this.analyser && this.audioCtx){
        const bins=new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(bins);
        const freqs=[40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,6300,10000,16000];
        for(let i=0;i<24;i++){
          const idx=Math.min(bins.length-1,Math.round(freqs[i]/(this.audioCtx.sampleRate/2)*(bins.length-1)));
          let sum=0,count=0;
          for(let j=Math.max(0,idx-2);j<=Math.min(bins.length-1,idx+2);j++){sum+=bins[j];count++;}
          values[i]=(count?sum/count:0)/255;
        }
      }
      this.__pbDrawSegments(values);
      this.visualFrame=requestAnimationFrame(loop);
    };
    loop();
  };

  const originalConnected = p.connectedCallback;
  p.connectedCallback = function(){
    originalConnected?.call(this);
    applySkin(this);
  };
}

const RadioClass = customElements.get('pelego-radio');
patchAnalyzer(RadioClass);
queueMicrotask(()=>{
  document.querySelectorAll('pelego-radio').forEach(el=>applySkin(el));
});
