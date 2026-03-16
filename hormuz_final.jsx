import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as Tone from "tone";

/* ═══════ SOUND SYSTEM ═══════ */
const SFX = {
  ready: false,
  async init() {
    if (this.ready) return;
    try { await Tone.start(); this.ready = true; } catch(e) { console.warn("Audio init failed"); }
  },
  explosion() {
    if (!this.ready) return;
    const n = new Tone.NoiseSynth({ noise:{type:"brown"}, envelope:{attack:0.01,decay:0.4,sustain:0,release:0.3} }).toDestination();
    n.triggerAttackRelease("8n"); setTimeout(()=>n.dispose(),1500);
    const s = new Tone.Synth({ oscillator:{type:"sine"}, envelope:{attack:0,decay:0.3,sustain:0,release:0.2} }).toDestination();
    s.triggerAttackRelease("C2","8n"); setTimeout(()=>s.dispose(),1500);
  },
  splash() {
    if (!this.ready) return;
    const n = new Tone.NoiseSynth({ noise:{type:"white"}, envelope:{attack:0.01,decay:0.15,sustain:0,release:0.1}, volume:-12 }).toDestination();
    n.triggerAttackRelease("16n"); setTimeout(()=>n.dispose(),800);
  },
  click() {
    if (!this.ready) return;
    const s = new Tone.Synth({ oscillator:{type:"triangle"}, envelope:{attack:0,decay:0.05,sustain:0,release:0.05}, volume:-15 }).toDestination();
    s.triggerAttackRelease("C5","32n"); setTimeout(()=>s.dispose(),500);
  },
  alert() {
    if (!this.ready) return;
    const s = new Tone.Synth({ oscillator:{type:"square"}, envelope:{attack:0,decay:0.1,sustain:0.05,release:0.1}, volume:-10 }).toDestination();
    s.triggerAttackRelease("E5","16n"); setTimeout(()=>{s.triggerAttackRelease("G5","16n");setTimeout(()=>s.dispose(),500);},150);
  },
  turnEnd() {
    if (!this.ready) return;
    const s = new Tone.Synth({ oscillator:{type:"sine"}, envelope:{attack:0.01,decay:0.2,sustain:0,release:0.3}, volume:-8 }).toDestination();
    s.triggerAttackRelease("G4","8n"); setTimeout(()=>{s.triggerAttackRelease("C5","8n");setTimeout(()=>s.dispose(),600);},200);
  },
  mineHit() {
    if (!this.ready) return;
    const n = new Tone.NoiseSynth({ noise:{type:"pink"}, envelope:{attack:0,decay:0.6,sustain:0,release:0.4}, volume:-3 }).toDestination();
    n.triggerAttackRelease("4n"); setTimeout(()=>n.dispose(),2000);
    const s = new Tone.Synth({ oscillator:{type:"sawtooth"}, envelope:{attack:0,decay:0.5,sustain:0,release:0.3}, volume:-6 }).toDestination();
    s.triggerAttackRelease("E1","4n"); setTimeout(()=>s.dispose(),2000);
  },
  ambience: null,
  startAmbience() {
    if (!this.ready || this.ambience) return;
    this.ambience = new Tone.Noise({type:"brown",volume:-28}).toDestination();
    this.ambience.start();
    const lfo = new Tone.LFO({frequency:0.1,min:-30,max:-24}).start();
    lfo.connect(this.ambience.volume);
  },
  stopAmbience() { if (this.ambience) { this.ambience.stop(); this.ambience.dispose(); this.ambience = null; } },
};

/* ═══════ DATA ═══════ */
const FACTIONS = {
  iran: { name:"İran", color:0x22c55e, hex:"#22c55e", units:["drone","mine","missile","patrol","submarine"], budget:500, income:30, desc:"Boğazı kapat, düşman tankerlerini durdur" },
  coalition: { name:"Koalisyon", color:0x3b82f6, hex:"#3b82f6", units:["destroyer","minesweeper","interceptor","convoy","f35"], budget:800, income:20, desc:"Boğazı aç, tankerleri eskort et" },
};
const U = {
  drone:       {name:"Kamikaze Drone",  cost:15, atk:18, def:2,  spd:3, range:2, icon:"✈️",  yOff:0.9, sc:1.0},
  mine:        {name:"Deniz Mayını",    cost:20, atk:35, def:50, spd:0, range:0, icon:"💣",  yOff:0.08,sc:0.8},
  missile:     {name:"Cruise Füze",     cost:40, atk:45, def:5,  spd:4, range:3, icon:"🚀",  yOff:1.1, sc:0.9},
  patrol:      {name:"Devriye Botu",    cost:25, atk:15, def:20, spd:2, range:1, icon:"🚤",  yOff:0.15,sc:0.9},
  submarine:   {name:"Denizaltı",       cost:55, atk:35, def:30, spd:2, range:2, icon:"🔱",  yOff:0.02,sc:1.0},
  destroyer:   {name:"Muhrip",          cost:60, atk:30, def:40, spd:2, range:2, icon:"🚢",  yOff:0.18,sc:1.2},
  minesweeper: {name:"Mayın Tarama",    cost:35, atk:5,  def:25, spd:1, range:1, icon:"🔧",  yOff:0.15,sc:1.0},
  interceptor: {name:"Önleme Sistemi",  cost:45, atk:25, def:35, spd:3, range:2, icon:"🛡️",  yOff:0.2, sc:1.0},
  convoy:      {name:"Tanker Konvoy",   cost:30, atk:0,  def:15, spd:1, range:0, icon:"🛢️",  yOff:0.18,sc:1.3},
  f35:         {name:"F-35 Lightning",  cost:70, atk:40, def:10, spd:4, range:3, icon:"🦅",  yOff:1.4, sc:0.9},
};
const GW=12,GH=8,MAX_T=15,CELL=1.4;
const NEWS=[
  {t:"OPEC acil toplantı çağrısı!",e:8},{t:"Çin petrol rezervlerini açtı",e:-5},
  {t:"Sigorta primleri %300 arttı!",e:12},{t:"Suudi boru hattı artırıldı",e:-7},
  {t:"Hindistan LNG kıtlığı!",e:10},{t:"Lloyd's sigortayı askıya aldı",e:15},
  {t:"IEA stoklar serbest bırakıldı",e:-8},{t:"AB gaz fiyatları rekor!",e:9},
  {t:"Pakistan'da elektrik kesintileri!",e:6},{t:"Rusya ihracatı artırdı",e:-4},
];
const DIPLOMACY=[
  {t:"🇨🇳 Çin arabuluculuk teklif etti",effect:"ceasefire",desc:"Bu tur AI saldırmıyor",favor:"neutral"},
  {t:"🇷🇺 Rusya İran'a silah sevkiyatı yaptı",effect:"iran_boost",desc:"İran +$80M bütçe",favor:"iran"},
  {t:"🇪🇺 AB İran'a yeni yaptırımlar uyguladı",effect:"iran_nerf",desc:"İran geliri yarıya düştü",favor:"coalition"},
  {t:"🇺🇳 BM Güvenlik Konseyi ateşkes çağrısı",effect:"heal_all",desc:"Tüm birimler +10 HP",favor:"neutral"},
  {t:"🇬🇧 İngiltere donanma desteği gönderdi",effect:"coal_boost",desc:"Koalisyon +$60M bütçe",favor:"coalition"},
  {t:"🇮🇳 Hindistan tarafsızlık ilan etti",effect:"oil_stable",desc:"Petrol fiyatı $72'ye çekildi",favor:"neutral"},
  {t:"🇨🇳 Çin İran petrolü alımını artırdı",effect:"iran_income",desc:"İran geliri bu tur 2x",favor:"iran"},
  {t:"🇸🇦 S.Arabistan üretimi kıstı",effect:"oil_spike",desc:"Petrol +$20",favor:"iran"},
];
const WEATHER_TYPES={
  clear:{name:"Açık",icon:"☀️",spdMod:1,atkMod:1,rangeMod:1,fog:0.02,desc:"Normal koşullar"},
  storm:{name:"Fırtına",icon:"⛈️",spdMod:0.5,atkMod:0.7,rangeMod:0.8,fog:0.06,desc:"Hız ½, Saldırı %70, Menzil %80 — Drone'lar uçamaz!"},
  fog:{name:"Sis",icon:"🌫️",spdMod:1,atkMod:0.8,rangeMod:0.5,fog:0.08,desc:"Menzil ½, Saldırı %80 — Denizaltılar avantajlı!"},
};
const ACHIEVE_DEFS=[
  {id:"first_blood",name:"İlk Kan",icon:"🩸",desc:"İlk düşman birimini imha et",check:(s)=>s.totalKills>=1},
  {id:"convoy_hunter",name:"Konvoy Avcısı",icon:"🎯",desc:"3 tanker imha et",check:(s)=>s.destroyedConvoys>=3},
  {id:"mine_layer",name:"Mayıncı",icon:"💣",desc:"5 mayın döşe",check:(s)=>s.minesPlaced>=5},
  {id:"oil_baron",name:"Petrol Baronu",icon:"🛢️",desc:"Petrol $120'yi geçsin",check:(s)=>s.maxOil>=120},
  {id:"economist",name:"Ekonomist",icon:"💰",desc:"$1000M harca",check:(s)=>s.totalSpent>=1000},
  {id:"convoy_master",name:"Konvoy Ustası",icon:"🚢",desc:"5 konvoy geçir",check:(s)=>s.convoysPassed>=5},
  {id:"ace",name:"As Pilot",icon:"✈️",desc:"Tek birimle 3 kill al (terfi)",check:(s)=>s.hasPromotion},
  {id:"survivor",name:"Hayatta Kalan",icon:"🛡️",desc:"Hiç birim kaybetmeden 5 tur geç",check:(s)=>s.turnsNoLoss>=5},
  {id:"dominator",name:"Boğaz Hâkimi",icon:"👑",desc:"Boğazda 5+ birim bulundur",check:(s)=>s.straitControl>=5},
  {id:"crisis",name:"Kriz Yöneticisi",icon:"📊",desc:"Petrolü $60'ın altına düşür",check:(s)=>s.minOil<60},
];
const TUTORIAL_STEPS=[
  {step:0,title:"Hoş Geldin Komutan!",msg:"Bu Hürmüz Boğazı savaş simülasyonu. Sana adım adım göstereceğim.",action:"next",highlight:null},
  {step:1,title:"1️⃣ Birlik Satın Al",msg:"Alttaki çubuktan bir birim seç veya 1-5 tuşlarına bas. Her birimin farklı özellikleri var.",action:"buy",highlight:"quickbar"},
  {step:2,title:"2️⃣ Haritaya Yerleştir",msg:"Parlayan yeşil hücrelere tıklayarak birliğini konuşlandır.",action:"place",highlight:"map"},
  {step:3,title:"3️⃣ Birlik Seç & Hareket",msg:"Bir birliğine tıkla, sonra mavi hücrelere tıklayarak hareket ettir.",action:"move",highlight:"map"},
  {step:4,title:"4️⃣ Saldır!",msg:"Birliğini seçtikten sonra kırmızı halkalı düşmanlara tıklayarak saldır.",action:"attack",highlight:"map"},
  {step:5,title:"5️⃣ Turu Bitir",msg:"Hazır olduğunda 'Turu Bitir' butonuna bas. AI hamlesini yapar, petrol güncellenir.",action:"endturn",highlight:"endturn"},
  {step:6,title:"🎖️ Hazırsın!",msg:"15 turda en yüksek skoru almaya çalış! İyi savaşlar Komutan!",action:"done",highlight:null},
];
const uid=()=>Math.random().toString(36).slice(2,9);
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

function getTerrain(x,y){
  if(y===0&&x>=3&&x<=9)return 5;if(y===1&&x>=3&&x<=9)return 4;
  if(y===2&&x>=4&&x<=8)return 3;if(y===7&&x>=2&&x<=10)return 8;
  if(y===6&&x>=2&&x<=10)return 7;if(y===5&&x>=3&&x<=9)return 6;
  if(y>=3&&y<=4)return 1;return 0;
}
function isPlayableSea(x,y){const t=getTerrain(x,y);return t<=2||t===6;}
function canPlaceAt(x,y,ut,f){
  if(!isPlayableSea(x,y))return false;
  if(U[ut].spd===0&&getTerrain(x,y)>1)return false;
  if(f==="iran"){if(ut==="mine")return y>=3&&y<=5;return y<=5;}
  return y>=3;
}
function g2w(gx,gy){return new THREE.Vector3((gx-GW/2+0.5)*CELL,0,(gy-GH/2+0.5)*CELL);}

/* ═══════ TERRAIN BUILDER ═══════ */
function buildTerrain(scene){
  const g=new THREE.Group();
  // Iran - seamless merged geometry
  const iranShapes=[];
  for(let y=0;y<3;y++)for(let x=0;x<GW;x++){
    const t=getTerrain(x,y);if(t<3)continue;
    const wp=g2w(x,y);
    const h=t===5?0.9+Math.random()*0.6:t===4?0.45+Math.random()*0.2:0.18+Math.random()*0.1;
    const geo=new THREE.BoxGeometry(CELL*1.01,h,CELL*1.01);
    const cols=[0x2d5a27,0x1e4a20,0x3a6b30,0x264d22,0x2a5425];
    const mat=new THREE.MeshStandardMaterial({color:cols[Math.floor(Math.random()*cols.length)],roughness:0.85,flatShading:true});
    const m=new THREE.Mesh(geo,mat);m.position.set(wp.x,h/2-0.02,wp.z);m.castShadow=true;m.receiveShadow=true;g.add(m);
    if(t===5){
      const cnt=2+Math.floor(Math.random()*4);
      for(let i=0;i<cnt;i++){
        const pH=0.3+Math.random()*0.7;
        const pG=new THREE.ConeGeometry(0.12+Math.random()*0.25,pH,4+Math.floor(Math.random()*4));
        const pM=new THREE.MeshStandardMaterial({color:Math.random()>0.3?0x4a7a42:0x6b8a60,roughness:0.9,flatShading:true});
        const pk=new THREE.Mesh(pG,pM);pk.position.set(wp.x+(Math.random()-0.5)*0.7,h+pH/2-0.1,wp.z+(Math.random()-0.5)*0.7);
        pk.rotation.y=Math.random()*Math.PI;pk.castShadow=true;g.add(pk);
      }
      if(h>1){
        const sG=new THREE.SphereGeometry(0.18,6,4);
        const sM=new THREE.MeshStandardMaterial({color:0xeeeeff,roughness:0.3,emissive:0x444455,emissiveIntensity:0.1});
        const sn=new THREE.Mesh(sG,sM);sn.position.set(wp.x,h+0.4,wp.z);sn.scale.y=0.3;g.add(sn);
      }
    }
    if(t===3){
      const bG=new THREE.BoxGeometry(CELL*1.01,0.05,CELL*0.3);
      const bM=new THREE.MeshStandardMaterial({color:0xc2a878,roughness:0.95});
      const b=new THREE.Mesh(bG,bM);b.position.set(wp.x,0.025,wp.z+CELL*0.36);g.add(b);
    }
  }
  // Oman/UAE desert
  for(let y=5;y<GH;y++)for(let x=0;x<GW;x++){
    const t=getTerrain(x,y);if(t<6)continue;
    const wp=g2w(x,y);
    const h=t===8?0.55+Math.random()*0.45:t===7?0.3+Math.random()*0.15:0.12+Math.random()*0.08;
    const geo=new THREE.BoxGeometry(CELL*1.01,h,CELL*1.01);
    const cols=[0x9B8764,0x8B7355,0xA89070,0xB8A080,0x8a7050];
    const mat=new THREE.MeshStandardMaterial({color:cols[Math.floor(Math.random()*cols.length)],roughness:0.92,flatShading:true});
    const m=new THREE.Mesh(geo,mat);m.position.set(wp.x,h/2-0.02,wp.z);m.castShadow=true;m.receiveShadow=true;g.add(m);
    if(t===8){
      for(let i=0;i<1+Math.floor(Math.random()*3);i++){
        const dG=new THREE.SphereGeometry(0.2+Math.random()*0.25,8,6);
        const dM=new THREE.MeshStandardMaterial({color:0xC2A878,roughness:0.95,flatShading:true});
        const d=new THREE.Mesh(dG,dM);d.scale.y=0.35;
        d.position.set(wp.x+(Math.random()-0.5)*0.5,h+0.04,wp.z+(Math.random()-0.5)*0.5);d.castShadow=true;g.add(d);
      }
    }
    if(t===6){
      const bG=new THREE.BoxGeometry(CELL*1.01,0.05,CELL*0.3);
      const bM=new THREE.MeshStandardMaterial({color:0xd4b896,roughness:0.95});
      const b=new THREE.Mesh(bG,bM);b.position.set(wp.x,0.025,wp.z-CELL*0.36);g.add(b);
    }
  }
  scene.add(g);
}

function buildWater(scene){
  const wG=new THREE.PlaneGeometry(GW*CELL*1.8,GH*CELL*1.8,100,80);wG.rotateX(-Math.PI/2);
  const wM=new THREE.MeshPhysicalMaterial({color:0x0a3055,roughness:0.12,metalness:0.08,transparent:true,opacity:0.9,clearcoat:0.5,clearcoatRoughness:0.15});
  const w=new THREE.Mesh(wG,wM);w.position.y=-0.1;w.receiveShadow=true;scene.add(w);
  const fG=new THREE.PlaneGeometry(GW*CELL*1.8,GH*CELL*1.8);fG.rotateX(-Math.PI/2);
  const fM=new THREE.MeshStandardMaterial({color:0x040f1a});
  const f=new THREE.Mesh(fG,fM);f.position.y=-0.7;scene.add(f);
  return w;
}

function buildStraitDecor(scene){
  const g=new THREE.Group();
  // shipping lanes
  for(let lane=0;lane<2;lane++){
    const gy=3.3+lane*1.4;
    for(let x=-0.5;x<GW+0.5;x+=0.7){
      const wp=g2w(x,gy);
      const d=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.012,0.05),
        new THREE.MeshBasicMaterial({color:0x2288aa,transparent:true,opacity:0.3}));
      d.position.set(wp.x,0.015,wp.z);g.add(d);
    }
  }
  // flow arrows
  for(let x=0;x<GW;x+=1.8){
    const wp=g2w(x,4);
    const a=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.25,3),
      new THREE.MeshBasicMaterial({color:0x44aacc,transparent:true,opacity:0.2}));
    a.rotation.z=Math.PI/2;a.position.set(wp.x,0.02,wp.z);
    a.userData.flow=true;a.userData.bx=wp.x;g.add(a);
  }
  // buoys
  const bps=[[0,3],[0,5],[GW-1,3],[GW-1,5],[5,3],[7,5],[3,4],[9,4]];
  bps.forEach(([bx,by])=>{
    const wp=g2w(bx,by);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.5,6),
      new THREE.MeshStandardMaterial({color:0xcccccc}));
    pole.position.set(wp.x,0.25,wp.z);g.add(pole);
    const light=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8),
      new THREE.MeshBasicMaterial({color:bx<GW/2?0xff4444:0x44ff44}));
    light.position.set(wp.x,0.52,wp.z);light.userData.buoy=true;g.add(light);
    const pl=new THREE.PointLight(bx<GW/2?0xff4444:0x44ff44,0.4,2.5);
    pl.position.copy(light.position);g.add(pl);
  });
  // strait label
  const c=document.createElement("canvas");c.width=1024;c.height=96;
  const ctx=c.getContext("2d");
  ctx.font="bold 42px 'Segoe UI',Arial";ctx.fillStyle="rgba(80,160,200,0.45)";
  ctx.textAlign="center";ctx.fillText("━━━  HÜRMÜZ BOĞAZI  ━━━",512,58);
  const tex=new THREE.CanvasTexture(c);
  const lG=new THREE.PlaneGeometry(7,0.7);
  const lM=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
  const label=new THREE.Mesh(lG,lM);label.rotation.x=-Math.PI/2;
  label.position.set(0,0.04,g2w(0,4).z);g.add(label);
  scene.add(g);return g;
}

function buildLabels(scene){
  const g=new THREE.Group();
  const mk=(text,color,pos,sz)=>{
    const c=document.createElement("canvas");c.width=512;c.height=128;
    const ctx=c.getContext("2d");
    ctx.font=`bold ${sz}px 'Segoe UI',Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.strokeStyle="rgba(0,0,0,0.8)";ctx.lineWidth=5;ctx.strokeText(text,256,64);
    ctx.fillStyle=color;ctx.fillText(text,256,64);
    const tex=new THREE.CanvasTexture(c);
    const geo=new THREE.PlaneGeometry(3.5,0.9);
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    const m=new THREE.Mesh(geo,mat);m.position.copy(pos);m.userData.label=true;m.userData.by=pos.y;return m;
  };
  g.add(mk("🇮🇷  İ R A N","rgba(80,200,100,0.9)",new THREE.Vector3(0,1.8,g2w(0,0.5).z),52));
  g.add(mk("🇴🇲  UMMAN / BAE","rgba(200,170,120,0.9)",new THREE.Vector3(0,1.2,g2w(0,7).z),44));
  // ports
  [{n:"Bandar Abbas",x:8,y:2,c:"rgba(120,220,140,0.7)"},{n:"Muscat",x:9,y:6,c:"rgba(220,190,140,0.7)"},{n:"Fujairah",x:4,y:6,c:"rgba(220,190,140,0.7)"}].forEach(p=>{
    const wp=g2w(p.x,p.y);
    const lb=mk("⚓ "+p.n,p.c,new THREE.Vector3(wp.x,0.9,wp.z),30);lb.scale.setScalar(0.5);g.add(lb);
    const dock=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.18,0.7),new THREE.MeshStandardMaterial({color:0x555555,roughness:0.7}));
    dock.position.set(wp.x,0.09,wp.z);dock.castShadow=true;g.add(dock);
    const crane=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.6,0.05),new THREE.MeshStandardMaterial({color:0xbbaa00}));
    crane.position.set(wp.x+0.12,0.38,wp.z);g.add(crane);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.04,0.04),new THREE.MeshStandardMaterial({color:0xbbaa00}));
    arm.position.set(wp.x,0.65,wp.z);g.add(arm);
  });
  scene.add(g);return g;
}

function buildGrid(scene){
  const g=new THREE.Group();
  /* ─── GLASS TILE PLATFORMS ─── */
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    if(!isPlayableSea(x,y))continue;
    const wp=g2w(x,y);const t=getTerrain(x,y);
    const isStrait=t===1;
    const isCoast=t===6||t===2;
    // Floating glass platform
    const tileH=0.04;
    const tileGeo=new THREE.BoxGeometry(CELL*0.92,tileH,CELL*0.92);
    const tileColor=isStrait?0x0d3d6a:isCoast?0x0a3050:0x082840;
    const tileMat=new THREE.MeshPhysicalMaterial({
      color:tileColor,transparent:true,opacity:isStrait?0.35:0.2,
      roughness:0.1,metalness:0.05,clearcoat:0.8,clearcoatRoughness:0.1,
      side:THREE.DoubleSide
    });
    const tile=new THREE.Mesh(tileGeo,tileMat);
    tile.position.set(wp.x,0.025,wp.z);tile.receiveShadow=true;
    g.add(tile);

    // Glowing edge border
    const s=CELL*0.46;
    const edgeColor=isStrait?0x2288bb:0x1a4466;
    const edgeOp=isStrait?0.45:0.2;
    const pts=[new THREE.Vector3(-s,tileH+0.005,-s),new THREE.Vector3(s,tileH+0.005,-s),
      new THREE.Vector3(s,tileH+0.005,s),new THREE.Vector3(-s,tileH+0.005,s),new THREE.Vector3(-s,tileH+0.005,-s)];
    const edgeGeo=new THREE.BufferGeometry().setFromPoints(pts);
    const edgeLine=new THREE.Line(edgeGeo,new THREE.LineBasicMaterial({color:edgeColor,transparent:true,opacity:edgeOp}));
    edgeLine.position.set(wp.x,0.025,wp.z);
    g.add(edgeLine);

    // Strait danger zone underlight
    if(isStrait){
      const glowGeo=new THREE.PlaneGeometry(CELL*0.85,CELL*0.85);glowGeo.rotateX(-Math.PI/2);
      const glowMat=new THREE.MeshBasicMaterial({color:0xff4444,transparent:true,opacity:0.03,side:THREE.DoubleSide,depthWrite:false});
      const glow=new THREE.Mesh(glowGeo,glowMat);glow.position.set(wp.x,-0.02,wp.z);
      glow.userData.straitGlow=true;g.add(glow);
    }

    // Corner dots on tiles
    [[-s,-s],[s,-s],[s,s],[-s,s]].forEach(([cx,cz])=>{
      const dot=new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4),
        new THREE.MeshBasicMaterial({color:isStrait?0x44aadd:0x224466,transparent:true,opacity:0.4}));
      dot.position.set(wp.x+cx,0.055,wp.z+cz);g.add(dot);
    });
  }

  /* ─── COAST FOAM STRIPS ─── */
  // Iran coast foam (y=2-3 boundary)
  for(let x=0;x<GW;x++){
    const t=getTerrain(x,3);if(t!==1&&t!==0)continue;
    const tN=getTerrain(x,2);if(tN<3)continue;
    const wp=g2w(x,2.7);
    for(let i=0;i<4;i++){
      const foam=new THREE.Mesh(new THREE.PlaneGeometry(0.15+Math.random()*0.2,0.05+Math.random()*0.04),
        new THREE.MeshBasicMaterial({color:0xddeeff,transparent:true,opacity:0.2+Math.random()*0.15,side:THREE.DoubleSide,depthWrite:false}));
      foam.rotation.x=-Math.PI/2;foam.rotation.z=Math.random()*0.5;
      foam.position.set(wp.x+(Math.random()-0.5)*CELL*0.8,0.04,wp.z+(Math.random()-0.5)*0.3);
      foam.userData.foam=true;foam.userData.baseX=foam.position.x;
      g.add(foam);
    }
  }
  // Oman coast foam (y=5-6 boundary)
  for(let x=0;x<GW;x++){
    const t=getTerrain(x,5);if(t!==6)continue;
    const wp=g2w(x,5.3);
    for(let i=0;i<4;i++){
      const foam=new THREE.Mesh(new THREE.PlaneGeometry(0.15+Math.random()*0.2,0.05+Math.random()*0.04),
        new THREE.MeshBasicMaterial({color:0xddeeff,transparent:true,opacity:0.2+Math.random()*0.15,side:THREE.DoubleSide,depthWrite:false}));
      foam.rotation.x=-Math.PI/2;foam.rotation.z=Math.random()*0.5;
      foam.position.set(wp.x+(Math.random()-0.5)*CELL*0.8,0.04,wp.z+(Math.random()-0.5)*0.3);
      foam.userData.foam=true;foam.userData.baseX=foam.position.x;
      g.add(foam);
    }
  }

  /* ─── OIL PLATFORMS ─── */
  const rigPositions=[{x:2,y:4},{x:10,y:3},{x:6,y:5},{x:8,y:4}];
  rigPositions.forEach(({x:rx,y:ry})=>{
    if(!isPlayableSea(rx,ry))return;
    const wp=g2w(rx,ry);
    // platform legs
    for(let lx of [-0.15,0.15])for(let lz of [-0.15,0.15]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.02,0.6,4),
        new THREE.MeshStandardMaterial({color:0x666666,roughness:0.6,metalness:0.5}));
      leg.position.set(wp.x+lx,0.15,wp.z+lz);leg.castShadow=true;g.add(leg);
    }
    // deck
    const deck=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.04,0.45),
      new THREE.MeshStandardMaterial({color:0x555555,roughness:0.7,metalness:0.4}));
    deck.position.set(wp.x,0.45,wp.z);deck.castShadow=true;g.add(deck);
    // derrick tower
    const derrick=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.04,0.5,4),
      new THREE.MeshStandardMaterial({color:0xcc8800,roughness:0.5}));
    derrick.position.set(wp.x+0.05,0.72,wp.z);derrick.castShadow=true;g.add(derrick);
    // crane arm
    const crane=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.015,0.015),
      new THREE.MeshStandardMaterial({color:0xcc8800,roughness:0.5}));
    crane.position.set(wp.x-0.05,0.95,wp.z);g.add(crane);
    // red warning light
    const light=new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6),
      new THREE.MeshBasicMaterial({color:0xff3300}));
    light.position.set(wp.x+0.05,0.98,wp.z);
    light.userData.rigLight=true;g.add(light);
    const pl=new THREE.PointLight(0xff3300,0.3,2);pl.position.copy(light.position);g.add(pl);
    // helipad marking
    const pad=new THREE.Mesh(new THREE.RingGeometry(0.06,0.08,16),
      new THREE.MeshBasicMaterial({color:0xffff00,transparent:true,opacity:0.3,side:THREE.DoubleSide}));
    pad.rotation.x=-Math.PI/2;pad.position.set(wp.x-0.1,0.475,wp.z+0.1);g.add(pad);
    // small flame on flare stack
    const flare=new THREE.Mesh(new THREE.ConeGeometry(0.02,0.06,4),
      new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:0.7}));
    flare.position.set(wp.x+0.15,0.5,wp.z-0.1);flare.userData.flare=true;g.add(flare);
    const flareLight=new THREE.PointLight(0xff6600,0.2,1.5);
    flareLight.position.copy(flare.position);g.add(flareLight);
  });

  /* ─── CURRENT FLOW PARTICLES ─── */
  for(let i=0;i<30;i++){
    const px=(Math.random()-0.5)*GW*CELL;
    const py=g2w(0,3.5+Math.random()*1.5).z;
    const dot=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),
      new THREE.MeshBasicMaterial({color:0x44bbdd,transparent:true,opacity:0.3}));
    dot.position.set(px,0.03,py);
    dot.userData.currentDot=true;dot.userData.speed=0.2+Math.random()*0.3;
    dot.userData.baseZ=py;
    g.add(dot);
  }

  /* ─── DEPTH GRADIENT CIRCLES under deep water ─── */
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const t=getTerrain(x,y);if(t>2)continue;
    const wp=g2w(x,y);
    const depthGeo=new THREE.CircleGeometry(CELL*0.4,12);depthGeo.rotateX(-Math.PI/2);
    const depthCol=t===0?0x030a18:t===1?0x061525:0x081a2a;
    const depthMat=new THREE.MeshBasicMaterial({color:depthCol,transparent:true,opacity:0.3,depthWrite:false});
    const depth=new THREE.Mesh(depthGeo,depthMat);depth.position.set(wp.x,-0.15,wp.z);
    g.add(depth);
  }

  scene.add(g);
  return g;
}

/* ═══════ UNIT 3D — MUCH BIGGER ═══════ */
function createUnit3D(type,fColor){
  const group=new THREE.Group();
  const u=U[type];const S=u.sc;
  const mat=new THREE.MeshStandardMaterial({color:fColor,roughness:0.35,metalness:0.35,flatShading:true});
  const mat2=new THREE.MeshStandardMaterial({color:0x333340,roughness:0.4,metalness:0.5});
  const matW=new THREE.MeshStandardMaterial({color:0xdddddd,roughness:0.3,metalness:0.4});
  const matR=new THREE.MeshStandardMaterial({color:0xcc2222,roughness:0.4,metalness:0.3});
  const add=(m)=>{m.castShadow=true;group.add(m);};

  if(type==="destroyer"){
    add(new THREE.Mesh(new THREE.BoxGeometry(0.95*S,0.16*S,0.3*S),mat).translateY(0));
    const bow=new THREE.Mesh(new THREE.ConeGeometry(0.15*S,0.35*S,4),mat);bow.rotation.z=Math.PI/2;bow.position.set(-0.6*S,0,0);add(bow);
    const br=new THREE.Mesh(new THREE.BoxGeometry(0.2*S,0.16*S,0.2*S),matW);br.position.set(0.15*S,0.15*S,0);add(br);
    const radar=new THREE.Mesh(new THREE.CylinderGeometry(0.015*S,0.015*S,0.2*S,4),mat2);radar.position.set(0.15*S,0.3*S,0);add(radar);
    const dish=new THREE.Mesh(new THREE.BoxGeometry(0.12*S,0.08*S,0.03*S),matW);dish.position.set(0.15*S,0.4*S,0);dish.userData.spin=true;add(dish);
    [-0.25,0.35].forEach(tx=>{
      const t=new THREE.Mesh(new THREE.CylinderGeometry(0.05*S,0.06*S,0.08*S,8),mat2);t.position.set(tx*S,0.1*S,0);add(t);
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.012*S,0.012*S,0.18*S,4),mat2);b.rotation.z=Math.PI/2.5;b.position.set((tx-0.08)*S,0.16*S,0);add(b);
    });
    // waterline
    add(new THREE.Mesh(new THREE.BoxGeometry(1*S,0.03*S,0.32*S),new THREE.MeshStandardMaterial({color:0x881111,roughness:0.8})).translateY(-0.08*S));
  } else if(type==="convoy"){
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1*S,0.16*S,0.35*S),mat).translateY(0));
    const bow=new THREE.Mesh(new THREE.ConeGeometry(0.17*S,0.28*S,4),mat);bow.rotation.z=Math.PI/2;bow.position.set(-0.65*S,0,0);add(bow);
    const tkM=new THREE.MeshStandardMaterial({color:0x882200,roughness:0.45,metalness:0.3});
    for(let i=-1;i<=1;i++){
      const tk=new THREE.Mesh(new THREE.CylinderGeometry(0.09*S,0.09*S,0.35*S,10),tkM);tk.rotation.z=Math.PI/2;tk.position.set(i*0.25*S,0.14*S,0);add(tk);
    }
    const br=new THREE.Mesh(new THREE.BoxGeometry(0.14*S,0.18*S,0.2*S),matW);br.position.set(0.42*S,0.18*S,0);add(br);
    const funnel=new THREE.Mesh(new THREE.CylinderGeometry(0.03*S,0.04*S,0.15*S,6),mat2);funnel.position.set(0.35*S,0.3*S,0);add(funnel);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.15*S,0.03*S,0.37*S),new THREE.MeshStandardMaterial({color:0x881111,roughness:0.8})).translateY(-0.08*S));
  } else if(type==="minesweeper"){
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7*S,0.12*S,0.25*S),mat).translateY(0));
    const bow=new THREE.Mesh(new THREE.ConeGeometry(0.12*S,0.22*S,4),mat);bow.rotation.z=Math.PI/2;bow.position.set(-0.42*S,0,0);add(bow);
    const br=new THREE.Mesh(new THREE.BoxGeometry(0.12*S,0.12*S,0.16*S),matW);br.position.set(0.12*S,0.12*S,0);add(br);
    const armM=new THREE.MeshStandardMaterial({color:0xf59e0b,metalness:0.4,roughness:0.3});
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.02*S,0.02*S,0.6*S,4),armM);arm.rotation.z=Math.PI/3;arm.position.set(-0.4*S,0.05*S,0);add(arm);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.06*S,8,8),armM);head.position.set(-0.65*S,-0.1*S,0);add(head);
    // sweep cable visual
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(0.008*S,0.008*S,0.8*S,3),new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:0.5}));
    cable.rotation.z=Math.PI/4;cable.position.set(-0.45*S,-0.05*S,0.1*S);add(cable);
  } else if(type==="patrol"){
    add(new THREE.Mesh(new THREE.BoxGeometry(0.55*S,0.1*S,0.2*S),mat).translateY(0));
    const bow=new THREE.Mesh(new THREE.ConeGeometry(0.1*S,0.2*S,4),mat);bow.rotation.z=Math.PI/2;bow.position.set(-0.35*S,0,0);add(bow);
    const br=new THREE.Mesh(new THREE.BoxGeometry(0.1*S,0.1*S,0.14*S),matW);br.position.set(0.08*S,0.1*S,0);add(br);
    const gun=new THREE.Mesh(new THREE.CylinderGeometry(0.015*S,0.015*S,0.12*S,4),mat2);gun.rotation.z=Math.PI/3;gun.position.set(-0.15*S,0.1*S,0);add(gun);
  } else if(type==="interceptor"){
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5*S,0.12*S,0.4*S),mat).translateY(0));
    const dome=new THREE.Mesh(new THREE.SphereGeometry(0.14*S,12,8),matW);dome.scale.y=0.5;dome.position.y=0.12*S;dome.userData.spin=true;add(dome);
    for(let i=-1;i<=1;i+=2){
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.04*S,0.04*S,0.25*S,6),new THREE.MeshStandardMaterial({color:0x556655,metalness:0.5}));
      tube.position.set(-0.12*S,0.12*S,i*0.14*S);tube.rotation.z=-0.4;add(tube);
    }
  } else if(type==="drone"){
    const body=new THREE.Mesh(new THREE.ConeGeometry(0.07*S,0.35*S,5),mat);body.rotation.z=-Math.PI/2;add(body);
    const wing=new THREE.Mesh(new THREE.BoxGeometry(0.04*S,0.015*S,0.45*S),mat);add(wing);
    const tail=new THREE.Mesh(new THREE.BoxGeometry(0.025*S,0.1*S,0.12*S),mat);tail.position.set(0.16*S,0.03*S,0);add(tail);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.03*S,6,6),new THREE.MeshBasicMaterial({color:0xff6600}));
    glow.position.set(0.2*S,0,0);glow.name="glow";add(glow);
    // engine trail light
    const el=new THREE.PointLight(0xff4400,0.5,1.5);el.position.set(0.2*S,0,0);group.add(el);
  } else if(type==="missile"){
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.035*S,0.055*S,0.4*S,6),mat);body.rotation.z=-Math.PI/2;add(body);
    const fins=new THREE.Mesh(new THREE.BoxGeometry(0.025*S,0.14*S,0.1*S),mat2);fins.position.set(0.16*S,0,0);add(fins);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(0.04*S,0.15*S,6),new THREE.MeshBasicMaterial({color:0xff4400}));
    flame.rotation.z=Math.PI/2;flame.position.set(0.25*S,0,0);flame.name="flame";add(flame);
    const el=new THREE.PointLight(0xff4400,0.8,2);el.position.set(0.25*S,0,0);group.add(el);
  } else if(type==="mine"){
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.14*S,12,12),new THREE.MeshStandardMaterial({color:0x222222,roughness:0.3,metalness:0.7}));add(body);
    for(let i=0;i<10;i++){
      const a=i*Math.PI*2/10;
      const sp=new THREE.Mesh(new THREE.ConeGeometry(0.02*S,0.08*S,4),matR);
      sp.position.set(Math.cos(a)*0.14*S,Math.sin(a)*0.08*S,Math.cos(a*1.5)*0.08*S);
      const d=sp.position.clone().normalize();sp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);add(sp);
    }
    const chain=new THREE.Mesh(new THREE.CylinderGeometry(0.008*S,0.008*S,0.25*S,3),mat2);chain.position.y=-0.18*S;add(chain);
    // danger glow
    const gl=new THREE.PointLight(0xff2222,0.3,1.5);gl.position.y=0;group.add(gl);gl.name="mineGlow";
  } else if(type==="submarine"){
    // cigar-shaped hull, conning tower, periscope
    const hull=new THREE.Mesh(new THREE.CylinderGeometry(0.1*S,0.08*S,0.9*S,10),mat);
    hull.rotation.z=Math.PI/2;add(hull);
    const bow=new THREE.Mesh(new THREE.SphereGeometry(0.1*S,8,8),mat);bow.position.set(-0.45*S,0,0);add(bow);
    const stern=new THREE.Mesh(new THREE.SphereGeometry(0.08*S,8,8),mat);stern.position.set(0.45*S,0,0);add(stern);
    // conning tower
    const tower=new THREE.Mesh(new THREE.BoxGeometry(0.15*S,0.12*S,0.08*S),mat);tower.position.set(0.05*S,0.1*S,0);add(tower);
    // periscope
    const peri=new THREE.Mesh(new THREE.CylinderGeometry(0.01*S,0.01*S,0.2*S,4),mat2);peri.position.set(0.05*S,0.22*S,0);add(peri);
    const periTop=new THREE.Mesh(new THREE.BoxGeometry(0.03*S,0.01*S,0.02*S),mat2);periTop.position.set(0.05*S,0.33*S,0);add(periTop);
    // tail fins
    const finV=new THREE.Mesh(new THREE.BoxGeometry(0.02*S,0.12*S,0.02*S),mat);finV.position.set(0.42*S,0,0);add(finV);
    const finH=new THREE.Mesh(new THREE.BoxGeometry(0.02*S,0.02*S,0.15*S),mat);finH.position.set(0.42*S,0,0);add(finH);
    // propeller
    const prop=new THREE.Mesh(new THREE.CircleGeometry(0.05*S,5),mat2);prop.position.set(0.48*S,0,0);prop.rotation.y=Math.PI/2;add(prop);
    // underwater glow
    const ugl=new THREE.PointLight(fColor,0.4,2);ugl.position.set(0,-0.1*S,0);group.add(ugl);
    // bubble effect markers
    group.userData.isSub=true;
  } else if(type==="f35"){
    // sleek fighter jet
    const body=new THREE.Mesh(new THREE.ConeGeometry(0.06*S,0.55*S,5),mat);body.rotation.z=-Math.PI/2;add(body);
    // delta wings
    const wingGeo=new THREE.BufferGeometry();
    const wingVerts=new Float32Array([0,0,-0.3*S, 0,0,0.3*S, -0.2*S,0,0, 0,0,-0.3*S, -0.2*S,0,0, 0,0,0.3*S]);
    wingGeo.setAttribute('position',new THREE.BufferAttribute(wingVerts,3));wingGeo.computeVertexNormals();
    const wing=new THREE.Mesh(wingGeo,new THREE.MeshStandardMaterial({color:fColor,roughness:0.3,metalness:0.5,side:THREE.DoubleSide,flatShading:true}));
    wing.position.set(0.05*S,0,0);add(wing);
    // tail
    const tailV=new THREE.Mesh(new THREE.BoxGeometry(0.02*S,0.1*S,0.02*S),mat);tailV.position.set(0.25*S,0.04*S,0);add(tailV);
    // twin tail fins (angled)
    for(let side of [-1,1]){
      const tf=new THREE.Mesh(new THREE.BoxGeometry(0.06*S,0.06*S,0.01*S),mat);
      tf.position.set(0.22*S,0.03*S,side*0.06*S);tf.rotation.z=side*0.3;add(tf);
    }
    // engine glow (twin)
    for(let side of [-0.025,0.025]){
      const eng=new THREE.Mesh(new THREE.SphereGeometry(0.02*S,6,6),new THREE.MeshBasicMaterial({color:0x4488ff}));
      eng.position.set(0.28*S,0,side*S);eng.name="jetGlow";add(eng);
      const el=new THREE.PointLight(0x4488ff,0.4,1.5);el.position.set(0.28*S,0,side*S);group.add(el);
    }
    // cockpit
    const cockpit=new THREE.Mesh(new THREE.SphereGeometry(0.03*S,6,4),new THREE.MeshStandardMaterial({color:0x88ccff,roughness:0.1,metalness:0.8}));
    cockpit.scale.y=0.4;cockpit.position.set(-0.12*S,0.04*S,0);add(cockpit);
    group.userData.isJet=true;
  }

  // shadow on water
  const shadowGeo=new THREE.CircleGeometry(0.3*S,16);shadowGeo.rotateX(-Math.PI/2);
  const shadowMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.2,depthWrite:false});
  const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.position.y=-u.yOff+0.02;group.add(shadow);

  group.userData={unitType:type,bobPhase:Math.random()*Math.PI*2,sc:S};
  return group;
}

/* HP Bar — bigger */
function createHPBar(){
  const c=document.createElement("canvas");c.width=128;c.height=24;
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,sizeAttenuation:true});
  const sp=new THREE.Sprite(mat);sp.scale.set(1,0.18,1);
  sp.userData.c=c;sp.userData.t=tex;return sp;
}
function updateHP(sp,hp,maxHp,hex,isEnemy=false){
  const c=sp.userData.c;const ctx=c.getContext("2d");
  ctx.clearRect(0,0,128,24);
  // Background - darker for enemies
  ctx.fillStyle=isEnemy?"rgba(60,10,10,0.8)":"rgba(0,0,0,0.7)";
  ctx.beginPath();ctx.roundRect(0,0,128,24,5);ctx.fill();
  const pct=hp/maxHp;const w=Math.max(3,pct*122);
  if(isEnemy){
    // Enemy bars are always red-toned
    const grad=ctx.createLinearGradient(3,0,w+3,0);
    grad.addColorStop(0,"#991b1b");grad.addColorStop(1,"#ef4444");
    ctx.fillStyle=grad;
  } else {
    const grad=ctx.createLinearGradient(3,0,w+3,0);
    if(pct>0.6){grad.addColorStop(0,"#15803d");grad.addColorStop(1,"#22c55e");}
    else if(pct>0.3){grad.addColorStop(0,"#b45309");grad.addColorStop(1,"#f59e0b");}
    else{grad.addColorStop(0,"#991b1b");grad.addColorStop(1,"#ef4444");}
    ctx.fillStyle=grad;
  }
  ctx.beginPath();ctx.roundRect(3,3,w,18,3);ctx.fill();
  // Side stripe - red for enemy, faction color for friendly
  ctx.fillStyle=isEnemy?"#ef4444":hex;
  ctx.fillRect(0,0,5,24);
  // Enemy skull icon
  if(isEnemy){ctx.fillStyle="rgba(255,255,255,0.5)";ctx.font="bold 11px sans-serif";ctx.fillText("☠",112,16);}
  sp.userData.t.needsUpdate=true;
}

/* Placement zone pillar */
function createPlacementPillar(color){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.PlaneGeometry(CELL*0.92,CELL*0.92),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false}));
  base.rotateX(-Math.PI/2);base.position.y=0.025;g.add(base);
  // border
  const s=CELL*0.46;
  const borderPts=[new THREE.Vector3(-s,0.03,-s),new THREE.Vector3(s,0.03,-s),
    new THREE.Vector3(s,0.03,s),new THREE.Vector3(-s,0.03,s),new THREE.Vector3(-s,0.03,-s)];
  const bGeo=new THREE.BufferGeometry().setFromPoints(borderPts);
  g.add(new THREE.Line(bGeo,new THREE.LineBasicMaterial({color,linewidth:2})));
  // corner pillars
  [[-s,-s],[s,-s],[s,s],[-s,s]].forEach(([cx,cz])=>{
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.3,4),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.6}));
    p.position.set(cx,0.15,cz);g.add(p);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6),
      new THREE.MeshBasicMaterial({color}));
    tip.position.set(cx,0.32,cz);g.add(tip);
  });
  return g;
}

function spawnExplosion(scene,pos,count=30){
  const ps=[];
  for(let i=0;i<count;i++){
    const sz=0.03+Math.random()*0.08;
    const geo=new THREE.SphereGeometry(sz,5,5);
    const cols=[0xff4444,0xff8800,0xffcc00,0xffffff,0xff5500];
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:cols[Math.floor(Math.random()*cols.length)],transparent:true}));
    m.position.copy(pos);
    const d=new THREE.Vector3((Math.random()-0.5)*2,Math.random()*3,(Math.random()-0.5)*2).normalize();
    m.userData={vel:d.multiplyScalar(2+Math.random()*3),life:1,decay:0.01+Math.random()*0.025};
    scene.add(m);ps.push(m);
  }
  const fl=new THREE.PointLight(0xff6600,5,8);fl.position.copy(pos);scene.add(fl);
  setTimeout(()=>scene.remove(fl),300);
  return ps;
}
function spawnSplash(scene,pos){
  const ps=[];
  for(let i=0;i<10;i++){
    const geo=new THREE.SphereGeometry(0.02,4,4);
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x88ccff,transparent:true}));
    m.position.copy(pos);
    const d=new THREE.Vector3((Math.random()-0.5),2+Math.random(),(Math.random()-0.5)).normalize();
    m.userData={vel:d.multiplyScalar(0.8+Math.random()),life:1,decay:0.03+Math.random()*0.02};
    scene.add(m);ps.push(m);
  }
  return ps;
}

/* ═══════ MINIMAP ═══════ */
function Minimap({units,mines,faction,sel}){
  const cRef=useRef();
  useEffect(()=>{
    const c=cRef.current;if(!c)return;
    const ctx=c.getContext("2d");const w=c.width,h=c.height,cw=w/GW,ch=h/GH;
    ctx.clearRect(0,0,w,h);
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
      const t=getTerrain(x,y);
      ctx.fillStyle=t>=4&&t<=5?"#2d5a27":t===3?"#3a6b30":t>=7?"#8B7355":t===6?"#7a654a":t===1?"#0c3a5a":"#0a2a4a";
      ctx.fillRect(x*cw,y*ch,cw-0.3,ch-0.3);
    }
    ctx.fillStyle="rgba(34,136,170,0.12)";ctx.fillRect(0,3*ch,w,2*ch);
    mines.filter(m=>m.active).forEach(m=>{ctx.fillStyle="#ff444488";ctx.beginPath();ctx.arc(m.x*cw+cw/2,m.y*ch+ch/2,2.5,0,Math.PI*2);ctx.fill();});
    units.forEach(u=>{
      ctx.fillStyle=u.faction==="iran"?"#22c55e":"#3b82f6";ctx.beginPath();ctx.arc(u.x*cw+cw/2,u.y*ch+ch/2,3.5,0,Math.PI*2);ctx.fill();
      if(u.type==="convoy"){ctx.strokeStyle="#ff8800";ctx.lineWidth=1.5;ctx.stroke();}
    });
    if(sel){ctx.strokeStyle="#fbbf24";ctx.lineWidth=2;ctx.beginPath();ctx.arc(sel.x*cw+cw/2,sel.y*ch+ch/2,6,0,Math.PI*2);ctx.stroke();}
  },[units,mines,faction,sel]);
  return <canvas ref={cRef} width={168} height={112} style={{borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(0,0,0,0.4)",width:"100%"}}/>;
}

/* ═══════ MAIN ═══════ */
export default function HormuzGame3D(){
  const mountRef=useRef();const sceneRef=useRef();const cameraRef=useRef();const rendererRef=useRef();
  const clockRef=useRef(new THREE.Clock());
  const meshMap=useRef({});const hpMap=useRef({});const particlesRef=useRef([]);const projRef=useRef([]);
  const waterRef=useRef();const straitRef=useRef();const labelsRef=useRef();
  const highlightRef=useRef([]);const placementRef=useRef([]);const rangeRef=useRef(null);
  const hoverRef=useRef(null);const selRingRef=useRef(null);
  const camA=useRef({th:-0.6,ph:0.52,d:11});
  const mouse=useRef({drag:false,lx:0,ly:0,moved:false});
  const raycaster=useRef(new THREE.Raycaster());const gridPlane=useRef();const animId=useRef();
  const gridGroupRef=useRef(null);

  const [screen,setScreen]=useState("menu");const [faction,setFaction]=useState(null);
  const [turn,setTurn]=useState(1);const [budget,setBudget]=useState(0);
  const [oil,setOil]=useState(72);const [oilHist,setOilHist]=useState([72]);
  const [units,setUnits]=useState([]);const [sel,setSel]=useState(null);
  const [placing,setPlacing]=useState(null);const [log,setLog]=useState([]);
  const [passed,setPassed]=useState(0);const [destroyed,setDestroyed]=useState(0);
  const [mines,setMines]=useState([]);const [score,setScore]=useState({iran:0,coalition:0});
  const [news,setNews]=useState(null);const [gameOver,setGameOver]=useState(false);
  const [shop,setShop]=useState(false);
  const [validMoves,setValidMoves]=useState([]);const [validAtks,setValidAtks]=useState([]);
  const [nightMode,setNightMode]=useState(false);
  const [soundOn,setSoundOn]=useState(false);
  const [weather,setWeather]=useState("clear"); // clear, storm, fog
  const [diplomacy,setDiplomacy]=useState(null);
  const [lastPlaced,setLastPlaced]=useState(null);
  const [tutorial,setTutorial]=useState({active:false,step:0});
  const [achievements,setAchievements]=useState([]);
  const [achievePopup,setAchievePopup]=useState(null);
  const [killTracker,setKillTracker]=useState({}); // {unitId: killCount}
  const [promotions,setPromotions]=useState({}); // {unitId: true}
  const [turnSummary,setTurnSummary]=useState(null); // shown between turns
  const sinkingRef=useRef([]); // meshes currently sinking
  const wakesRef=useRef([]);
  const gameStats=useRef({totalKills:0,destroyedConvoys:0,minesPlaced:0,maxOil:72,minOil:72,totalSpent:0,convoysPassed:0,hasPromotion:false,turnsNoLoss:0,straitControl:0,unitsLostThisTurn:0});
  const cinematicRef=useRef({active:false,origTh:0,origPh:0,origD:0,timer:null});

  const R=useRef({});R.current={units,sel,placing,faction,mines};
  const addLog=useCallback((m)=>setLog(p=>[m,...p].slice(0,40)),[]);
  
  // Achievement checker
  const checkAchievements=useCallback(()=>{
    const s=gameStats.current;
    ACHIEVE_DEFS.forEach(a=>{
      if(!achievements.includes(a.id)&&a.check(s)){
        setAchievements(p=>[...p,a.id]);
        setAchievePopup(a);
        addLog(`🏆 Başarım: ${a.name}!`);
        SFX.alert();
        setTimeout(()=>setAchievePopup(null),3500);
      }
    });
  },[achievements,addLog]);

  // Track a kill and handle promotion
  const trackKill=(attackerId,targetType)=>{
    gameStats.current.totalKills++;
    if(targetType==="convoy")gameStats.current.destroyedConvoys++;
    setKillTracker(prev=>{
      const next={...prev};
      next[attackerId]=(next[attackerId]||0)+1;
      // Promotion at 3 kills
      if(next[attackerId]>=3&&!promotions[attackerId]){
        setPromotions(pp=>({...pp,[attackerId]:true}));
        gameStats.current.hasPromotion=true;
        // Buff the unit
        setUnits(u=>u.map(unit=>unit.id===attackerId?{...unit,hp:Math.min(unit.maxHp+10,unit.hp+15),maxHp:unit.maxHp+10}:unit));
        addLog(`⭐ Terfi! Birim güçlendirildi (+10 HP, iyileştirildi)`);
        SFX.alert();
      }
      return next;
    });
    checkAchievements();
  };

  // Keyboard shortcuts (1-5 = buy unit, ESC = cancel, R = repeat)
  useEffect(()=>{
    if(screen!=="game")return;
    const handler=(e)=>{
      const key=e.key;
      // ESC = cancel placement
      if(key==="Escape"&&placing){
        setBudget(b=>b+U[placing].cost);setPlacing(null);SFX.click();return;
      }
      // R = repeat last placed
      if((key==="r"||key==="R")&&!placing&&lastPlaced&&budget>=U[lastPlaced].cost){
        setBudget(b=>b-U[lastPlaced].cost);setPlacing(lastPlaced);
        gameStats.current.totalSpent+=U[lastPlaced].cost;
        SFX.click();return;
      }
      // 1-6 = quick buy
      const num=parseInt(key);
      if(num>=1&&num<=9){
        const fUnits=faction?FACTIONS[faction]?.units:null;
        if(!fUnits)return;
        const idx=num-1;if(idx>=fUnits.length)return;
        const ut=fUnits[idx];
        const refund=placing?U[placing].cost:0;
        if(budget+refund<U[ut].cost)return; // can't afford even with refund
        if(placing)setBudget(b=>b+U[placing].cost);
        setBudget(b=>b-U[ut].cost);setPlacing(ut);setShop(false);
        gameStats.current.totalSpent+=U[ut].cost;
        if(tutorial.active&&tutorial.step===1)setTutorial(t=>({...t,step:2}));
        SFX.click();
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[screen,placing,budget,lastPlaced,faction]);

  // Night mode lighting
  useEffect(()=>{
    if(!sceneRef.current||screen!=="game")return;
    const scene=sceneRef.current;
    scene.traverse(c=>{
      if(c.isDirectionalLight&&c.castShadow){
        c.intensity=nightMode?0.3:1.6;c.color.set(nightMode?0x4466aa:0xffd4a0);
      }
      if(c.isAmbientLight){c.intensity=nightMode?0.15:0.5;c.color.set(nightMode?0x112244:0x334466);}
      if(c.isHemisphereLight){c.intensity=nightMode?0.1:0.3;}
    });
    scene.background.set(nightMode?0x010208:0x040810);
    scene.fog.color.set(nightMode?0x010208:0x040810);
    // Add/remove city lights on night
    const nightLightsId="_nightLights";
    let nlGroup=scene.getObjectByName(nightLightsId);
    if(nightMode&&!nlGroup){
      nlGroup=new THREE.Group();nlGroup.name=nightLightsId;
      // City lights on Iran side
      for(let i=0;i<15;i++){
        const gx=3+Math.random()*7,gy=0.5+Math.random()*1.5;
        const wp=g2w(gx,gy);wp.y=0.5+Math.random()*0.5;
        const pl=new THREE.PointLight(0xffaa44,0.3+Math.random()*0.3,2);pl.position.copy(wp);nlGroup.add(pl);
        const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.03,4,4),new THREE.MeshBasicMaterial({color:0xffcc66}));
        bulb.position.copy(wp);nlGroup.add(bulb);
      }
      // City lights on Oman side
      for(let i=0;i<12;i++){
        const gx=2+Math.random()*8,gy=6+Math.random()*1.5;
        const wp=g2w(gx,gy);wp.y=0.4+Math.random()*0.3;
        const pl=new THREE.PointLight(0xffcc88,0.25+Math.random()*0.2,1.8);pl.position.copy(wp);nlGroup.add(pl);
        const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.025,4,4),new THREE.MeshBasicMaterial({color:0xffdd88}));
        bulb.position.copy(wp);nlGroup.add(bulb);
      }
      // Lighthouse beams
      [{x:0,y:3},{x:GW-1,y:5}].forEach(({x:lx,y:ly})=>{
        const wp=g2w(lx,ly);
        const beam=new THREE.SpotLight(0xffffff,1,8,0.3,0.5);
        beam.position.set(wp.x,1,wp.z);beam.target.position.set(wp.x+2,0,wp.z);
        nlGroup.add(beam);nlGroup.add(beam.target);
        beam.userData.lighthouse=true;beam.userData.baseX=wp.x;beam.userData.baseZ=wp.z;
      });
      // Stars (small point lights high up)
      for(let i=0;i<6;i++){
        const star=new THREE.PointLight(0xaabbff,0.1,15);
        star.position.set((Math.random()-0.5)*12,8+Math.random()*4,(Math.random()-0.5)*8);
        nlGroup.add(star);
      }
      scene.add(nlGroup);
    } else if(!nightMode&&nlGroup){
      scene.remove(nlGroup);
      nlGroup.traverse(c=>{if(c.dispose)c.dispose();});
    }
  },[nightMode,screen]);

  useEffect(()=>{
    if(!sel||placing){setValidMoves([]);setValidAtks([]);return;}
    const u=U[sel.type];const wt=WEATHER_TYPES[weather];const ms=[];
    // Storm grounds drones/missiles/f35
    const grounded=weather==="storm"&&(sel.type==="drone"||sel.type==="missile"||sel.type==="f35");
    const effSpd=grounded?0:Math.max(1,Math.floor(u.spd*wt.spdMod));
    const effRange=grounded?0:Math.max(1,Math.floor(Math.max(u.range,1)*wt.rangeMod));
    if(!sel.moved&&effSpd>0){for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){if(dist(sel,{x,y})<=effSpd&&isPlayableSea(x,y)&&!units.find(o=>o.x===x&&o.y===y))ms.push(`${x},${y}`);}}
    setValidMoves(ms);
    setValidAtks(!sel.attacked&&u.atk>0&&!grounded?units.filter(o=>o.faction!==faction&&dist(sel,o)<=effRange).map(o=>o.id):[]);
  },[sel,units,placing,faction,weather]);

  /* ═══ INIT 3D ═══ */
  useEffect(()=>{
    if(screen!=="game"||!mountRef.current)return;
    const el=mountRef.current;const W=el.clientWidth,H=el.clientHeight;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x040810);scene.fog=new THREE.FogExp2(0x040810,0.02);
    const camera=new THREE.PerspectiveCamera(45,W/H,0.1,120);
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    el.appendChild(renderer.domElement);
    sceneRef.current=scene;cameraRef.current=camera;rendererRef.current=renderer;

    scene.add(new THREE.AmbientLight(0x334466,0.5));
    const sun=new THREE.DirectionalLight(0xffd4a0,1.6);sun.position.set(8,14,5);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.bias=-0.001;scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x8899bb,0x223344,0.3));
    scene.add(new THREE.DirectionalLight(0xff8844,0.35).translateX(-6).translateY(5));

    buildTerrain(scene);waterRef.current=buildWater(scene);straitRef.current=buildStraitDecor(scene);
    labelsRef.current=buildLabels(scene);gridGroupRef.current=buildGrid(scene);

    const gp=new THREE.Mesh(new THREE.PlaneGeometry(GW*CELL*1.6,GH*CELL*1.6),new THREE.MeshBasicMaterial({visible:false}));
    gp.rotateX(-Math.PI/2);scene.add(gp);gridPlane.current=gp;

    // hover indicator
    const hGeo=new THREE.PlaneGeometry(CELL*0.9,CELL*0.9);hGeo.rotateX(-Math.PI/2);
    const hMat=new THREE.MeshBasicMaterial({color:0xfbbf24,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false});
    const hMesh=new THREE.Mesh(hGeo,hMat);hMesh.position.y=0.025;hMesh.visible=false;scene.add(hMesh);hoverRef.current=hMesh;

    // selection ring
    const sGeo=new THREE.RingGeometry(0.5,0.6,32);sGeo.rotateX(-Math.PI/2);
    const sMat=new THREE.MeshBasicMaterial({color:0xfbbf24,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false});
    const sMesh=new THREE.Mesh(sGeo,sMat);sMesh.position.y=0.04;sMesh.visible=false;scene.add(sMesh);selRingRef.current=sMesh;

    // skybox
    const skyGeo=new THREE.SphereGeometry(55,20,20);
    const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
      uniforms:{t:{value:new THREE.Color(0x0a1525)},b:{value:new THREE.Color(0x1a2a40)}},
      vertexShader:`varying vec3 vP;void main(){vP=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform vec3 t;uniform vec3 b;varying vec3 vP;void main(){float h=normalize(vP+10.0).y;gl_FragColor=vec4(mix(b,t,max(pow(max(h,0.0),0.6),0.0)),1.0);}`});
    scene.add(new THREE.Mesh(skyGeo,skyMat));

    const tick=()=>{
      const t=clockRef.current.getElapsedTime();const dt=Math.min(clockRef.current.getDelta(),0.05);
      const ca=camA.current;
      camera.position.set(Math.sin(ca.th)*Math.cos(ca.ph)*ca.d,Math.sin(ca.ph)*ca.d,Math.cos(ca.th)*Math.cos(ca.ph)*ca.d);
      camera.lookAt(0,0,0);
      if(waterRef.current){const pos=waterRef.current.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,Math.sin(x*1.2+t*0.9)*0.06+Math.sin(z*1.8+t*0.7)*0.04+Math.sin((x+z)*0.7+t*1.3)*0.03-0.1);}pos.needsUpdate=true;waterRef.current.geometry.computeVertexNormals();}
      straitRef.current?.traverse(c=>{if(c.userData.flow)c.position.x=c.userData.bx+Math.sin(t*0.8)*0.35;if(c.userData.buoy)c.material.opacity=0.4+Math.sin(t*3+c.position.x)*0.6;});
      labelsRef.current?.traverse(c=>{if(c.userData.label)c.position.y=c.userData.by+Math.sin(t*0.5)*0.06;});
      // Grid world animations
      if(gridGroupRef.current){gridGroupRef.current.traverse(c=>{
        if(c.userData.foam){c.position.x=c.userData.baseX+Math.sin(t*1.2+c.position.z*3)*0.08;c.material.opacity=0.12+Math.sin(t*2+c.position.x*5)*0.1;}
        if(c.userData.currentDot){c.position.x+=c.userData.speed*dt;if(c.position.x>GW*CELL*0.8)c.position.x=-GW*CELL*0.8;c.position.z=c.userData.baseZ+Math.sin(t+c.position.x)*0.1;c.material.opacity=0.15+Math.sin(t*3+c.position.x)*0.15;}
        if(c.userData.rigLight){c.material.opacity=0.3+Math.sin(t*4)*0.7;c.scale.setScalar(0.8+Math.sin(t*4)*0.3);}
        if(c.userData.flare){c.scale.y=0.8+Math.sin(t*8)*0.4;c.scale.x=0.7+Math.sin(t*6)*0.3;c.material.opacity=0.5+Math.sin(t*10)*0.2;}
        if(c.userData.straitGlow){c.material.opacity=0.02+Math.sin(t*1.5)*0.015;}
      });}
      Object.values(meshMap.current).forEach(m=>{if(!m.parent)return;const ph=m.userData.bobPhase;const ty=m.userData.unitType;const base=U[ty]?.yOff||0.1;
        if(ty==="drone"){m.position.y=base+Math.sin(t*2+ph)*0.1;m.rotation.y+=dt*1.8;const g=m.getObjectByName("glow");if(g)g.scale.setScalar(0.7+Math.sin(t*15)*0.4);}
        else if(ty==="missile"){m.position.y=base+Math.sin(t*1.5+ph)*0.08;const f=m.getObjectByName("flame");if(f)f.scale.setScalar(0.5+Math.sin(t*20)*0.5);}
        else if(ty==="mine"){m.position.y=base+Math.sin(t*0.8+ph)*0.04;const g=m.getObjectByName("mineGlow");if(g)g.intensity=0.2+Math.sin(t*2)*0.3;}
        else if(ty==="submarine"){
          m.position.y=base+Math.sin(t*0.6+ph)*0.02;m.rotation.z=Math.sin(t*0.5+ph)*0.02;
          // spawn bubble particles occasionally
          if(Math.random()<0.03&&sceneRef.current){
            const bp=new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4),new THREE.MeshBasicMaterial({color:0x88ccee,transparent:true}));
            bp.position.set(m.position.x+(Math.random()-0.5)*0.2,0.05,m.position.z+(Math.random()-0.5)*0.2);
            bp.userData={vel:new THREE.Vector3((Math.random()-0.5)*0.1,0.5+Math.random()*0.5,(Math.random()-0.5)*0.1),life:1,decay:0.03};
            scene.add(bp);particlesRef.current.push(bp);
          }
        }
        else if(ty==="f35"){
          m.position.y=base+Math.sin(t*1.8+ph)*0.15;
          m.rotation.z=Math.sin(t*0.8+ph)*0.08; // banking
          m.rotation.x=Math.sin(t*0.5+ph)*0.03; // pitch
          m.traverse(c=>{if(c.name==="jetGlow")c.scale.setScalar(0.6+Math.sin(t*18)*0.5);});
          // contrail
          if(Math.random()<0.06&&sceneRef.current){
            const tr=new THREE.Mesh(new THREE.SphereGeometry(0.01,3,3),new THREE.MeshBasicMaterial({color:0xccddff,transparent:true}));
            tr.position.set(m.position.x+0.15,m.position.y,m.position.z);
            tr.userData={vel:new THREE.Vector3(0.1,0,0),life:0.8,decay:0.015};
            scene.add(tr);particlesRef.current.push(tr);
          }
        }
        else{m.position.y=base+Math.sin(t*1.2+ph)*0.03;m.rotation.z=Math.sin(t+ph)*0.04;}
        m.traverse(c=>{
          if(c.userData.spin)c.rotation.y+=dt*0.8;
          if(c.name==="promoStar"){c.position.y=U[m.userData.unitType]?.yOff+0.55+Math.sin(t*4)*0.05;c.scale.setScalar(0.8+Math.sin(t*6)*0.3);}
          if(c.userData.enemyRing){c.material.opacity=0.12+Math.sin(t*2.5)*0.1;c.scale.setScalar(1+Math.sin(t*2)*0.15);}
        });
      });
      // cinematic camera interpolation
      const cin=cinematicRef.current;
      if(cin.active){
        camA.current.th+=(cin.targetTh-camA.current.th)*0.06;
        camA.current.ph+=(cin.targetPh-camA.current.ph)*0.06;
        camA.current.d+=(cin.targetD-camA.current.d)*0.06;
      }
      // Lighthouse rotation (night mode)
      const nlg=scene.getObjectByName("_nightLights");
      if(nlg){nlg.traverse(c=>{if(c.userData?.lighthouse&&c.target){
        c.target.position.x=c.userData.baseX+Math.cos(t*0.7)*4;
        c.target.position.z=c.userData.baseZ+Math.sin(t*0.7)*4;
      }});}
      if(selRingRef.current?.visible){selRingRef.current.scale.setScalar(1+Math.sin(t*3)*0.12);selRingRef.current.material.opacity=0.35+Math.sin(t*4)*0.3;}
      particlesRef.current=particlesRef.current.filter(p=>{p.userData.life-=p.userData.decay;if(p.userData.life<=0){scene.remove(p);return false;}p.position.addScaledVector(p.userData.vel,dt);p.userData.vel.y-=dt*4.5;p.material.opacity=p.userData.life;p.scale.setScalar(Math.max(0.01,p.userData.life));return true;});
      // Sinking ships animation
      sinkingRef.current=sinkingRef.current.filter(s=>{
        s.mesh.userData.sinkProgress+=dt*0.3;
        const p=s.mesh.userData.sinkProgress;
        s.mesh.position.y=s.mesh.userData.sinkStartY-p*0.8;
        s.mesh.rotation.z+=dt*0.3*(Math.random()>0.5?1:-1);
        s.mesh.rotation.x+=dt*0.15;
        s.mesh.traverse(c=>{if(c.material&&c.material.transparent!==undefined){c.material.transparent=true;c.material.opacity=Math.max(0,1-p*1.2);}});
        // Bubbles while sinking
        if(Math.random()<0.1&&sceneRef.current){
          const b=new THREE.Mesh(new THREE.SphereGeometry(0.02,4,4),new THREE.MeshBasicMaterial({color:0x88ccee,transparent:true}));
          b.position.copy(s.mesh.position);b.position.y+=0.05;
          b.userData={vel:new THREE.Vector3((Math.random()-0.5)*0.2,0.6,(Math.random()-0.5)*0.2),life:1,decay:0.04};
          sceneRef.current.add(b);particlesRef.current.push(b);
        }
        if(p>=1.2){scene.remove(s.mesh);delete meshMap.current[s.id];return false;}
        return true;
      });
      // Wake trails
      wakesRef.current=wakesRef.current.filter(w=>{
        w.userData.life-=0.012;if(w.userData.life<=0){scene.remove(w);return false;}
        w.material.opacity=w.userData.life*0.25;w.scale.setScalar(1+(1-w.userData.life)*3);return true;
      });
      projRef.current=projRef.current.filter(proj=>{proj.userData.t+=dt*2.0;if(proj.userData.t>=1){
        particlesRef.current.push(...spawnExplosion(scene,proj.position.clone(),45));
        // Impact flash light
        const flash=new THREE.PointLight(0xff6600,6,8);flash.position.copy(proj.position);scene.add(flash);
        setTimeout(()=>{flash.intensity=3;setTimeout(()=>{flash.intensity=1;setTimeout(()=>scene.remove(flash),100);},100);},100);
        scene.remove(proj);proj.userData.onDone?.();return false;}
        const tt=proj.userData.t;proj.position.lerpVectors(proj.userData.from,proj.userData.to,tt);proj.position.y+=Math.sin(tt*Math.PI)*1.5;
        // Bigger trail particles
        if(Math.random()<0.5){
          const tp=new THREE.Mesh(new THREE.SphereGeometry(0.025,4,4),new THREE.MeshBasicMaterial({color:0xff6600,transparent:true}));
          tp.position.copy(proj.position);tp.userData={vel:new THREE.Vector3((Math.random()-0.5)*0.3,-0.2,(Math.random()-0.5)*0.3),life:0.6,decay:0.03};
          scene.add(tp);particlesRef.current.push(tp);
        }
        return true;});
      highlightRef.current.forEach(h=>{h.material.opacity=0.15+Math.sin(t*3)*0.1;});
      placementRef.current.forEach(p=>{p.children.forEach(c=>{if(c.material){c.material.opacity=0.15+Math.sin(t*2.5)*0.15;}});p.position.y=0.01+Math.sin(t*2)*0.01;});
      renderer.render(scene,camera);animId.current=requestAnimationFrame(tick);
    };tick();
    const onResize=()=>{if(!el)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);};
    window.addEventListener("resize",onResize);
    return()=>{window.removeEventListener("resize",onResize);cancelAnimationFrame(animId.current);if(el.contains(renderer.domElement))el.removeChild(renderer.domElement);renderer.dispose();};
  },[screen]);

  /* ═══ SYNC ═══ */
  useEffect(()=>{
    if(!sceneRef.current||screen!=="game")return;const scene=sceneRef.current;
    const existing=new Set(Object.keys(meshMap.current));const current=new Set(units.map(u=>u.id));
    existing.forEach(id=>{if(!current.has(id)){
      const m=meshMap.current[id];
      if(m&&!m.userData.sinking){
        // Start sinking animation instead of instant removal
        particlesRef.current.push(...spawnExplosion(scene,m.position.clone(),25));
        m.userData.sinking=true;m.userData.sinkProgress=0;m.userData.sinkStartY=m.position.y;
        sinkingRef.current.push({id,mesh:m});
        // Smoke trail
        for(let i=0;i<6;i++){const sm=new THREE.Mesh(new THREE.SphereGeometry(0.035,4,4),new THREE.MeshBasicMaterial({color:0x444444,transparent:true,opacity:0.5}));sm.position.copy(m.position);sm.position.y+=0.1;sm.userData={vel:new THREE.Vector3((Math.random()-0.5)*0.2,0.4+Math.random()*0.4,(Math.random()-0.5)*0.2),life:1,decay:0.007};scene.add(sm);particlesRef.current.push(sm);}
      } else if(m&&m.userData.sinking){/* already sinking */}
      else{delete meshMap.current[id];}
      const hp=hpMap.current[id];if(hp){scene.remove(hp);delete hpMap.current[id];}
    }});
    units.forEach(u=>{
      const wp=g2w(u.x,u.y);
      if(!meshMap.current[u.id]){
        const mesh=createUnit3D(u.type,FACTIONS[u.faction].color);mesh.position.set(wp.x,U[u.type].yOff,wp.z);
        // Enemy indicator: red underlight
        if(u.faction!==faction){
          const enemyGlow=new THREE.PointLight(0xff2222,0.35,1.8);
          enemyGlow.position.y=-0.05;mesh.add(enemyGlow);
          // Red ring on water under enemy
          const ringGeo=new THREE.RingGeometry(0.2,0.28,16);ringGeo.rotateX(-Math.PI/2);
          const ringMat=new THREE.MeshBasicMaterial({color:0xff3333,transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false});
          const ring=new THREE.Mesh(ringGeo,ringMat);ring.position.y=-U[u.type].yOff+0.03;
          ring.userData.enemyRing=true;mesh.add(ring);
        }
        scene.add(mesh);meshMap.current[u.id]=mesh;
        particlesRef.current.push(...spawnSplash(scene,new THREE.Vector3(wp.x,0,wp.z)));
        const hpBar=createHPBar();hpBar.position.set(wp.x,U[u.type].yOff+0.6,wp.z);scene.add(hpBar);hpMap.current[u.id]=hpBar;updateHP(hpBar,u.hp,u.maxHp,FACTIONS[u.faction].hex,u.faction!==faction);
      } else {
        const mesh=meshMap.current[u.id];const tx=wp.x,tz=wp.z;
        if(Math.abs(mesh.position.x-tx)>0.05||Math.abs(mesh.position.z-tz)>0.05){
          const sx=mesh.position.x,sz=mesh.position.z;let pr=0;
          const an=()=>{pr=Math.min(1,pr+0.03);const e=pr<0.5?2*pr*pr:1-Math.pow(-2*pr+2,2)/2;
            mesh.position.x=lerp(sx,tx,e);mesh.position.z=lerp(sz,tz,e);
            const ang=Math.atan2(tx-sx,tz-sz);mesh.rotation.y+=(ang-mesh.rotation.y)*0.08;
            const hb=hpMap.current[u.id];if(hb){hb.position.x=mesh.position.x;hb.position.z=mesh.position.z;}
            // WAKE TRAILS
            if(pr>0.1&&pr<0.9&&Math.random()<0.3&&u.type!=="drone"&&u.type!=="missile"&&u.type!=="f35"&&u.type!=="mine"){
              const wGeo=new THREE.RingGeometry(0.02,0.18,10);wGeo.rotateX(-Math.PI/2);
              const wMat=new THREE.MeshBasicMaterial({color:0xaaddff,transparent:true,opacity:0.25,side:THREE.DoubleSide,depthWrite:false});
              const wake=new THREE.Mesh(wGeo,wMat);wake.position.set(mesh.position.x,0.02,mesh.position.z);
              wake.userData={life:1};scene.add(wake);wakesRef.current.push(wake);
            }
            if(pr<1)requestAnimationFrame(an);else particlesRef.current.push(...spawnSplash(scene,new THREE.Vector3(tx,0,tz)));};
          requestAnimationFrame(an);
        }
        const hb=hpMap.current[u.id];if(hb){hb.position.set(wp.x,U[u.type].yOff+0.6,wp.z);updateHP(hb,u.hp,u.maxHp,FACTIONS[u.faction].hex,u.faction!==faction);}
        // Promotion star glow
        if(promotions[u.id]&&meshMap.current[u.id]){
          const mesh=meshMap.current[u.id];
          if(!mesh.userData.promoStar){
            const starLight=new THREE.PointLight(0xfbbf24,0.6,2);starLight.position.y=U[u.type].yOff+0.5;
            mesh.add(starLight);mesh.userData.promoStar=true;
            const starGeo=new THREE.SphereGeometry(0.04,6,6);
            const starMat=new THREE.MeshBasicMaterial({color:0xfbbf24});
            const star=new THREE.Mesh(starGeo,starMat);star.position.y=U[u.type].yOff+0.55;star.name="promoStar";
            mesh.add(star);
          }
        }
      }
    });
    // selection ring
    if(sel&&selRingRef.current){const wp=g2w(sel.x,sel.y);selRingRef.current.position.set(wp.x,0.04,wp.z);selRingRef.current.visible=true;selRingRef.current.material.color.set(FACTIONS[faction]?.color||0xfbbf24);}
    else if(selRingRef.current)selRingRef.current.visible=false;
    // range circle
    if(rangeRef.current){scene.remove(rangeRef.current);rangeRef.current=null;}
    if(sel&&!placing){const u=U[sel.type];const r=Math.max(u.range,u.spd);if(r>0){const geo=new THREE.RingGeometry(r*CELL*0.92,r*CELL*1.02,48);geo.rotateX(-Math.PI/2);const mat=new THREE.MeshBasicMaterial({color:FACTIONS[faction].color,transparent:true,opacity:0.08,side:THREE.DoubleSide,depthWrite:false});const rc=new THREE.Mesh(geo,mat);const wp=g2w(sel.x,sel.y);rc.position.set(wp.x,0.03,wp.z);scene.add(rc);rangeRef.current=rc;}}
    // move highlights
    highlightRef.current.forEach(h=>scene.remove(h));highlightRef.current=[];
    validMoves.forEach(k=>{const[gx,gy]=k.split(",").map(Number);const wp=g2w(gx,gy);
      const geo=new THREE.PlaneGeometry(CELL*0.88,CELL*0.88);geo.rotateX(-Math.PI/2);
      const mat=new THREE.MeshBasicMaterial({color:0x3b82f6,transparent:true,opacity:0.18,side:THREE.DoubleSide,depthWrite:false});
      const m=new THREE.Mesh(geo,mat);m.position.set(wp.x,0.025,wp.z);scene.add(m);highlightRef.current.push(m);});
    validAtks.forEach(id=>{const u=units.find(o=>o.id===id);if(!u)return;const wp=g2w(u.x,u.y);
      const geo=new THREE.RingGeometry(CELL*0.32,CELL*0.48,6);geo.rotateX(-Math.PI/2);
      const mat=new THREE.MeshBasicMaterial({color:0xff4444,transparent:true,opacity:0.4,side:THREE.DoubleSide,depthWrite:false});
      const m=new THREE.Mesh(geo,mat);m.position.set(wp.x,0.05,wp.z);scene.add(m);highlightRef.current.push(m);});
    // placement zones
    placementRef.current.forEach(p=>scene.remove(p));placementRef.current=[];
    if(placing){
      for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
        if(canPlaceAt(x,y,placing,faction)&&!units.find(u=>u.x===x&&u.y===y)){
          const wp=g2w(x,y);
          const pillar=createPlacementPillar(FACTIONS[faction].color);
          pillar.position.set(wp.x,0,wp.z);scene.add(pillar);placementRef.current.push(pillar);
        }
      }
    }
  },[units,sel,validMoves,validAtks,screen,faction,placing,promotions]);

  /* ═══ MOUSE ═══ */
  const onDown=e=>{mouse.current={drag:true,lx:e.clientX,ly:e.clientY,moved:false};};
  const onUp=()=>{mouse.current.drag=false;};
  const onMove=e=>{
    if(mouse.current.drag){
      const dx=e.clientX-mouse.current.lx,dy=e.clientY-mouse.current.ly;
      if(Math.abs(dx)>2||Math.abs(dy)>2)mouse.current.moved=true;
      camA.current.th-=dx*0.005;camA.current.ph=clamp(camA.current.ph+dy*0.005,0.15,1.3);
      mouse.current.lx=e.clientX;mouse.current.ly=e.clientY;
    }
    if(!rendererRef.current||!cameraRef.current||!gridPlane.current)return;
    const rect=rendererRef.current.domElement.getBoundingClientRect();
    const mx=((e.clientX-rect.left)/rect.width)*2-1,my=-((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.current.setFromCamera(new THREE.Vector2(mx,my),cameraRef.current);
    const hits=raycaster.current.intersectObject(gridPlane.current);
    if(hits.length&&hoverRef.current){
      const p=hits[0].point;const gx=Math.round(p.x/CELL+GW/2-0.5),gy=Math.round(p.z/CELL+GH/2-0.5);
      if(gx>=0&&gx<GW&&gy>=0&&gy<GH&&isPlayableSea(gx,gy)){
        const wp=g2w(gx,gy);hoverRef.current.position.set(wp.x,0.025,wp.z);hoverRef.current.visible=true;
      }else hoverRef.current.visible=false;
    }
  };
  const onWheel=e=>{camA.current.d=clamp(camA.current.d+e.deltaY*0.006,3,22);};
  const onClick=e=>{
    if(mouse.current.moved)return;
    if(!cameraRef.current||!gridPlane.current||!rendererRef.current)return;
    const rect=rendererRef.current.domElement.getBoundingClientRect();
    const mx=((e.clientX-rect.left)/rect.width)*2-1,my=-((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.current.setFromCamera(new THREE.Vector2(mx,my),cameraRef.current);
    const hits=raycaster.current.intersectObject(gridPlane.current);if(!hits.length)return;
    const p=hits[0].point;const gx=Math.round(p.x/CELL+GW/2-0.5),gy=Math.round(p.z/CELL+GH/2-0.5);
    if(gx<0||gx>=GW||gy<0||gy>=GH)return;
    handleGridClick(gx,gy);
  };

  const handleGridClick=(x,y)=>{
    const{units:cu,sel:cs,placing:cp,faction:cf,mines:cm}=R.current;
    if(cp){if(!canPlaceAt(x,y,cp,cf)||cu.find(u=>u.x===x&&u.y===y))return;
      setUnits(p=>[...p,{id:uid(),type:cp,faction:cf,x,y,hp:U[cp].def,maxHp:U[cp].def,moved:false,attacked:false}]);
      if(cp==="mine"){setMines(p=>[...p,{x,y,active:true}]);gameStats.current.minesPlaced++;}
      addLog(`${U[cp].icon} ${U[cp].name} konuşlandırıldı`);SFX.splash();setLastPlaced(cp);setPlacing(null);
      if(tutorial.active&&tutorial.step===2)setTutorial(t=>({...t,step:3}));
      checkAchievements();return;}
    const onCell=cu.find(u=>u.x===x&&u.y===y);
    if(cs&&!cs.attacked&&onCell&&onCell.faction!==cf){
      const u=U[cs.type];if(u.atk>0&&dist(cs,onCell)<=Math.max(u.range,1)){
        const from=g2w(cs.x,cs.y);from.y=0.4;const to=g2w(onCell.x,onCell.y);to.y=0.4;
        // CINEMATIC CAMERA: zoom to battle
        const cin=cinematicRef.current;
        cin.origTh=camA.current.th;cin.origPh=camA.current.ph;cin.origD=camA.current.d;
        const midX=(from.x+to.x)/2,midZ=(from.z+to.z)/2;
        cin.targetTh=Math.atan2(midX,midZ);cin.targetPh=0.45;cin.targetD=Math.max(5,camA.current.d*0.6);
        cin.active=true;
        clearTimeout(cin.timer);cin.timer=setTimeout(()=>{
          cin.targetTh=cin.origTh;cin.targetPh=cin.origPh;cin.targetD=cin.origD;
          setTimeout(()=>{cin.active=false;},1200);
        },1800);
        const pg=new THREE.SphereGeometry(0.06,6,6);const pm=new THREE.MeshBasicMaterial({color:0xff8800});
        const proj=new THREE.Mesh(pg,pm);proj.position.copy(from);
        const tid=onCell.id,sType=cs.type,sId=cs.id;
        proj.userData={from,to,t:0,onDone:()=>{
          SFX.explosion(); // SOUND
          const wt=WEATHER_TYPES[weather];
          let dmg=Math.max(1,Math.round(U[sType].atk*wt.atkMod)-Math.floor(Math.random()*8)+Math.floor(Math.random()*5));
          if(sType==="submarine")dmg=Math.round(dmg*1.3); // stealth bonus
          if(sType==="f35")dmg=Math.round(dmg*1.2); // precision bonus
          // Promotion damage bonus (+25%)
          if(promotions[sId])dmg=Math.round(dmg*1.25);
          setUnits(prev=>{const tgt=prev.find(u=>u.id===tid);if(!tgt)return prev;
            if(tgt.hp-dmg<=0){addLog(`💥 ${U[sType].icon}→${U[tgt.type].icon} İMHA! (-${dmg})`);
              trackKill(sId,tgt.type); // TRACK KILL + PROMOTION
              if(tgt.type==="convoy"){setDestroyed(p=>p+1);setOil(p=>Math.min(200,p+5+Math.floor(Math.random()*5)));setScore(s=>({...s,iran:s.iran+15}));}
              // Tutorial: advance on first attack
              if(tutorial.active&&tutorial.step===4)setTutorial(t=>({...t,step:5}));
              return prev.filter(u=>u.id!==tid);}
            addLog(`⚔️ ${U[sType].icon}→${U[tgt.type].icon} -${dmg} (kalan:${tgt.hp-dmg})`);
            if(tutorial.active&&tutorial.step===4)setTutorial(t=>({...t,step:5}));
            return prev.map(u=>u.id===tid?{...u,hp:u.hp-dmg}:u);});
          setUnits(prev=>prev.map(u=>u.id===sId?{...u,attacked:true}:u));setSel(p=>p?.id===sId?{...p,attacked:true}:p);
        }};sceneRef.current?.add(proj);projRef.current.push(proj);return;}}
    if(cs&&!cs.moved&&U[cs.type].spd>0&&dist(cs,{x,y})<=U[cs.type].spd&&isPlayableSea(x,y)&&!cu.find(o=>o.x===x&&o.y===y)){
      const mine=cm.find(m=>m.x===x&&m.y===y&&m.active);
      if(mine&&cs.faction==="coalition"){const dmg=20+Math.floor(Math.random()*15);
        SFX.mineHit(); // SOUND
        if(cs.hp-dmg<=0){setUnits(p=>p.filter(u=>u.id!==cs.id));addLog(`💥 Mayına çarpıp battı!`);setMines(p=>p.map(m=>m.x===x&&m.y===y?{...m,active:false}:m));setSel(null);return;}
        setUnits(p=>p.map(u=>u.id===cs.id?{...u,x,y,hp:u.hp-dmg,moved:true}:u));setMines(p=>p.map(m=>m.x===x&&m.y===y?{...m,active:false}:m));addLog(`💣 Mayın! -${dmg}HP`);}
      else {setUnits(p=>p.map(u=>u.id===cs.id?{...u,x,y,moved:true}:u));SFX.splash();}
      if(cs.type==="minesweeper"){const near=cm.filter(m=>m.active&&dist({x,y},m)<=1);if(near.length){setMines(p=>p.map(m=>near.some(n=>n.x===m.x&&n.y===m.y)?{...m,active:false}:m));addLog(`🔧 ${near.length} mayın temizlendi!`);SFX.click();}}
      setSel(p=>p?{...p,x,y,moved:true}:null);
      if(tutorial.active&&tutorial.step===3)setTutorial(t=>({...t,step:4}));
      return;}
    if(onCell&&onCell.faction===cf){setSel(onCell);SFX.click();}else setSel(null);
  };

  const endTurn=()=>{
    SFX.turnEnd();
    const enemy=faction==="iran"?"coalition":"iran";const fD=FACTIONS[enemy];
    let aiBudget=fD.income*3+turn*15+50;let nu=[...units];

    /* ═══ WEATHER CHANGE ═══ */
    const weatherRoll=Math.random();
    let newWeather=weather;
    if(weatherRoll<0.15)newWeather="storm";
    else if(weatherRoll<0.3)newWeather="fog";
    else newWeather="clear";
    if(newWeather!==weather){
      setWeather(newWeather);
      const wt=WEATHER_TYPES[newWeather];
      addLog(`${wt.icon} Hava: ${wt.name} — ${wt.desc}`);
      // Update fog
      if(sceneRef.current){sceneRef.current.fog.density=wt.fog;}
    }
    const wt=WEATHER_TYPES[newWeather];

    /* ═══ DIPLOMACY EVENT (20% chance) ═══ */
    let dipEffect=null;
    if(Math.random()<0.2){
      const dip=DIPLOMACY[Math.floor(Math.random()*DIPLOMACY.length)];
      setDiplomacy(dip);dipEffect=dip.effect;
      addLog(`🏛️ ${dip.t} — ${dip.desc}`);SFX.alert();
      setTimeout(()=>setDiplomacy(null),4000);
      // Apply immediate effects
      if(dip.effect==="iran_boost")setBudget(b=>faction==="iran"?b+80:b);
      if(dip.effect==="coal_boost")setBudget(b=>faction==="coalition"?b+60:b);
      if(dip.effect==="oil_stable")setOil(72);
      if(dip.effect==="oil_spike")setOil(o=>Math.min(200,o+20));
      if(dip.effect==="heal_all"){
        nu=nu.map(u=>({...u,hp:Math.min(u.maxHp,u.hp+10)}));
        addLog("💚 Tüm birimler +10 HP iyileştirildi");
      }
    }

    /* ═══ SMART AI — STRATEGIC UNIT PURCHASE ═══ */
    const playerUnits=nu.filter(u=>u.faction===faction);
    const playerConvoys=playerUnits.filter(u=>u.type==="convoy");
    const playerInStrait=playerUnits.filter(u=>u.y>=3&&u.y<=5);
    const aiUnitsExisting=nu.filter(u=>u.faction===enemy);

    // AI strategy: analyze board state
    const needsAntiConvoy=enemy==="iran"&&playerConvoys.length>0;
    const needsDefense=aiUnitsExisting.length<playerUnits.length*0.6;
    const needsMines=enemy==="iran"&&mines.filter(m=>m.active).length<3;

    // Weighted unit selection based on strategy
    const getAIUnitType=()=>{
      const available=fD.units.filter(ut=>U[ut].cost<=aiBudget);
      if(!available.length)return null;
      const weights={};
      available.forEach(ut=>{weights[ut]=1;});
      if(enemy==="iran"){
        if(needsAntiConvoy){weights.drone=(weights.drone||0)+3;weights.missile=(weights.missile||0)+2;}
        if(needsMines)weights.mine=(weights.mine||0)+3;
        if(newWeather==="fog")weights.submarine=(weights.submarine||0)+4; // subs excel in fog
        if(newWeather==="storm"){weights.drone=0;weights.missile=0;} // can't fly in storm
      } else {
        if(playerConvoys.length===0&&available.includes("convoy"))weights.convoy=(weights.convoy||0)+4;
        const mineCount=mines.filter(m=>m.active).length;
        if(mineCount>2)weights.minesweeper=(weights.minesweeper||0)+3;
        if(needsDefense)weights.destroyer=(weights.destroyer||0)+2;
        if(newWeather!=="storm")weights.f35=(weights.f35||0)+2; // can't fly in storm
        if(newWeather==="storm"){weights.f35=0;}
      }
      // Weighted random selection
      const entries=Object.entries(weights).filter(([k,v])=>v>0&&available.includes(k));
      const total=entries.reduce((s,[,v])=>s+v,0);
      let r=Math.random()*total;
      for(const[ut,w] of entries){r-=w;if(r<=0)return ut;}
      return available[Math.floor(Math.random()*available.length)];
    };

    // AI strategic placement
    const getAIPlacement=(ut)=>{
      const bestSpots=[];
      for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
        if(!canPlaceAt(x,y,ut,enemy)||nu.find(u=>u.x===x&&u.y===y))continue;
        let score=0;
        const isStrait=y>=3&&y<=5;
        if(isStrait)score+=3; // prioritize strait control
        if(ut==="mine"&&isStrait)score+=5;
        // Place near enemy units for attack
        const nearEnemy=playerUnits.filter(p=>dist(p,{x,y})<=U[ut].range+1).length;
        score+=nearEnemy*2;
        // Place convoy escorts near convoys
        if(ut==="destroyer"||ut==="interceptor"){
          const nearConvoys=nu.filter(u=>u.type==="convoy"&&u.faction===enemy&&dist(u,{x,y})<=2).length;
          score+=nearConvoys*3;
        }
        // Anti-convoy positioning
        if(enemy==="iran"&&(ut==="drone"||ut==="missile"||ut==="submarine")){
          const nearPlayerConvoys=playerConvoys.filter(c=>dist(c,{x,y})<=U[ut].range+1).length;
          score+=nearPlayerConvoys*4;
        }
        bestSpots.push({x,y,score});
      }
      bestSpots.sort((a,b)=>b.score-a.score);
      // Pick from top 3 with some randomness
      const top=bestSpots.slice(0,Math.min(3,bestSpots.length));
      return top.length?top[Math.floor(Math.random()*top.length)]:null;
    };

    // AI spawning with strategy
    let spawnAttempts=0;
    while(aiBudget>14&&spawnAttempts<15){
      spawnAttempts++;
      const ut=getAIUnitType();if(!ut)break;
      const spot=getAIPlacement(ut);if(!spot)break;
      nu.push({id:uid(),type:ut,faction:enemy,x:spot.x,y:spot.y,hp:U[ut].def,maxHp:U[ut].def,moved:false,attacked:false});
      aiBudget-=U[ut].cost;
      if(ut==="mine")setMines(p=>[...p,{x:spot.x,y:spot.y,active:true}]);
    }

    /* ═══ SMART AI COMBAT — ANIMATED SEQUENTIAL ATTACKS ═══ */
    const isCeasefire=dipEffect==="ceasefire";
    let dead=new Set();
    const aiAttackQueue=[]; // collect attacks for visual playback
    if(!isCeasefire){
      nu.filter(u=>u.faction===enemy&&U[u.type].atk>0).forEach(ai=>{
        if(newWeather==="storm"&&(ai.type==="drone"||ai.type==="missile"||ai.type==="f35"))return;
        const effRange=Math.max(1,Math.floor(Math.max(U[ai.type].range,1)*wt.rangeMod));
        const targets=nu.filter(p=>p.faction===faction&&!dead.has(p.id)&&dist(ai,p)<=effRange);
        if(!targets.length)return;
        targets.sort((a,b)=>{
          let sa=0,sb=0;
          if(a.type==="convoy")sa+=100;if(b.type==="convoy")sb+=100;
          if(a.hp<a.maxHp*0.3)sa+=50;if(b.hp<b.maxHp*0.3)sb+=50;
          sa+=U[a.type].cost;sb+=U[b.type].cost;return sb-sa;
        });
        const tg=targets[0];
        let dmg=Math.max(1,Math.round(U[ai.type].atk*wt.atkMod)-Math.floor(Math.random()*10));
        if(ai.type==="submarine")dmg=Math.round(dmg*1.3);
        if(ai.type==="f35")dmg=Math.round(dmg*1.2);
        const killed=tg.hp-dmg<=0;
        // Apply damage to state immediately
        if(killed){dead.add(tg.id);addLog(`🤖 ${U[ai.type].icon}→${U[tg.type].icon} İMHA! (-${dmg})`);}
        else{nu=nu.map(u=>u.id===tg.id?{...u,hp:u.hp-dmg}:u);addLog(`🤖 ${U[ai.type].icon}→${U[tg.type].icon} -${dmg}`);}
        // Queue visual attack for playback
        aiAttackQueue.push({fromX:ai.x,fromY:ai.y,toX:tg.x,toY:tg.y,aiType:ai.type,tgType:tg.type,killed,dmg});
      });
    } else {
      addLog("🕊️ Ateşkes! Bu tur AI saldırmadı");
    }

    // PLAY AI ATTACKS VISUALLY — sequential with delays
    if(aiAttackQueue.length>0&&sceneRef.current){
      const scene=sceneRef.current;
      aiAttackQueue.forEach((atk,idx)=>{
        setTimeout(()=>{
          const from=g2w(atk.fromX,atk.fromY);from.y=0.4;
          const to=g2w(atk.toX,atk.toY);to.y=0.4;
          // Cinematic camera zoom to this battle
          const cin=cinematicRef.current;
          const midX=(from.x+to.x)/2,midZ=(from.z+to.z)/2;
          if(!cin.active){cin.origTh=camA.current.th;cin.origPh=camA.current.ph;cin.origD=camA.current.d;}
          cin.targetTh=Math.atan2(midX,midZ);cin.targetPh=0.4;cin.targetD=Math.max(4.5,camA.current.d*0.55);
          cin.active=true;
          // Fire projectile
          const projColor=atk.aiType==="drone"?0xff4400:atk.aiType==="missile"?0xff6600:atk.aiType==="f35"?0x4488ff:0xff8800;
          const pg=new THREE.SphereGeometry(0.07,6,6);
          const pm=new THREE.MeshBasicMaterial({color:projColor});
          const proj=new THREE.Mesh(pg,pm);proj.position.copy(from);
          // Trail light
          const tl=new THREE.PointLight(projColor,1,3);proj.add(tl);
          proj.userData={from,to,t:0,onDone:()=>{
            SFX.explosion();
            // Extra big explosion for kills
            if(sceneRef.current){
              const expCount=atk.killed?40:20;
              particlesRef.current.push(...spawnExplosion(sceneRef.current,to.clone(),expCount));
            }
          }};
          scene.add(proj);projRef.current.push(proj);
          // Reset camera after last attack
          if(idx===aiAttackQueue.length-1){
            setTimeout(()=>{
              cin.targetTh=cin.origTh;cin.targetPh=cin.origPh;cin.targetD=cin.origD;
              setTimeout(()=>{cin.active=false;},1000);
            },1200);
          }
        },idx*800); // 800ms between each AI attack
      });
    }

    /* ═══ AI MOVEMENT — move towards objectives ═══ */
    nu.filter(u=>u.faction===enemy&&U[u.type].spd>0&&!dead.has(u.id)).forEach(ai=>{
      if(ai.type==="mine")return;
      const spd=Math.max(1,Math.floor(U[ai.type].spd*wt.spdMod));
      if(newWeather==="storm"&&(ai.type==="drone"||ai.type==="f35"))return; // grounded
      // Find best move
      let bestMove=null,bestScore=-99;
      for(let dy=-spd;dy<=spd;dy++)for(let dx=-spd;dx<=spd;dx++){
        const nx=ai.x+dx,ny=ai.y+dy;
        if(nx<0||nx>=GW||ny<0||ny>=GH)continue;
        if(Math.abs(dx)+Math.abs(dy)>spd)continue;
        if(!isPlayableSea(nx,ny))continue;
        if(nu.find(u=>u.x===nx&&u.y===ny&&u.id!==ai.id))continue;
        let ms=0;
        // Move towards strait
        if(ny>=3&&ny<=5)ms+=2;
        // Move towards player units
        const nearPlayer=playerUnits.filter(p=>!dead.has(p.id)&&dist(p,{x:nx,y:ny})<=U[ai.type].range+1).length;
        ms+=nearPlayer*2;
        if(ms>bestScore){bestScore=ms;bestMove={x:nx,y:ny};}
      }
      if(bestMove&&bestScore>0&&Math.random()<0.5){
        nu=nu.map(u=>u.id===ai.id?{...u,x:bestMove.x,y:bestMove.y}:u);
      }
    });

    nu=nu.filter(u=>!dead.has(u.id));

    /* ═══ CONVOY PROGRESS ═══ */
    let pp=0;let cd=new Set();
    nu.filter(u=>u.type==="convoy"&&u.faction==="coalition").forEach(c=>{if(c.x>=GW-1){pp++;cd.add(c.id);}});
    if(pp){setPassed(p=>p+pp);setScore(s=>({...s,coalition:s.coalition+pp*20}));addLog(`🛢️ ${pp} konvoy geçti!`);}
    nu=nu.filter(u=>!cd.has(u.id));
    nu=nu.map(u=>{
      if(u.type==="convoy"&&u.faction==="coalition"){
        const spd=Math.max(1,Math.floor(1*wt.spdMod));
        const nx=Math.min(GW-1,u.x+spd);
        if(!nu.find(o=>o.x===nx&&o.y===u.y&&o.id!==u.id))return{...u,x:nx};
      }return u;
    });

    /* ═══ OIL ECONOMICS ═══ */
    let oD=0;
    const ic=nu.filter(u=>u.faction==="iran"&&u.y>=3&&u.y<=5).length;
    const cc=nu.filter(u=>u.faction==="coalition"&&u.y>=3&&u.y<=5).length;
    const am=mines.filter(m=>m.active).length;
    if(ic>cc)oD+=3+Math.floor(Math.random()*4);else if(cc>ic)oD-=2+Math.floor(Math.random()*3);
    oD+=am*1.5;if(pp)oD-=pp*3;
    if(newWeather==="storm")oD+=3; // storms raise prices
    if(Math.random()<0.4){const ev=NEWS[Math.floor(Math.random()*NEWS.length)];setNews(ev.t);oD+=ev.e;addLog(`📰 ${ev.t}`);SFX.alert();setTimeout(()=>setNews(null),3500);}
    // Diplomacy income effects
    let incomeMultiplier=1;
    if(dipEffect==="iran_nerf"&&faction==="iran")incomeMultiplier=0.5;
    if(dipEffect==="iran_income"&&faction==="iran")incomeMultiplier=2;

    const nOil=clamp(oil+oD,40,200);setOil(nOil);setOilHist(p=>[...p,Math.round(nOil)]);
    gameStats.current.maxOil=Math.max(gameStats.current.maxOil,nOil);
    gameStats.current.minOil=Math.min(gameStats.current.minOil,nOil);
    gameStats.current.convoysPassed+=pp;
    gameStats.current.straitControl=nu.filter(u=>u.faction===faction&&u.y>=3&&u.y<=5).length;
    const playerBefore=units.filter(u=>u.faction===faction).length;
    const playerAfter=nu.filter(u=>u.faction===faction).length;
    const lostThisTurn=Math.max(0,playerBefore-playerAfter);
    if(lostThisTurn===0)gameStats.current.turnsNoLoss++;else gameStats.current.turnsNoLoss=0;

    setScore(s=>({iran:s.iran+Math.max(0,Math.round((nOil-72)*0.5)+am*2),coalition:s.coalition+Math.max(0,pp*10)}));
    setBudget(b=>b+Math.round((FACTIONS[faction].income+Math.max(0,faction==="iran"?Math.round((nOil-72)*0.3):pp*5))*incomeMultiplier));
    nu=nu.map(u=>({...u,moved:false,attacked:false}));setUnits(nu);setSel(null);setPlacing(null);
    
    // Turn summary
    const aiKillsThisTurn=dead.size;
    setTurnSummary({
      turn,oilBefore:oil,oilAfter:Math.round(nOil),
      convoysPassed:pp,unitsLost:lostThisTurn,enemyKilled:aiKillsThisTurn,
      weather:newWeather,diplomacy:dipEffect,
      yourUnits:nu.filter(u=>u.faction===faction).length,
      enemyUnits:nu.filter(u=>u.faction!==faction).length,
    });

    // Tutorial: advance on first end turn
    if(tutorial.active&&tutorial.step===5)setTutorial(t=>({...t,step:6}));

    checkAchievements();
    const nt=turn+1;setTurn(nt);if(nt>MAX_T)setGameOver(true);
  };

  const startGame=async(f)=>{await SFX.init();SFX.startAmbience();setSoundOn(true);setFaction(f);setBudget(FACTIONS[f].budget);setUnits([]);setTurn(1);setOil(72);setOilHist([72]);setPassed(0);setDestroyed(0);setLog([]);setScore({iran:0,coalition:0});setGameOver(false);setShop(false);setMines([]);setSel(null);setPlacing(null);setNews(null);setNightMode(false);setWeather("clear");setDiplomacy(null);setLastPlaced(null);setTutorial({active:true,step:0});setAchievements([]);setAchievePopup(null);setKillTracker({});setPromotions({});setTurnSummary(null);gameStats.current={totalKills:0,destroyedConvoys:0,minesPlaced:0,maxOil:72,minOil:72,totalSpent:0,convoysPassed:0,hasPromotion:false,turnsNoLoss:0,straitControl:0,unitsLostThisTurn:0};meshMap.current={};hpMap.current={};wakesRef.current=[];sinkingRef.current=[];setScreen("game");};
  const buyUnit=(ut)=>{if(budget<U[ut].cost)return;setBudget(b=>b-U[ut].cost);setPlacing(ut);setShop(false);
    gameStats.current.totalSpent+=U[ut].cost;
    if(tutorial.active&&tutorial.step===1)setTutorial(t=>({...t,step:2}));
  };

  /* ═══ CINEMATIC MENU ═══ */
  const menuCanvasRef=useRef();
  const menuAnimRef=useRef();
  useEffect(()=>{
    if(screen!=="menu"||!menuCanvasRef.current)return;
    const c=menuCanvasRef.current;const ctx=c.getContext("2d");
    const resize=()=>{c.width=window.innerWidth;c.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    // particles
    const particles=Array.from({length:60},()=>({x:Math.random()*c.width,y:Math.random()*c.height,
      vx:(Math.random()-0.5)*0.5,vy:-0.3-Math.random()*0.5,sz:1+Math.random()*2,
      op:0.2+Math.random()*0.4,col:Math.random()>0.5?"#f59e0b":"#ff6b35"}));
    // ships
    const ships=Array.from({length:5},(_,i)=>({x:-100-i*300,y:c.height*0.62+Math.random()*40,
      spd:0.3+Math.random()*0.4,sz:30+Math.random()*30,flip:Math.random()>0.5}));
    // radar
    let radarAngle=0;
    let t=0;
    const draw=()=>{
      t+=0.016;ctx.clearRect(0,0,c.width,c.height);
      // gradient sky
      const skyG=ctx.createLinearGradient(0,0,0,c.height);
      skyG.addColorStop(0,"#020810");skyG.addColorStop(0.3,"#081428");skyG.addColorStop(0.55,"#0c2848");skyG.addColorStop(1,"#0a1a30");
      ctx.fillStyle=skyG;ctx.fillRect(0,0,c.width,c.height);
      // stars
      for(let i=0;i<80;i++){
        const sx=(i*137.5)%c.width,sy=(i*97.3)%c.height*0.5;
        ctx.fillStyle=`rgba(200,220,255,${0.2+Math.sin(t*2+i)*0.2})`;
        ctx.beginPath();ctx.arc(sx,sy,0.5+Math.sin(t+i)*0.5,0,Math.PI*2);ctx.fill();
      }
      // ocean waves
      for(let w=0;w<4;w++){
        ctx.beginPath();
        const baseY=c.height*0.58+w*25;
        ctx.moveTo(0,baseY);
        for(let x=0;x<=c.width;x+=4){
          const y=baseY+Math.sin(x*0.008+t*0.6+w*1.5)*12+Math.sin(x*0.015+t*0.9+w)*6;
          ctx.lineTo(x,y);
        }
        ctx.lineTo(c.width,c.height);ctx.lineTo(0,c.height);ctx.closePath();
        const a=0.4-w*0.08;
        ctx.fillStyle=`rgba(${8+w*3},${35+w*8},${70+w*12},${a})`;ctx.fill();
        ctx.strokeStyle=`rgba(56,189,248,${0.08-w*0.015})`;ctx.lineWidth=1;ctx.stroke();
      }
      // ship silhouettes
      ships.forEach(s=>{
        s.x+=s.spd;if(s.x>c.width+200)s.x=-200;
        ctx.save();ctx.translate(s.x,s.y);if(s.flip)ctx.scale(-1,1);
        ctx.fillStyle="rgba(10,20,35,0.8)";
        ctx.beginPath();ctx.moveTo(-s.sz,0);ctx.lineTo(-s.sz*0.8,-s.sz*0.25);
        ctx.lineTo(s.sz*0.3,-s.sz*0.25);ctx.lineTo(s.sz*0.4,-s.sz*0.45);
        ctx.lineTo(s.sz*0.5,-s.sz*0.45);ctx.lineTo(s.sz*0.5,-s.sz*0.2);
        ctx.lineTo(s.sz*0.9,-s.sz*0.15);ctx.lineTo(s.sz*1.1,0);ctx.closePath();ctx.fill();
        ctx.fillStyle="rgba(255,100,20,0.15)";
        ctx.fillRect(s.sz*0.35,-s.sz*0.42,s.sz*0.06,s.sz*0.12);
        // wake
        ctx.strokeStyle=`rgba(150,200,230,${0.1+Math.sin(t*3)*0.05})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(-s.sz*1.1,2);
        ctx.quadraticCurveTo(-s.sz*1.5,8+Math.sin(t*4)*3,-s.sz*2,4);ctx.stroke();
        ctx.restore();
      });
      // radar sweep from center
      const rcx=c.width/2,rcy=c.height*0.38;const rr=Math.min(c.width,c.height)*0.32;
      radarAngle+=0.012;
      // radar circles
      for(let i=1;i<=3;i++){
        ctx.strokeStyle=`rgba(34,197,94,${0.06})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(rcx,rcy,rr*i/3,0,Math.PI*2);ctx.stroke();
      }
      // radar crosshair
      ctx.strokeStyle="rgba(34,197,94,0.04)";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(rcx-rr,rcy);ctx.lineTo(rcx+rr,rcy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rcx,rcy-rr);ctx.lineTo(rcx,rcy+rr);ctx.stroke();
      // sweep line
      const grad=ctx.createConicGradient(radarAngle,rcx,rcy);
      grad.addColorStop(0,"rgba(34,197,94,0.18)");grad.addColorStop(0.08,"rgba(34,197,94,0)");
      grad.addColorStop(0.92,"rgba(34,197,94,0)");grad.addColorStop(1,"rgba(34,197,94,0.18)");
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(rcx,rcy,rr,0,Math.PI*2);ctx.fill();
      // radar blips
      for(let i=0;i<8;i++){
        const ba=radarAngle-i*0.4-Math.sin(t+i)*0.2;
        const br=rr*0.2+((i*47)%100)/100*rr*0.7;
        const bx=rcx+Math.cos(ba)*br,by=rcy+Math.sin(ba)*br;
        const bop=Math.max(0,1-i*0.12);
        ctx.fillStyle=`rgba(34,197,94,${bop*0.6})`;
        ctx.beginPath();ctx.arc(bx,by,2+Math.sin(t*3+i)*1,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgba(34,197,94,${bop*0.15})`;
        ctx.beginPath();ctx.arc(bx,by,6,0,Math.PI*2);ctx.fill();
      }
      // fire particles
      particles.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy;p.op-=0.001;
        if(p.y<0||p.op<=0){p.x=Math.random()*c.width;p.y=c.height*0.6+Math.random()*c.height*0.4;p.op=0.2+Math.random()*0.4;}
        ctx.fillStyle=p.col;ctx.globalAlpha=p.op;
        ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;
      });
      // horizon glow
      const hg=ctx.createRadialGradient(c.width/2,c.height*0.58,0,c.width/2,c.height*0.58,c.width*0.5);
      hg.addColorStop(0,"rgba(245,158,11,0.08)");hg.addColorStop(0.5,"rgba(220,80,20,0.03)");hg.addColorStop(1,"transparent");
      ctx.fillStyle=hg;ctx.fillRect(0,0,c.width,c.height);
      // vignette
      const vg=ctx.createRadialGradient(c.width/2,c.height/2,c.height*0.3,c.width/2,c.height/2,c.height*0.9);
      vg.addColorStop(0,"transparent");vg.addColorStop(1,"rgba(0,0,0,0.5)");
      ctx.fillStyle=vg;ctx.fillRect(0,0,c.width,c.height);
      menuAnimRef.current=requestAnimationFrame(draw);
    };
    draw();
    return()=>{cancelAnimationFrame(menuAnimRef.current);window.removeEventListener("resize",resize);};
  },[screen]);

  if(screen==="menu"){
    const features=[
      {icon:"✈️",label:"Drone Saldırıları",desc:"Kamikaze drone'lar ile düşman gemilerini vur"},
      {icon:"💣",label:"Deniz Mayınları",desc:"Boğazı mayınla ve düşman rotalarını kapat"},
      {icon:"⛽",label:"Petrol Ekonomisi",desc:"Küresel petrol fiyatını kontrol et"},
      {icon:"🛢️",label:"Konvoy Eskort",desc:"Tankerleri güvenle geçir veya durdur"},
    ];
    return(
      <div style={{position:"relative",minHeight:"100vh",overflow:"hidden",fontFamily:"'Segoe UI',sans-serif",color:"#c8d6e5"}}>
        <canvas ref={menuCanvasRef} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>
        {/* News ticker */}
        <div style={{position:"absolute",top:0,left:0,right:0,background:"rgba(0,0,0,0.6)",
          borderBottom:"1px solid rgba(245,158,11,0.2)",padding:"6px 0",overflow:"hidden",zIndex:5}}>
          <div style={{display:"flex",gap:40,animation:"tickerScroll 30s linear infinite",whiteSpace:"nowrap",fontSize:11,color:"#f59e0b"}}>
            {[...NEWS,...NEWS].map((n,i)=><span key={i} style={{opacity:0.7}}>
              ⚡ {n.t} &nbsp;&nbsp;│&nbsp;&nbsp;
            </span>)}
          </div>
        </div>
        {/* Main content */}
        <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
          {/* Top badge */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,animation:"fadeDown 1s ease"}}>
            <div style={{width:40,height:1,background:"linear-gradient(90deg,transparent,#f59e0b)"}}/>
            <span style={{fontSize:11,letterSpacing:6,color:"#f59e0b",fontWeight:700,textTransform:"uppercase"}}>
              3D Deniz Savaşı Simülasyonu
            </span>
            <div style={{width:40,height:1,background:"linear-gradient(90deg,#f59e0b,transparent)"}}/>
          </div>
          {/* Title */}
          <h1 style={{fontSize:"clamp(42px,8vw,80px)",fontWeight:900,margin:0,textAlign:"center",
            background:"linear-gradient(180deg,#fcd34d 0%,#f59e0b 40%,#b45309 100%)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
            letterSpacing:4,lineHeight:1,
            filter:"drop-shadow(0 0 30px rgba(245,158,11,0.3))",
            animation:"titleReveal 1.2s cubic-bezier(.16,1,.3,1) both"}}>
            HÜRMÜZ<br/>BOĞAZI
          </h1>
          {/* Subtitle */}
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"12px 0 6px",animation:"fadeUp 1s .3s ease both"}}>
            <div style={{width:20,height:1,background:"rgba(255,255,255,0.2)"}}/>
            <span style={{fontSize:14,color:"#94a3b8",fontWeight:500,letterSpacing:3}}>MART 2026</span>
            <div style={{width:20,height:1,background:"rgba(255,255,255,0.2)"}}/>
          </div>
          <p style={{fontSize:13,color:"#64748b",margin:"0 0 28px",animation:"fadeUp 1s .5s ease both",textAlign:"center",maxWidth:400,lineHeight:1.6}}>
            Dünya tarihinin en büyük enerji krizinde kontrolü ele al.
            Boğazı domine et, küresel petrol piyasasını yönet.
          </p>
          {/* Feature pills */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:28,animation:"fadeUp 1s .6s ease both"}}>
            {features.map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:20,padding:"5px 14px 5px 8px",fontSize:11,
                animation:`fadeUp 0.6s ${0.7+i*0.1}s ease both`}}>
                <span style={{fontSize:14}}>{f.icon}</span>
                <span style={{color:"#94a3b8"}}>{f.label}</span>
              </div>
            ))}
          </div>
          {/* FACTION CARDS */}
          <div style={{display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center",animation:"fadeUp 1s .8s ease both"}}>
            {Object.entries(FACTIONS).map(([k,f],idx)=>{
              const isIran=k==="iran";
              const unitList=f.units;
              return(
                <button key={k} onClick={()=>startGame(k)} className="fcard" style={{
                  position:"relative",overflow:"hidden",
                  background:`linear-gradient(160deg,rgba(0,0,0,0.6),${f.hex}15)`,
                  border:`1.5px solid ${f.hex}35`,borderRadius:16,padding:0,
                  color:"#c8d6e5",cursor:"pointer",width:320,textAlign:"left",
                  fontFamily:"inherit",transition:"all .4s cubic-bezier(.4,0,.2,1)",
                  backdropFilter:"blur(12px)",
                }}>
                  {/* Top color bar */}
                  <div style={{height:3,background:`linear-gradient(90deg,${f.hex},${f.hex}66,transparent)`}}/>
                  <div style={{padding:"20px 24px 16px"}}>
                    {/* Flag + name row */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div>
                        <div style={{fontSize:42,lineHeight:1}}>{isIran?"🇮🇷":"🇺🇸"}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:26,fontWeight:900,color:f.hex,letterSpacing:1}}>{f.name}</div>
                        <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                          {isIran?"Saldırı Tarafı":"Savunma Tarafı"}
                        </div>
                      </div>
                    </div>
                    {/* Description */}
                    <p style={{fontSize:12,color:"#8899aa",margin:"0 0 14px",lineHeight:1.6}}>{f.desc}</p>
                    {/* Unit preview */}
                    <div style={{display:"flex",gap:6,marginBottom:14}}>
                      {unitList.map(ut=>(
                        <div key={ut} style={{flex:1,background:"rgba(255,255,255,0.04)",
                          border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,
                          padding:"8px 4px",textAlign:"center"}}>
                          <div style={{fontSize:18}}>{U[ut].icon}</div>
                          <div style={{fontSize:8,color:"#64748b",marginTop:2}}>{U[ut].name.split(" ")[0]}</div>
                        </div>
                      ))}
                    </div>
                    {/* Stats */}
                    <div style={{display:"flex",gap:16,fontSize:11}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:"#fbbf24"}}>💰</span>
                        <div>
                          <div style={{color:"#8899aa",fontSize:9}}>BÜTÇE</div>
                          <div style={{color:"#e2e8f0",fontWeight:700}}>${f.budget}M</div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:"#22c55e"}}>📈</span>
                        <div>
                          <div style={{color:"#8899aa",fontSize:9}}>GELİR</div>
                          <div style={{color:"#e2e8f0",fontWeight:700}}>${f.income}M/tur</div>
                        </div>
                      </div>
                      <div style={{flex:1}}/>
                      <div style={{display:"flex",alignItems:"center",gap:4,
                        background:`${f.hex}20`,padding:"4px 12px",borderRadius:6,
                        border:`1px solid ${f.hex}30`,fontSize:12,fontWeight:700,color:f.hex}}>
                        OYNA ▸
                      </div>
                    </div>
                  </div>
                  {/* Animated corner glow */}
                  <div style={{position:"absolute",top:-50,right:-50,width:120,height:120,
                    background:`radial-gradient(circle,${f.hex}15,transparent 70%)`,
                    borderRadius:"50%",pointerEvents:"none"}}/>
                </button>
              );
            })}
          </div>
          {/* Controls hint */}
          <div style={{display:"flex",gap:20,marginTop:28,animation:"fadeUp 1s 1s ease both"}}>
            {[{icon:"🖱️",label:"Sürükle",desc:"Kamerayı döndür"},{icon:"🔄",label:"Scroll",desc:"Yakınlaştır"},{icon:"👆",label:"Tıkla",desc:"Etkileşim"}].map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#475569"}}>
                <span style={{fontSize:14}}>{h.icon}</span>
                <div><div style={{fontWeight:700,color:"#64748b"}}>{h.label}</div><div>{h.desc}</div></div>
              </div>
            ))}
          </div>
          {/* Version */}
          <div style={{position:"absolute",bottom:12,right:16,fontSize:9,color:"#1e293b"}}>v3.0 — Three.js Engine</div>
        </div>
        <style>{`
          @keyframes fadeUp{from{opacity:0;transform:translateY(25px)}to{opacity:1;transform:none}}
          @keyframes fadeDown{from{opacity:0;transform:translateY(-15px)}to{opacity:1;transform:none}}
          @keyframes titleReveal{from{opacity:0;transform:translateY(40px) scale(0.9);filter:blur(8px)}to{opacity:1;transform:none;filter:drop-shadow(0 0 30px rgba(245,158,11,0.3))}}
          @keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
          .fcard:hover{transform:translateY(-8px) scale(1.02);box-shadow:0 20px 60px rgba(0,0,0,0.6);border-color:rgba(255,255,255,0.15)!important}
          .fcard:active{transform:translateY(-4px) scale(1.01)}
        `}</style>
      </div>
    );
  }

  if(gameOver){const w=score.iran>score.coalition?"iran":"coalition";const won=w===faction;
    // Stop ambience when game ends
    if(SFX.ambience){SFX.stopAmbience();}
    return(<div style={{minHeight:"100vh",background:"linear-gradient(180deg,#040810,#111827)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:"#c8d6e5",padding:20}}>
      <div style={{fontSize:80}}>{won?"🏆":"💀"}</div><h2 style={{fontSize:40,fontWeight:900,color:won?"#fbbf24":"#ef4444",margin:10}}>{won?"ZAFER!":"YENİLGİ"}</h2>
      <p style={{color:"#64748b"}}>{FACTIONS[w].name} kazandı</p>
      <div style={{display:"flex",gap:48,margin:"20px 0",background:"rgba(255,255,255,.03)",padding:"20px 40px",borderRadius:14}}>
        {["iran","coalition"].map(f=><div key={f} style={{textAlign:"center"}}><div style={{fontSize:32,fontWeight:900,color:FACTIONS[f].hex}}>{score[f]}</div><div style={{fontSize:11,color:"#64748b"}}>{FACTIONS[f].name}</div></div>)}</div>
      {/* Final stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        {[{l:"Petrol",v:`$${Math.round(oil)}/bbl`,c:"#fbbf24"},{l:"Konvoy Geçen",v:passed,c:"#38bdf8"},{l:"İmha Edilen",v:destroyed,c:"#ef4444"},
          {l:"Toplam Kill",v:gameStats.current.totalKills,c:"#f59e0b"},{l:"Harcanan",v:`$${gameStats.current.totalSpent}M`,c:"#a78bfa"},{l:"Başarım",v:`${achievements.length}/${ACHIEVE_DEFS.length}`,c:"#22c55e"}
        ].map((s,i)=><div key={i} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:8,color:"#475569"}}>{s.l}</div>
          <div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.v}</div>
        </div>)}
      </div>
      {/* Achievements earned */}
      {achievements.length>0&&<div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",justifyContent:"center"}}>
        {achievements.map(aId=>{const a=ACHIEVE_DEFS.find(d=>d.id===aId);return a?<div key={aId} title={a.desc} style={{
          display:"flex",alignItems:"center",gap:4,background:"rgba(168,85,247,.1)",border:"1px solid rgba(168,85,247,.25)",
          borderRadius:8,padding:"4px 10px",fontSize:11}}><span>{a.icon}</span><span style={{color:"#c4b5fd"}}>{a.name}</span></div>:null;})}
      </div>}
      <button onClick={()=>{setScreen("menu");setGameOver(false);SFX.stopAmbience();}} style={{background:"linear-gradient(135deg,#f59e0b,#92400e)",border:"none",borderRadius:10,padding:"14px 36px",color:"#000",fontSize:16,fontWeight:800,cursor:"pointer",marginTop:4}}>Ana Menüye Dön</button>
    </div>);
  }

  const fD=FACTIONS[faction];
  return(<div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#040810",fontFamily:"'Segoe UI',sans-serif",color:"#c8d6e5",overflow:"hidden"}}>
    {news&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"linear-gradient(90deg,#7f1d1d,#dc2626,#7f1d1d)",color:"#fff",textAlign:"center",padding:8,fontSize:13,fontWeight:700,animation:"slideD .3s ease",boxShadow:"0 4px 20px rgba(220,38,38,.4)"}}>📰 SON DAKİKA: {news}</div>}
    {diplomacy&&<div style={{position:"fixed",top:news?32:0,left:0,right:0,zIndex:99,background:"linear-gradient(90deg,#1e1b4b,#4338ca,#1e1b4b)",color:"#e0e7ff",textAlign:"center",padding:"8px 16px",fontSize:13,fontWeight:700,animation:"slideD .4s ease",boxShadow:"0 4px 20px rgba(67,56,202,.4)"}}>🏛️ DİPLOMASİ: {diplomacy.t} — <span style={{color:"#fbbf24",fontSize:11}}>{diplomacy.desc}</span></div>}
    <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",background:"rgba(0,0,0,.6)",borderBottom:"1px solid rgba(255,255,255,.06)",backdropFilter:"blur(12px)",gap:8,zIndex:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:fD.hex,fontWeight:800,fontSize:13,padding:"3px 10px",borderRadius:6,background:fD.hex+"15",border:`1px solid ${fD.hex}40`}}>{faction==="iran"?"🇮🇷":"🇺🇸"} {fD.name}</span><span style={{fontSize:12,color:"#64748b",fontWeight:600}}>Tur {turn}/{MAX_T}</span>
        <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:weather==="storm"?"rgba(139,92,246,0.15)":weather==="fog"?"rgba(148,163,184,0.15)":"rgba(250,204,21,0.1)",color:weather==="storm"?"#a78bfa":weather==="fog"?"#94a3b8":"#fbbf24",border:`1px solid ${weather==="storm"?"rgba(139,92,246,0.3)":weather==="fog"?"rgba(148,163,184,0.2)":"rgba(250,204,21,0.2)"}`}}>{WEATHER_TYPES[weather].icon} {WEATHER_TYPES[weather].name}</span>
      </div>
      <div style={{display:"flex",gap:14,fontSize:12,fontWeight:600}}><span style={{color:"#fbbf24"}}>💰 ${budget}M</span><span style={{color:oil>100?"#ef4444":oil>85?"#f59e0b":"#22c55e"}}>⛽ ${Math.round(oil)}/bbl</span><span style={{color:"#38bdf8"}}>🛢️ {passed}</span><span style={{color:"#f87171"}}>💥 {destroyed}</span>
        <button onClick={()=>{setNightMode(n=>!n);SFX.click();}} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"1px 6px",cursor:"pointer",fontSize:12,color:nightMode?"#fbbf24":"#64748b"}} title="Gece/Gündüz">{nightMode?"🌙":"☀️"}</button>
        <button onClick={async()=>{if(!soundOn){await SFX.init();SFX.startAmbience();setSoundOn(true);SFX.click();}else{SFX.stopAmbience();setSoundOn(false);}}} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"1px 6px",cursor:"pointer",fontSize:12,color:soundOn?"#22c55e":"#64748b"}} title="Ses Aç/Kapat">{soundOn?"🔊":"🔇"}</button>
      </div>
    </div>
    <div style={{display:"flex",height:4,background:"#0a0f18"}}><div style={{width:`${Math.max(2,(score.iran/(score.iran+score.coalition+1))*100)}%`,background:FACTIONS.iran.hex,transition:"width .8s"}}/><div style={{flex:1,background:FACTIONS.coalition.hex}}/></div>
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* ═══ LEFT PANEL — POLISHED ═══ */}
      <div style={{width:220,padding:0,background:"linear-gradient(180deg,rgba(5,10,20,.9),rgba(8,16,32,.95))",
        borderRight:"1px solid rgba(255,255,255,.06)",display:"flex",flexDirection:"column",
        overflow:"hidden",flexShrink:0,fontSize:11,position:"relative"}}>
        
        {/* Faction header */}
        <div style={{padding:"10px 12px",background:`linear-gradient(135deg,${fD.hex}15,transparent)`,
          borderBottom:`1px solid ${fD.hex}20`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:`${fD.hex}20`,border:`1px solid ${fD.hex}40`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
              {faction==="iran"?"🇮🇷":"🇺🇸"}
            </div>
            <div>
              <div style={{fontWeight:800,fontSize:13,color:fD.hex}}>{fD.name}</div>
              <div style={{fontSize:9,color:"#64748b"}}>Tur {turn}/{MAX_T}</div>
            </div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:900,color:"#fbbf24"}}>${budget}M</div>
              <div style={{fontSize:8,color:"#64748b"}}>BÜTÇE</div>
            </div>
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:"8px 10px",display:"flex",flexDirection:"column",gap:8}}>

          {/* PETROL CHART — Enhanced */}
          <div style={{background:"rgba(0,0,0,.35)",borderRadius:10,padding:10,
            border:"1px solid rgba(255,255,255,.06)",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:60,height:60,
              background:`radial-gradient(circle,${oil>100?"rgba(239,68,68,.08)":"rgba(34,197,94,.05)"},transparent)`,pointerEvents:"none"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:9,color:"#475569",fontWeight:700,letterSpacing:1}}>⛽ PETROL PİYASASI</span>
              <span style={{fontSize:10,fontWeight:800,
                color:oil>100?"#ef4444":oil>85?"#f59e0b":"#22c55e",
                background:oil>100?"rgba(239,68,68,.1)":"rgba(34,197,94,.08)",
                padding:"1px 6px",borderRadius:4}}>
                ${Math.round(oil)}/bbl
              </span>
            </div>
            <div style={{display:"flex",alignItems:"end",height:42,gap:1,marginBottom:4}}>
              {oilHist.slice(-15).map((p,i,arr)=>{
                const isLast=i===arr.length-1;
                return <div key={i} style={{flex:1,minWidth:2,borderRadius:"3px 3px 0 0",
                  transition:"height .5s cubic-bezier(.4,0,.2,1)",
                  height:`${Math.max(3,((p-40)/160)*42)}px`,
                  background:isLast
                    ?`linear-gradient(0deg,${p>100?"#dc2626":"#15803d"},${p>100?"#ef4444":"#22c55e"})`
                    :p>100?"rgba(239,68,68,.4)":p>85?"rgba(245,158,11,.35)":"rgba(34,197,94,.3)",
                  boxShadow:isLast?`0 0 6px ${p>100?"rgba(239,68,68,.4)":"rgba(34,197,94,.3)"}`:undefined,
                }}/>;
              })}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#475569"}}>
              <span>15 tur önce</span>
              <span style={{color:oil>oilHist[Math.max(0,oilHist.length-2)]?"#ef4444":"#22c55e",fontWeight:700}}>
                {oil>oilHist[Math.max(0,oilHist.length-2)]?"▲ Yükseliyor":"▼ Düşüyor"}
              </span>
              <span>Şimdi</span>
            </div>
          </div>

          {/* MINIMAP — Enhanced */}
          <div style={{background:"rgba(0,0,0,.35)",borderRadius:10,padding:8,
            border:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{fontSize:9,color:"#475569",fontWeight:700,letterSpacing:1,marginBottom:4}}>📍 TAKTİK HARİTA</div>
            <Minimap units={units} mines={mines} faction={faction} sel={sel}/>
            <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:4,fontSize:8,color:"#475569"}}>
              <span>🟢 Dost</span><span>🔵 Düşman</span><span>🔴 Mayın</span>
            </div>
          </div>

          {/* PLACEMENT HINT */}
          {placing&&<div style={{fontSize:11,color:"#fbbf24",textAlign:"center",padding:"8px 10px",
            background:"linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.15))",
            borderRadius:10,border:"1px dashed rgba(245,158,11,.3)",
            animation:"pulse 1.5s infinite"}}>
            <div style={{fontSize:20,marginBottom:2}}>{U[placing].icon}</div>
            <div style={{fontWeight:700}}>{U[placing].name}</div>
            <div style={{fontSize:9,color:"#b45309",marginTop:2}}>Haritada parlayan alanlara tıkla</div>
          </div>}

          {/* SHOP — Enhanced */}
          <button onClick={()=>{setShop(!shop);SFX.click();}} style={{
            background:shop?`linear-gradient(135deg,${fD.hex}30,${fD.hex}15)`:`linear-gradient(135deg,${fD.hex}15,${fD.hex}30)`,
            border:`1px solid ${fD.hex}40`,borderRadius:10,padding:"10px 14px",
            color:"#c8d6e5",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            transition:"all .2s"}}>
            <span>🏪 Birlik Mağazası</span>
            <span style={{fontSize:16,transition:"transform .3s",transform:shop?"rotate(180deg)":"rotate(0)"}}>{shop?"▲":"▼"}</span>
          </button>

          {shop&&<div style={{display:"flex",flexDirection:"column",gap:4,animation:"fadeIn .3s ease"}}>
            {fD.units.map(ut=>{
              const canAfford=budget>=U[ut].cost;
              const u=U[ut];
              const atkPct=u.atk/50*100;
              const defPct=u.def/50*100;
              const spdPct=u.spd/4*100;
              return(
                <button key={ut} onClick={()=>{buyUnit(ut);SFX.click();}} disabled={!canAfford}
                  style={{background:canAfford?"rgba(255,255,255,.04)":"rgba(255,255,255,.01)",
                    border:canAfford?`1px solid ${fD.hex}25`:"1px solid rgba(255,255,255,.04)",
                    borderRadius:10,padding:"8px 10px",textAlign:"left",fontFamily:"inherit",
                    color:canAfford?"#c8d6e5":"#334155",cursor:canAfford?"pointer":"not-allowed",
                    transition:"all .2s",position:"relative",overflow:"hidden"}}>
                  {/* Top glow on hover */}
                  {canAfford&&<div style={{position:"absolute",top:0,left:0,right:0,height:1,
                    background:`linear-gradient(90deg,transparent,${fD.hex}40,transparent)`}}/>}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:22,width:30,textAlign:"center"}}>{u.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontWeight:700,fontSize:11}}>{u.name}</span>
                        <span style={{fontSize:10,fontWeight:800,color:canAfford?"#fbbf24":"#555"}}>
                          ${u.cost}M
                        </span>
                      </div>
                      {/* Stat bars */}
                      <div style={{display:"flex",gap:4,marginTop:4}}>
                        <div style={{flex:1}} title={`Saldırı: ${u.atk}`}>
                          <div style={{fontSize:7,color:"#64748b",marginBottom:1}}>⚔️ATK</div>
                          <div style={{height:3,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:2,background:"#ef4444",width:`${atkPct}%`}}/>
                          </div>
                        </div>
                        <div style={{flex:1}} title={`Savunma: ${u.def}`}>
                          <div style={{fontSize:7,color:"#64748b",marginBottom:1}}>🛡️DEF</div>
                          <div style={{height:3,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:2,background:"#3b82f6",width:`${defPct}%`}}/>
                          </div>
                        </div>
                        <div style={{flex:1}} title={`Hız: ${u.spd}`}>
                          <div style={{fontSize:7,color:"#64748b",marginBottom:1}}>🏃SPD</div>
                          <div style={{height:3,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:2,background:"#22c55e",width:`${spdPct}%`}}/>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>}

          {/* SELECTED UNIT — Enhanced */}
          {sel&&<div style={{background:"linear-gradient(135deg,rgba(0,0,0,.4),rgba(0,0,0,.2))",
            borderRadius:10,padding:10,border:`1px solid ${fD.hex}25`,
            animation:"fadeIn .2s ease",position:"relative",overflow:"hidden"}}>
            {/* Faction color accent */}
            <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:fD.hex,borderRadius:"10px 0 0 10px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{fontSize:26}}>{U[sel.type].icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:13,color:"#e2e8f0"}}>{U[sel.type].name}</div>
                <div style={{fontSize:9,color:"#64748b"}}>
                  {sel.faction==="iran"?"İran Kuvvetleri":"Koalisyon Kuvvetleri"}
                  {killTracker[sel.id]>0&&<span style={{marginLeft:6,color:"#ef4444",fontWeight:700}}>💀×{killTracker[sel.id]}</span>}
                  {promotions[sel.id]&&<span style={{marginLeft:4,color:"#fbbf24",fontWeight:700}}>⭐ Terfi</span>}
                </div>
              </div>
            </div>
            {/* HP Bar — big */}
            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                <span style={{color:"#64748b"}}>DAYANIKLILIK</span>
                <span style={{color:sel.hp>sel.maxHp*0.6?"#22c55e":"#ef4444",fontWeight:700}}>{sel.hp}/{sel.maxHp}</span>
              </div>
              <div style={{height:6,background:"rgba(0,0,0,.5)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,transition:"width .5s cubic-bezier(.4,0,.2,1)",
                  width:`${(sel.hp/sel.maxHp)*100}%`,
                  background:sel.hp>sel.maxHp*0.6?"linear-gradient(90deg,#15803d,#22c55e)":
                    sel.hp>sel.maxHp*0.3?"linear-gradient(90deg,#b45309,#f59e0b)":"linear-gradient(90deg,#991b1b,#ef4444)",
                  boxShadow:sel.hp<=sel.maxHp*0.3?"0 0 8px rgba(239,68,68,.4)":"none"}}/>
              </div>
            </div>
            {/* Stats grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
              {[
                {label:"Saldırı",val:U[sel.type].atk,icon:"⚔️",color:"#ef4444"},
                {label:"Savunma",val:U[sel.type].def,icon:"🛡️",color:"#3b82f6"},
                {label:"Hız",val:U[sel.type].spd,icon:"🏃",color:"#22c55e"},
                {label:"Menzil",val:U[sel.type].range,icon:"📡",color:"#a78bfa"},
              ].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,.03)",borderRadius:6,padding:"4px 6px",
                  display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:12}}>{s.icon}</span>
                  <div>
                    <div style={{fontSize:7,color:"#475569"}}>{s.label}</div>
                    <div style={{fontSize:11,fontWeight:800,color:s.color}}>{s.val}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Action status */}
            <div style={{display:"flex",gap:6}}>
              <div style={{flex:1,textAlign:"center",padding:"4px",borderRadius:6,fontSize:9,fontWeight:600,
                background:sel.moved?"rgba(34,197,94,.1)":"rgba(255,255,255,.03)",
                color:sel.moved?"#22c55e":"#64748b",
                border:sel.moved?"1px solid rgba(34,197,94,.2)":"1px solid rgba(255,255,255,.05)"}}>
                {sel.moved?"✅ Hareket Etti":"⬜ Hareket Bekliyor"}
              </div>
              <div style={{flex:1,textAlign:"center",padding:"4px",borderRadius:6,fontSize:9,fontWeight:600,
                background:sel.attacked?"rgba(239,68,68,.1)":"rgba(255,255,255,.03)",
                color:sel.attacked?"#ef4444":"#64748b",
                border:sel.attacked?"1px solid rgba(239,68,68,.2)":"1px solid rgba(255,255,255,.05)"}}>
                {sel.attacked?"✅ Saldırdı":"⬜ Saldırı Bekliyor"}
              </div>
            </div>
          </div>}

        </div>

        {/* BOTTOM — End Turn & Score */}
        <div style={{padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",
          background:"rgba(0,0,0,.3)"}}>
          <button onClick={endTurn} style={{
            width:"100%",background:"linear-gradient(135deg,#f59e0b,#b45309)",
            border:"none",borderRadius:10,padding:"12px",color:"#000",fontSize:14,fontWeight:800,
            cursor:"pointer",fontFamily:"inherit",
            boxShadow:"0 4px 15px rgba(245,158,11,.25)",transition:"all .2s",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span>⏭️ Turu Bitir</span>
            <span style={{fontSize:10,opacity:0.7}}>({turn}/{MAX_T})</span>
          </button>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700,
            marginTop:6,padding:"0 4px"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:FACTIONS.iran.hex}}/>
              <span style={{color:FACTIONS.iran.hex}}>{score.iran}</span>
            </div>
            <div style={{fontSize:9,color:"#334155"}}>VS</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{color:FACTIONS.coalition.hex}}>{score.coalition}</span>
              <div style={{width:8,height:8,borderRadius:"50%",background:FACTIONS.coalition.hex}}/>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3D VIEWPORT + QUICK-BUY BAR ═══ */}
      <div style={{flex:1,position:"relative",overflow:"hidden"}}>
        <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}} onMouseDown={onDown} onMouseUp={onUp} onMouseMove={onMove} onMouseLeave={onUp} onWheel={onWheel} onClick={onClick}/>
        
        {/* QUICK-BUY TOOLBAR — always visible */}
        <div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",
          display:"flex",gap:4,padding:"6px 10px",
          background:"rgba(5,10,20,.85)",backdropFilter:"blur(12px)",
          borderRadius:14,border:"1px solid rgba(255,255,255,.08)",
          boxShadow:"0 8px 30px rgba(0,0,0,.5)",zIndex:5}}>
          {fD.units.map((ut,i)=>{
            const u=U[ut];const canAfford=budget>=u.cost;
            const isActive=placing===ut;
            return(
              <button key={ut} onClick={()=>{
                if(!canAfford)return;
                if(isActive){setPlacing(null);return;}
                buyUnit(ut);SFX.click();
              }}
              title={`${u.name} — $${u.cost}M (${i+1} tuşu)\n⚔️${u.atk} 🛡️${u.def} 🏃${u.spd}`}
              style={{
                display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                padding:"6px 10px",borderRadius:10,border:isActive?`2px solid ${fD.hex}`:"2px solid transparent",
                background:isActive?`${fD.hex}25`:canAfford?"rgba(255,255,255,.04)":"rgba(255,255,255,.01)",
                cursor:canAfford?"pointer":"not-allowed",
                opacity:canAfford?1:0.35,
                transition:"all .15s",fontFamily:"inherit",
                minWidth:56,position:"relative",
              }}>
                {/* Keyboard shortcut badge */}
                <div style={{position:"absolute",top:2,right:4,fontSize:8,fontWeight:700,
                  color:isActive?fD.hex:"#475569",
                  background:isActive?`${fD.hex}20`:"rgba(255,255,255,.06)",
                  borderRadius:3,padding:"0 3px",lineHeight:"14px"}}>{i+1}</div>
                <div style={{fontSize:22,filter:isActive?"drop-shadow(0 0 6px "+fD.hex+")":"none"}}>{u.icon}</div>
                <div style={{fontSize:8,fontWeight:700,color:isActive?fD.hex:"#8899aa",
                  whiteSpace:"nowrap",maxWidth:50,overflow:"hidden",textOverflow:"ellipsis"}}>{u.name.split(" ")[0]}</div>
                <div style={{fontSize:9,fontWeight:800,color:canAfford?"#fbbf24":"#334155"}}>${u.cost}M</div>
                {/* Active indicator */}
                {isActive&&<div style={{position:"absolute",bottom:-2,left:"50%",transform:"translateX(-50%)",
                  width:20,height:3,borderRadius:2,background:fD.hex,
                  boxShadow:`0 0 8px ${fD.hex}`}}/>}
              </button>
            );
          })}
          {/* Divider */}
          <div style={{width:1,background:"rgba(255,255,255,.08)",margin:"4px 2px"}}/>
          {/* Cancel / ESC */}
          {placing&&<button onClick={()=>{setBudget(b=>b+U[placing].cost);setPlacing(null);SFX.click();}}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              padding:"6px 10px",borderRadius:10,border:"2px solid rgba(239,68,68,.3)",
              background:"rgba(239,68,68,.08)",cursor:"pointer",fontFamily:"inherit",
              minWidth:50}}>
            <div style={{fontSize:18}}>❌</div>
            <div style={{fontSize:8,fontWeight:700,color:"#ef4444"}}>İptal</div>
            <div style={{fontSize:8,color:"#64748b"}}>ESC</div>
          </button>}
          {/* Repeat last */}
          {!placing&&lastPlaced&&budget>=U[lastPlaced].cost&&<button 
            onClick={()=>{setBudget(b=>b-U[lastPlaced].cost);setPlacing(lastPlaced);SFX.click();}}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              padding:"6px 10px",borderRadius:10,border:"2px solid rgba(245,158,11,.3)",
              background:"rgba(245,158,11,.08)",cursor:"pointer",fontFamily:"inherit",
              minWidth:50}}>
            <div style={{fontSize:18}}>🔄</div>
            <div style={{fontSize:8,fontWeight:700,color:"#fbbf24"}}>Tekrar</div>
            <div style={{fontSize:8,color:"#64748b"}}>{U[lastPlaced].icon}</div>
          </button>}
        </div>

        {/* Placement info overlay */}
        {placing&&<div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",
          display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
          background:"rgba(5,10,20,.85)",backdropFilter:"blur(12px)",
          borderRadius:10,border:`1px solid ${fD.hex}40`,
          boxShadow:`0 4px 20px rgba(0,0,0,.4)`,zIndex:5,
          animation:"fadeIn .3s ease"}}>
          <span style={{fontSize:24}}>{U[placing].icon}</span>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:fD.hex}}>{U[placing].name}</div>
            <div style={{fontSize:10,color:"#8899aa"}}>Parlayan hücrelere tıkla</div>
          </div>
          <div style={{width:1,height:24,background:"rgba(255,255,255,.1)",margin:"0 4px"}}/>
          <div style={{fontSize:9,color:"#64748b",lineHeight:1.5}}>
            ⚔️{U[placing].atk} 🛡️{U[placing].def} 🏃{U[placing].spd} 📡{U[placing].range}
          </div>
        </div>}
      </div>

      {/* ═══ RIGHT PANEL — POLISHED ═══ */}
      <div style={{width:210,padding:0,background:"linear-gradient(180deg,rgba(5,10,20,.9),rgba(8,16,32,.95))",
        borderLeft:"1px solid rgba(255,255,255,.06)",display:"flex",flexDirection:"column",
        overflow:"hidden",flexShrink:0}}>
        
        {/* Log header */}
        <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.06)",
          background:"rgba(0,0,0,.2)"}}>
          <div style={{fontSize:10,color:"#64748b",fontWeight:700,letterSpacing:1,
            display:"flex",alignItems:"center",gap:6}}>
            <span>📋</span><span>HAREKAT GÜNLÜĞÜ</span>
            <span style={{marginLeft:"auto",fontSize:9,color:"#334155"}}>{log.length}</span>
          </div>
        </div>

        {/* Log entries */}
        <div style={{flex:1,overflow:"auto",padding:"6px 8px",display:"flex",flexDirection:"column",gap:2}}>
          {log.map((e,i)=>(
            <div key={i} style={{
              fontSize:10,padding:"5px 8px",borderRadius:6,lineHeight:1.5,
              color:i===0?"#e2e8f0":i<3?"#8899aa":"#445566",
              background:i===0?"rgba(255,255,255,.06)":i<3?"rgba(255,255,255,.02)":"transparent",
              borderLeft:i===0?`3px solid ${fD.hex}`:i<3?"3px solid rgba(255,255,255,.05)":"3px solid transparent",
              animation:i===0?"fadeIn .3s ease":"none",
              transition:"all .3s"
            }}>{e}</div>
          ))}
          {log.length===0&&<div style={{textAlign:"center",padding:20,color:"#334155",fontSize:10}}>
            Henüz hareket yok<br/>Birlik konuşlandır!
          </div>}
        </div>

        {/* Status section */}
        <div style={{padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",
          background:"rgba(0,0,0,.3)"}}>
          <div style={{fontSize:9,fontWeight:700,color:"#475569",letterSpacing:1,marginBottom:6}}>📊 SAVAŞ DURUMU</div>
          
          {/* Unit counts with bars */}
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:6}}>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                <span style={{color:"#64748b"}}>Birliklerin</span>
                <span style={{color:fD.hex,fontWeight:700}}>{units.filter(u=>u.faction===faction).length}</span>
              </div>
              <div style={{height:3,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",background:fD.hex,borderRadius:2,transition:"width .5s",
                  width:`${Math.min(100,units.filter(u=>u.faction===faction).length*10)}%`}}/>
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                <span style={{color:"#64748b"}}>Düşman</span>
                <span style={{color:"#ef4444",fontWeight:700}}>{units.filter(u=>u.faction!==faction).length}</span>
              </div>
              <div style={{height:3,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",background:"#ef4444",borderRadius:2,transition:"width .5s",
                  width:`${Math.min(100,units.filter(u=>u.faction!==faction).length*10)}%`}}/>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            <div style={{background:"rgba(255,255,255,.03)",borderRadius:6,padding:"4px 6px",textAlign:"center"}}>
              <div style={{fontSize:7,color:"#475569"}}>💣 MAYIN</div>
              <div style={{fontSize:12,fontWeight:800,color:"#f59e0b"}}>{mines.filter(m=>m.active).length}</div>
            </div>
            <div style={{background:"rgba(255,255,255,.03)",borderRadius:6,padding:"4px 6px",textAlign:"center"}}>
              <div style={{fontSize:7,color:"#475569"}}>⛽ PETROL</div>
              <div style={{fontSize:12,fontWeight:800,color:oil>100?"#ef4444":"#22c55e"}}>${Math.round(oil)}</div>
            </div>
          </div>

          {/* Weather */}
          <div style={{background:weather==="storm"?"rgba(139,92,246,.08)":weather==="fog"?"rgba(148,163,184,.08)":"rgba(250,204,21,.05)",
            borderRadius:8,padding:"6px 8px",border:`1px solid ${weather==="storm"?"rgba(139,92,246,.15)":weather==="fog"?"rgba(148,163,184,.1)":"rgba(250,204,21,.1)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:16}}>{WEATHER_TYPES[weather].icon}</span>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:weather==="storm"?"#a78bfa":weather==="fog"?"#94a3b8":"#fbbf24"}}>
                  {WEATHER_TYPES[weather].name}
                </div>
                {weather!=="clear"&&<div style={{fontSize:8,color:"#64748b",marginTop:1}}>{WEATHER_TYPES[weather].desc}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* ═══ TUTORIAL OVERLAY ═══ */}
    {tutorial.active&&tutorial.step<TUTORIAL_STEPS.length&&(
      <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:200,
        pointerEvents:"auto",width:"90%",maxWidth:440}}>
        <div style={{background:"linear-gradient(145deg,rgba(10,16,30,.97),rgba(15,25,45,.99))",
          borderRadius:16,padding:"20px 24px",
          border:"1px solid rgba(245,158,11,.2)",boxShadow:"0 20px 60px rgba(0,0,0,.7),0 0 40px rgba(245,158,11,.08)",
          animation:"fadeIn .4s ease"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(245,158,11,.15)",
              border:"1px solid rgba(245,158,11,.3)",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18}}>🎖️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#fbbf24"}}>{TUTORIAL_STEPS[tutorial.step].title}</div>
              <div style={{fontSize:9,color:"#64748b"}}>Adım {tutorial.step+1}/{TUTORIAL_STEPS.length}</div>
            </div>
            {/* Close X */}
            <button onClick={()=>setTutorial({active:false,step:99})} style={{
              background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:16,
              padding:4,fontFamily:"inherit"}}>✕</button>
          </div>
          <p style={{fontSize:12,color:"#94a3b8",lineHeight:1.7,margin:"0 0 12px"}}>{TUTORIAL_STEPS[tutorial.step].msg}</p>
          {/* Progress dots */}
          <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:10}}>
            {TUTORIAL_STEPS.map((_,i)=>(
              <div key={i} style={{width:i===tutorial.step?20:8,height:5,borderRadius:3,
                background:i<tutorial.step?"#22c55e":i===tutorial.step?"#fbbf24":"rgba(255,255,255,.1)",
                transition:"all .3s"}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setTutorial({active:false,step:99})} style={{
              background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",
              borderRadius:8,padding:"8px 16px",color:"#64748b",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
              Atla
            </button>
            <button onClick={()=>{
              const s=tutorial.step;
              if(s>=TUTORIAL_STEPS.length-1)setTutorial({active:false,step:99});
              else setTutorial(t=>({...t,step:t.step+1}));SFX.click();
            }} style={{
              background:"linear-gradient(135deg,#f59e0b,#b45309)",border:"none",
              borderRadius:8,padding:"8px 20px",color:"#000",cursor:"pointer",fontSize:12,
              fontWeight:700,fontFamily:"inherit"}}>
              {tutorial.step>=TUTORIAL_STEPS.length-1?"Başla! 🚀":"Devam →"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ═══ ACHIEVEMENT POPUP ═══ */}
    {achievePopup&&(
      <div style={{position:"fixed",top:60,right:20,zIndex:150,
        background:"linear-gradient(135deg,rgba(20,10,40,.95),rgba(40,20,80,.9))",
        borderRadius:14,padding:"14px 20px",minWidth:260,
        border:"1px solid rgba(168,85,247,.3)",boxShadow:"0 12px 40px rgba(168,85,247,.2)",
        animation:"fadeIn .4s ease",display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:36,animation:"popBounce .5s ease"}}>{achievePopup.icon}</div>
        <div>
          <div style={{fontSize:9,color:"#a78bfa",fontWeight:700,letterSpacing:1}}>🏆 BAŞARIM!</div>
          <div style={{fontSize:14,fontWeight:800,color:"#e2e8f0"}}>{achievePopup.name}</div>
          <div style={{fontSize:10,color:"#8b5cf6"}}>{achievePopup.desc}</div>
        </div>
      </div>
    )}

    {/* ═══ TURN SUMMARY OVERLAY ═══ */}
    {turnSummary&&(
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:140,
        background:"linear-gradient(145deg,rgba(8,14,28,.95),rgba(12,20,38,.98))",
        borderRadius:16,padding:"20px 28px",minWidth:340,maxWidth:400,
        border:"1px solid rgba(255,255,255,.1)",boxShadow:"0 20px 60px rgba(0,0,0,.7)",
        animation:"fadeIn .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:10,color:"#64748b",fontWeight:700,letterSpacing:2}}>TUR {turnSummary.turn} ÖZET</div>
          <div style={{fontSize:18,fontWeight:900,color:"#fbbf24",marginTop:4}}>Harekat Raporu</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {[
            {label:"Petrol",val:`$${turnSummary.oilBefore}→$${turnSummary.oilAfter}`,
              color:turnSummary.oilAfter>turnSummary.oilBefore?"#ef4444":"#22c55e",icon:"⛽"},
            {label:"Konvoy Geçti",val:turnSummary.convoysPassed,color:"#38bdf8",icon:"🛢️"},
            {label:"Kayıpların",val:turnSummary.unitsLost,color:turnSummary.unitsLost>0?"#ef4444":"#22c55e",icon:"💀"},
            {label:"Düşman İmha",val:turnSummary.enemyKilled,color:"#f59e0b",icon:"💥"},
          ].map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px",
              display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>{s.icon}</span>
              <div>
                <div style={{fontSize:8,color:"#475569"}}>{s.label}</div>
                <div style={{fontSize:14,fontWeight:800,color:s.color}}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#64748b",
          padding:"8px 0",borderTop:"1px solid rgba(255,255,255,.06)"}}>
          <span>{WEATHER_TYPES[turnSummary.weather]?.icon} {WEATHER_TYPES[turnSummary.weather]?.name}</span>
          <span>🟢 {turnSummary.yourUnits} vs 🔴 {turnSummary.enemyUnits}</span>
        </div>
        <button onClick={()=>setTurnSummary(null)} style={{
          width:"100%",background:"linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02))",
          border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px",
          color:"#94a3b8",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",marginTop:4}}>
          Devam Et →
        </button>
      </div>
    )}

    {/* Achievement bar (bottom-left) */}
    {achievements.length>0&&(
      <div style={{position:"fixed",bottom:8,left:230,display:"flex",gap:4,zIndex:5}}>
        {achievements.slice(-6).map(aId=>{
          const a=ACHIEVE_DEFS.find(d=>d.id===aId);
          return a?<div key={aId} title={`${a.name}: ${a.desc}`} style={{
            width:28,height:28,borderRadius:6,background:"rgba(168,85,247,.15)",
            border:"1px solid rgba(168,85,247,.3)",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,cursor:"default"}}>{a.icon}</div>:null;
        })}
      </div>
    )}

    <style>{`@keyframes slideD{from{transform:translateY(-100%)}to{transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes popBounce{0%{transform:scale(0)}50%{transform:scale(1.3)}100%{transform:scale(1)}}button:active{transform:scale(.97)}*{box-sizing:border-box}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}`}</style>
  </div>);
}
