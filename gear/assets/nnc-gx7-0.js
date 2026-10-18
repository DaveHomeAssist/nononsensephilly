(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,45,0],theta:0.72,phi:0.95,radius:1150},front:{target:[0,45,100],theta:0,phi:1.2,radius:760,min:260},rear:{target:[0,45,-100],theta:3.14,phi:1.2,radius:760,min:260},xray:{target:[0,45,0],theta:0.5,phi:0.9,radius:1100}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.1;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=483,H=89,D=257;
  const shell=at(E.rounded(W,H,D,4,M.black),0,H/2,0);root3.add(shell);refs.shell=shell;
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const chassis=new T.Group();chassis.add(at(bx(W,H-4,2,M.dark),0,H/2,D/2+1));for(const sx of [-1,1])chassis.add(at(bx(18,H,3,M.black),sx*(W/2+9-1),H/2,D/2+1));
  // QSC specifies a PowerLight supply for GX7; the board layout is illustrative.
  const supply=new T.Group();supply.name='gx7-powerlight-supply';supply.add(at(bx(155,3,160,mat(0x244e3e)),0,0,0));supply.add(at(bx(44,36,40,mat(0x665528)),0,20,-18));for(const x of [-52,52])for(const z of [-47,47])supply.add(at(cy(13,13,36,M.black,24),x,20,z));for(let i=0;i<5;i++)supply.add(at(bx(5,35,110,M.silver),-45+i*22,20,0));chassis.add(at(supply,-110,9,-15));chassis.add(at(bx(140,65,120,M.silver),90,H/2,-20));
  for(const sx of [-1,1])for(const sy of [-1,1])chassis.add(alongZ(at(cy(4,4,4,M.silver,12),sx*(W/2+1),H/2+sy*30,D/2+2)));
  E.addPart('gx7.chassis',chassis,root3);
  const fz=D/2+7;
  const knob=(id,x,txt)=>{const g=new T.Group();const moving=new T.Group();moving.add(alongZ(at(cy(13,13,12,M.rubber,28),0,0,0)));moving.add(at(bx(2,10,3,M.white),0,6,7));g.add(moving);refs[id]=moving;g.add(at(lab(txt,40,8),0,-22,0));E.addPart(id,at(g,x,H/2+6,fz),root3)};
  knob('gx7.ctl.gain1',-52,'CH 1');knob('gx7.ctl.gain2',52,'CH 2');
  refs.signalLEDs=[];const leds=new T.Group();for(const [i,m] of [[0,M.green],[1,M.red],[2,M.green],[3,M.red]]){const dim=m.clone();dim.emissiveIntensity=0;const led=alongZ(at(cy(2.5,2.5,3,dim,10),-40+i*26,10,0));refs.signalLEDs.push(led);leds.add(led);}refs.powerLED=alongZ(at(cy(3,3,3,new T.MeshStandardMaterial({color:0x10203b,emissive:0x1b3c8f,emissiveIntensity:0}),10),60,10,0));leds.add(refs.powerLED);leds.add(at(lab('SIG  CLIP  SIG  CLIP   PWR',120,8),10,-8,0));E.addPart('gx7.ctl.leds',at(leds,0,H/2,fz),root3);
  const sw=new T.Group();sw.add(at(bx(22,16,6,M.black),0,0,0));refs.power=at(bx(8,10,4,M.silver),0,0,5);sw.add(refs.power);sw.add(at(lab('AC POWER',40,8),0,-18,0));E.addPart('gx7.ctl.power',at(sw,210,H/2+6,fz),root3);
  const rz=-D/2-3;
  const chIn=(x)=>{const g=new T.Group();g.add(alongZ(at(cy(13,13,10,M.silver,24),0,0,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2.5,2.5,10,M.black,8),Math.cos(a*2.1+1.57)*5.5,Math.sin(a*2.1+1.57)*5.5,-6)));g.add(alongZ(at(cy(6,6,10,M.black,16),34,0,0)));g.position.x=x;return g};
  const ins=new T.Group();ins.add(chIn(-170));ins.add(chIn(-80));ins.add(rear(at(lab('CH 1 IN      CH 2 IN',130,9),-115,-24,-1)));E.addPart('gx7.io.xlr',at(ins,0,H/2+6,rz),root3);
  const rca=new T.Group();for(const [i,m] of [[0,M.white],[1,M.red],[2,M.white],[3,M.red]])rca.add(alongZ(at(cy(4,4,10,m,14),i*14-21,0,0)));rca.add(rear(at(lab('PHONO IN',50,8),0,-16,-1)));E.addPart('gx7.io.rca',at(rca,-115,H/2+30,rz),root3);
  const spk=new T.Group();for(const x of [0,60]){spk.add(alongZ(at(cy(14,14,10,M.black,24),x,0,0)));spk.add(alongZ(at(cy(8,8,12,M.rubber,16),x,0,-2)))}spk.add(rear(at(lab('CH 1 OUT  CH 2 OUT',110,9),30,-26,-1)));E.addPart('gx7.io.speakon',at(spk,120,H/2+4,rz),root3);
  const posts=new T.Group();for(const [i,m] of [[0,M.red],[1,M.black],[2,M.red],[3,M.black]])posts.add(alongZ(at(cy(5,5,14,m,12),i*20-30,0,0)));E.addPart('gx7.io.binding',at(posts,30,H/2+10,rz),root3);
  const xo=new T.Group();xo.add(at(bx(14,22,6,M.black),0,0,0));const xoKnob=at(bx(10,8,4,M.silver),0,6,-4);xo.add(xoKnob);refs.xo=xoKnob;xo.add(rear(at(lab('FULL RANGE\nCROSSOVER',46,16),0,-24,-1)));E.addPart('gx7.ctl.crossover',at(xo,-20,H/2+8,rz),root3);
  const ac=new T.Group();ac.add(at(bx(30,22,8,M.black),0,0,0));ac.add(at(bx(22,15,3,M.silver),0,0,-5));ac.add(alongZ(at(cy(5,5,8,M.black,12),28,0,0)));ac.add(rear(at(lab('AC IN   BREAKER',60,8),14,-20,-1)));E.addPart('gx7.io.ac',at(ac,205,H/2+2,rz),root3);
  const fan=new T.Group();fan.add(at(bx(70,70,4,M.rubber),0,0,0));fan.add(alongZ(at(cy(30,30,3,M.dark,24),0,0,-2)));E.addPart('gx7.fan',at(fan,-220+22,H/2,rz+1),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'gx7');
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{"crossover": "full"});
const E=NNCWorkbench.mount(new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;
  case'crossover':E.sim.crossover=E.sim.crossover==='full'?'crossover':'full';E.sim.output=E.sim.crossover==='full'?'FULL RANGE: both channels independent; the switch bypasses the crossover.':'CROSSOVER: channel 1 input is split, 20–100 Hz to channel 1 (sub) and 100 Hz – 20 kHz to channel 2 (top). Channel 2 inputs are ignored.';break;
  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}
  if(refs.xo)refs.xo.position.y=E.sim.crossover==='full'?6:-6;
  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nX-RAY    ${E.sim.xray?"on":"off"}\nXOVER    ${E.sim.crossover.toUpperCase()}\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent=`${E.sim.crossover==='full'?'full range':'crossover 100 Hz'} · ${E.sim.xray?'x-ray':'shell'}`},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}}));
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.controls=NNCControls.mount(E,[
 ...[1,2].map(channel=>({id:'gx7.ctl.gain'+channel,component:'gx7.ctl.gain'+channel,source:'qsc-gx-manual',label:'Channel '+channel+' gain',kind:'knob',min:0,max:100,step:1,initial:0,object:refs['gx7.ctl.gain'+channel],apply(value){refs['gx7.ctl.gain'+channel].rotation.z=(135-value*2.7)*Math.PI/180;}})),
 {id:'gx7.ctl.power',component:'gx7.ctl.power',source:'qsc-gx-manual',label:'Power',kind:'switch',min:0,max:1,step:1,initial:0,object:refs.power,targets:[E.partObjects.get('gx7.ctl.power')],format:v=>v?'On':'Off',apply(value){refs.power.rotation.x=value?-.3:.3;refs.power.position.y=value?2:-2;const m=E.tinted.get(refs.powerLED)?.base||refs.powerLED.material;m.color.setHex(value?0x3b7cff:0x10203b);m.emissiveIntensity=value?.8:0;}},
 {id:'gx7.ctl.crossover',component:'gx7.ctl.crossover',source:'qsc-gx-manual',label:'Crossover',kind:'switch',min:0,max:1,step:1,initial:0,object:refs.xo,targets:[E.partObjects.get('gx7.ctl.crossover')],format:v=>v?'Crossover · 100 Hz':'Full range',read:e=>e.sim.crossover==='full'?0:1,sync:(v,e)=>{e.sim.crossover=v?'crossover':'full';},apply(value){refs.xo.position.y=value?-6:6;}}
],{view:'front',note:'QSC GX manual, pages 4–6. Gain shows approximate knob position, not calibrated dB. Power assumes simulated AC; startup transients are omitted. Signal/clip feedback uses relative demo thresholds, not measured watts or calibrated gain.',demo:{kind:'gx7',paint(e,levels){refs.signalLEDs.forEach((mesh,i)=>NNCControls.light(e,mesh,i%2?levels.channels[Math.floor(i/2)]>=1:levels.channels[Math.floor(i/2)]>0));}}});
E.setView('overview');})();
