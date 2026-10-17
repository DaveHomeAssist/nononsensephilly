(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,45,0],theta:0.72,phi:0.95,radius:1150},front:{target:[0,45,100],theta:0,phi:1.2,radius:760,min:260},rear:{target:[0,45,-100],theta:3.14,phi:1.2,radius:760,min:260},xray:{target:[0,45,0],theta:0.5,phi:0.9,radius:1100}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.1;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=483,H=89,D=257;
  const shell=at(E.rounded(W,H,D,4,M.black),0,H/2,0);root3.add(shell);refs.shell=shell;
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const chassis=new T.Group();chassis.add(at(bx(W,H-4,2,M.dark),0,H/2,D/2+1));for(const sx of [-1,1])chassis.add(at(bx(18,H,3,M.black),sx*(W/2+9-1),H/2,D/2+1));
  const toroid=alongX(at(cy(36,36,60,M.silver,32),-120,H/2,-20));const sink=at(bx(140,70,120,M.silver),80,H/2,-20);chassis.add(toroid,sink);
  for(const sx of [-1,1])for(const sy of [-1,1])chassis.add(alongZ(at(cy(4,4,4,M.silver,12),sx*(W/2+1),H/2+sy*30,D/2+2)));
  E.addPart('gx5.chassis',chassis,root3);
  const fz=D/2+3;
  const knob=(id,x,txt)=>{const g=new T.Group();g.add(alongZ(at(cy(13,13,12,M.rubber,28),0,0,0)));g.add(at(bx(2,10,3,M.white),0,6,7));g.add(at(lab(txt,40,8),0,-22,0));E.addPart(id,at(g,x,H/2+6,fz),root3)};
  knob('gx5.ctl.gain1',-150,'CH 1');knob('gx5.ctl.gain2',150,'CH 2');
  const leds=new T.Group();for(const [i,m] of [[0,M.green],[1,M.red],[2,M.green],[3,M.red]])leds.add(alongZ(at(cy(2.5,2.5,3,m,10),-40+i*26,10,0)));leds.add(alongZ(at(cy(3,3,3,new T.MeshStandardMaterial({color:0x3b7cff,emissive:0x1b3c8f,emissiveIntensity:.6}),10),60,10,0)));leds.add(at(lab('SIG  CLIP  SIG  CLIP   PWR',120,8),10,-8,0));E.addPart('gx5.ctl.leds',at(leds,0,H/2,fz),root3);
  const sw=new T.Group();sw.add(at(bx(22,16,6,M.black),0,0,0));sw.add(at(bx(8,10,4,M.silver),0,0,5));sw.add(at(lab('AC POWER',40,8),0,-18,0));E.addPart('gx5.ctl.power',at(sw,210,H/2+6,fz),root3);
  const rz=-D/2-3;
  const chIn=(x)=>{const g=new T.Group();g.add(alongZ(at(cy(13,13,10,M.silver,24),0,0,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2.5,2.5,10,M.black,8),Math.cos(a*2.1+1.57)*5.5,Math.sin(a*2.1+1.57)*5.5,-6)));g.add(alongZ(at(cy(6,6,10,M.black,16),34,0,0)));g.position.x=x;return g};
  const ins=new T.Group();ins.add(chIn(-170));ins.add(chIn(-80));ins.add(rear(at(lab('CH 1 IN      CH 2 IN',130,9),-115,-24,-1)));E.addPart('gx5.io.xlr',at(ins,0,H/2+6,rz),root3);
  const rca=new T.Group();for(const [i,m] of [[0,M.white],[1,M.red],[2,M.white],[3,M.red]])rca.add(alongZ(at(cy(4,4,10,m,14),i*14-21,0,0)));rca.add(rear(at(lab('PHONO IN',50,8),0,-16,-1)));E.addPart('gx5.io.rca',at(rca,-115,H/2+30,rz),root3);
  const spk=new T.Group();for(const x of [0,60]){spk.add(alongZ(at(cy(14,14,10,M.black,24),x,0,0)));spk.add(alongZ(at(cy(8,8,12,M.rubber,16),x,0,-2)))}spk.add(rear(at(lab('CH 1 OUT  CH 2 OUT',110,9),30,-26,-1)));E.addPart('gx5.io.speakon',at(spk,120,H/2+4,rz),root3);
  const posts=new T.Group();for(const [i,m] of [[0,M.red],[1,M.black],[2,M.red],[3,M.black]])posts.add(alongZ(at(cy(5,5,14,m,12),i*20-30,0,0)));E.addPart('gx5.io.binding',at(posts,30,H/2+10,rz),root3);
  const xo=new T.Group();xo.add(at(bx(14,22,6,M.black),0,0,0));const xoKnob=at(bx(10,8,4,M.silver),0,6,-4);xo.add(xoKnob);refs.xo=xoKnob;xo.add(rear(at(lab('FULL RANGE\nCROSSOVER',46,16),0,-24,-1)));E.addPart('gx5.ctl.crossover',at(xo,-20,H/2+8,rz),root3);
  const ac=new T.Group();ac.add(at(bx(30,22,8,M.black),0,0,0));ac.add(at(bx(22,15,3,M.silver),0,0,-5));ac.add(alongZ(at(cy(5,5,8,M.black,12),28,0,0)));ac.add(rear(at(lab('AC IN   BREAKER',60,8),14,-20,-1)));E.addPart('gx5.io.ac',at(ac,205,H/2+2,rz),root3);
  const fan=new T.Group();fan.add(at(bx(70,70,4,M.rubber),0,0,0));fan.add(alongZ(at(cy(30,30,3,M.dark,24),0,0,-2)));E.addPart('gx5.fan',at(fan,-220+22,H/2,rz+1),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
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
E.setView('overview');})();
