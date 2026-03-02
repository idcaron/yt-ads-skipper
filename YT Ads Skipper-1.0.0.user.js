// ==UserScript==
// @name         YT Ads Skipper
// @namespace    https://github.com/idcaron/yt-ads-skipper
// @version      1.0.0
// @description  Enterprise-grade YouTube ad skipper with HUD, profiles, stats, drag+snap UI
// @match        *://*.youtube.com/*
// @exclude      *://accounts.youtube.com/*
// @grant        none
// ==/UserScript==

(() => {
'use strict';

/* =========================================================
   CORE UTILITIES
========================================================= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const video = () => $('video');

const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));

/* =========================================================
   STORAGE
========================================================= */
const store = {
  get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k)) ?? d}catch{return d}},
  set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))
};

/* =========================================================
   STATE
========================================================= */
const STATE_KEY = 'yt_ads_skipper_state';

const state = store.get(STATE_KEY,{
  enabled:true,
  hudVisible:true,
  drag:false,
  volumePopup:true,
  autoHide:false,
  pos:{x:20,y:100},
  stats:{
    ads:0,
    sponsors:0,
    watch:0
  },
  profiles:{}
});

/* =========================================================
   CHANNEL PROFILE
========================================================= */
function channelId(){
  return location.pathname.startsWith('/watch')
    ? new URLSearchParams(location.search).get('v')
    : 'global';
}

function getProfile(){
  const id = channelId();
  return state.profiles[id] ||= { enabled:true };
}

/* =========================================================
   STYLE
========================================================= */
const css = `
#ytas-hud{
  position:fixed;
  top:${state.pos.y}px;
  right:${state.pos.x}px;
  z-index:2147483647;
  padding:14px 16px;
  min-width:220px;
  border-radius:18px;
  background:rgba(28,28,32,.65);
  backdrop-filter:blur(22px) saturate(180%);
  -webkit-backdrop-filter:blur(22px) saturate(180%);
  box-shadow:0 20px 50px rgba(0,0,0,.45);
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,system-ui;
  font-size:13px;
  transition:opacity .25s ease, transform .25s ease;
}
#ytas-hud.hidden{opacity:0;pointer-events:none;transform:scale(.96)}
#ytas-title{font-weight:600;margin-bottom:6px;cursor:move}
.ytas-row{opacity:.9;line-height:1.6}
.ytas-accent{color:#ff5da2;font-weight:600}
#ytas-footer{opacity:.6;margin-top:6px;font-size:11px}
.ytas-modal{
  position:fixed;inset:0;
  background:rgba(0,0,0,.45);
  display:flex;align-items:center;justify-content:center;
  z-index:2147483647;
}
.ytas-box{
  padding:18px;
  min-width:260px;
  border-radius:18px;
  background:rgba(28,28,32,.7);
  backdrop-filter:blur(24px);
  color:#fff;
}
.ytas-btn{margin:6px 0;cursor:pointer}
#ytas-vol{
  position:fixed;
  bottom:120px;
  right:30px;
  padding:12px;
  border-radius:14px;
  background:rgba(30,30,30,.7);
  backdrop-filter:blur(20px);
  z-index:2147483647;
}
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

/* =========================================================
   HUD
========================================================= */
const hud = document.createElement('div');
hud.id = 'ytas-hud';
hud.innerHTML = `
  <div id="ytas-title">YT Ads Skipper</div>
  <div class="ytas-row">Ad Skipper: <span id="s-enabled" class="ytas-accent"></span></div>
  <div class="ytas-row">Ads Skipped: <span id="s-ads" class="ytas-accent"></span></div>
  <div class="ytas-row">Sponsor Skips: <span id="s-sp" class="ytas-accent"></span></div>
  <div class="ytas-row">Watch Time: <span id="s-wt" class="ytas-accent"></span>s</div>
  <div id="ytas-footer">Made with ❤️ by Aron</div>
`;
document.body.appendChild(hud);

/* =========================================================
   HUD UPDATE
========================================================= */
function render(){
  $('#s-enabled').textContent = state.enabled ? 'ON' : 'OFF';
  $('#s-ads').textContent = state.stats.ads;
  $('#s-sp').textContent = state.stats.sponsors;
  $('#s-wt').textContent = state.stats.watch;
  hud.classList.toggle('hidden',!state.hudVisible);
  store.set(STATE_KEY,state);
}
render();

/* =========================================================
   DRAG + SNAP
========================================================= */
let dragOffset = null;

$('#ytas-title').addEventListener('mousedown',e=>{
  if(!state.drag)return;
  dragOffset = {x:e.clientX,y:e.clientY};
  e.preventDefault();
});

document.addEventListener('mousemove',e=>{
  if(!dragOffset)return;
  const dx = dragOffset.x - e.clientX;
  const dy = dragOffset.y - e.clientY;
  state.pos.x = clamp(state.pos.x + dx,10,window.innerWidth-240);
  state.pos.y = clamp(state.pos.y + dy,10,window.innerHeight-100);
  hud.style.right = state.pos.x+'px';
  hud.style.top = state.pos.y+'px';
  dragOffset = {x:e.clientX,y:e.clientY};
});

document.addEventListener('mouseup',()=>{
  dragOffset=null;
  store.set(STATE_KEY,state);
});

/* =========================================================
   ADS SKIPPER
========================================================= */
setInterval(()=>{
  if(!state.enabled)return;
  const v = video();
  if(!v)return;

  if($('.ad-showing')){
    v.muted = true;
    v.currentTime = v.duration || 9999;
    $('.ytp-ad-skip-button')?.click();
    state.stats.ads++;
    render();
  }
},700);

/* =========================================================
   WATCH TIME
========================================================= */
setInterval(()=>{
  if(video() && !video().paused){
    state.stats.watch++;
    render();
  }
},1000);

/* =========================================================
   VOLUME POPUP
========================================================= */
let volBox;
function showVolume(){
  if(!video())return;
  volBox?.remove();
  volBox = document.createElement('div');
  volBox.id='ytas-vol';
  volBox.textContent = `Volume: ${Math.round(video().volume*100)}%`;
  document.body.appendChild(volBox);
  setTimeout(()=>volBox?.remove(),1200);
}

/* =========================================================
   MODALS
========================================================= */
function settings(){
  const m=document.createElement('div');
  m.className='ytas-modal';
  m.innerHTML=`
    <div class="ytas-box">
      <div><b>Settings</b></div>
      <div class="ytas-btn">Toggle Ad Skipper</div>
      <div class="ytas-btn">Toggle HUD</div>
      <div class="ytas-btn">Toggle Drag</div>
    </div>`;
  m.onclick=()=>m.remove();
  m.querySelectorAll('.ytas-btn')[0].onclick=()=>{state.enabled=!state.enabled;render()};
  m.querySelectorAll('.ytas-btn')[1].onclick=()=>{state.hudVisible=!state.hudVisible;render()};
  m.querySelectorAll('.ytas-btn')[2].onclick=()=>{state.drag=!state.drag;render()};
  document.body.appendChild(m);
}

/* =========================================================
   HOTKEYS
========================================================= */
document.addEventListener('keydown',e=>{
  if(!e.altKey)return;
  const v = video();
  switch(e.code){
    case 'KeyF': state.hudVisible=!state.hudVisible; break;
    case 'KeyD': state.drag=!state.drag; break;
    case 'KeyP': settings(); return;
    case 'KeyA': state.enabled=!state.enabled; break;
    case 'KeyM': if(v)v.muted=!v.muted; break;
    case 'KeyR': if(v){const t=v.currentTime;v.src=v.src;v.currentTime=t} break;
    case 'KeyS': if(v){v.currentTime+=60;state.stats.sponsors++} break;
    case 'Equal': if(v){v.volume=clamp(v.volume+.05,0,1);showVolume()} break;
    case 'Minus': if(v){v.volume=clamp(v.volume-.05,0,1);showVolume()} break;
    case 'KeyV': showVolume(); break;
  }
  render();
});

})();