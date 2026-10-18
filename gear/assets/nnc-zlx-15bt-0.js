(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,340,0],theta:0.72,phi:0.86,radius:1600},front:{target:[0,340,120],theta:0,phi:1.0,radius:1300},rear:{target:[0,330,-190],theta:3.14,phi:1.1,radius:1100},panel:{target:[0,330,-191],theta:3.14,phi:1.35,radius:560,min:200},xray:{target:[0,340,0],theta:0.5,phi:0.95,radius:1500}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.12;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=426,H=685,D=383;
  const poly=mat(0x1b1d1f,.75,.05),grilleM=mat(0x14171a,.6,.35);
  const cab=new T.Group();
  const shell=at(E.rounded(W,H,D,22,poly),0,H/2,0);cab.add(shell);refs.shell=shell;
  cab.add(at(E.rounded(W-60,H-70,6,12,grilleM),0,H/2,D/2-1)); // steel grille
  for(const sx of [-1,1])cab.add(at(bx(16,60,120,M.rubber),sx*(W/2+1),H*.6,20)); // side handles
  cab.add(at(bx(130,18,60,M.rubber),0,H+8,-40)); // top handle
  cab.add(at(E.rounded(260,230,10,8,M.black),0,300,-D/2-1)); // rear panel recess
  cab.add(alongZ(at(cy(24,24,8,M.black,24),0,-2,0))); // pole cup (hidden underneath)
  E.addPart('zlx.cabinet',cab,root3);
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const woofer=new T.Group();woofer.add(alongZ(at(cy(190,190,20,M.soft,48),0,0,0)));woofer.add(alongZ(at(cy(170,110,80,M.dark,48),0,0,-50)));woofer.add(alongZ(at(cy(55,55,30,M.rubber,24),0,0,6)));E.addPart('zlx.woofer',at(woofer,0,250,D/2-40),root3);
  const horn=new T.Group();horn.add(at(bx(230,120,60,M.soft),0,0,0));horn.add(alongZ(at(cy(40,40,60,M.dark,24),0,0,-50)));E.addPart('zlx.horn',at(horn,0,540,D/2-50),root3);
  E.addPart('zlx.pole',alongZ(at(cy(20,20,30,M.silver,24),0,2,0)),root3);
  const z=-D/2-7;
  const lcd=new T.Group();lcd.add(at(bx(100,50,4,M.black),0,0,0));lcd.add(rear(at(E.label('ZLX  LIVE\nMASTER  0 dB',88,38,{w:352,h:152,bg:'#0d1b2a',fg:'#8ad0ff',font:'600 30px ui-monospace'}),0,0,-3)));for(const x of [-30,0,30])lcd.add(alongZ(at(cy(7,7,6,M.silver,16),x,-45,-2)));E.addPart('zlx.ctl.lcd',at(lcd,0,395,z),root3);
  const combo=(id,x,y,text)=>{const g=new T.Group();g.add(alongZ(at(cy(16,16,10,M.black,24),0,0,0)));g.add(alongZ(at(cy(9,9,12,M.rubber,16),0,0,-2)));for(const a of [0,1,2])g.add(alongZ(at(cy(2,2,13,M.silver,8),Math.cos(a*2.1+1.57)*6,Math.sin(a*2.1+1.57)*6,-3)));g.add(rear(at(lab(text,54,12),0,-26,-1)));E.addPart(id,at(g,x,y,z-3),root3)};
  combo('zlx.io.input1',-80,300,'INPUT 1');combo('zlx.io.input2',-80,230,'INPUT 2');
  const xlr=new T.Group();xlr.add(alongZ(at(cy(14,14,10,M.silver,24),0,0,0)));for(const a of [0,1,2])xlr.add(alongZ(at(cy(2.5,2.5,10,M.black,8),Math.cos(a*2.1+1.57)*5.5,Math.sin(a*2.1+1.57)*5.5,-6)));xlr.add(rear(at(lab('MIX OUT',54,12),0,-24,-1)));E.addPart('zlx.io.mixout',at(xlr,40,300,z-3),root3);
  const aux=new T.Group();aux.add(alongZ(at(cy(5,5,10,M.silver,16),0,0,0)));aux.add(rear(at(lab('AUX IN',40,10),0,-16,-1)));E.addPart('zlx.io.aux',at(aux,40,245,z-3),root3);
  const pw=new T.Group();pw.add(at(bx(34,26,8,M.black),0,0,0));pw.add(at(bx(26,18,3,M.silver),0,0,-5));pw.add(at(bx(18,24,8,M.red),40,0,0));pw.add(rear(at(lab('MAINS IN   POWER',70,10),20,-24,-1)));E.addPart('zlx.io.power',at(pw,-10,210,z-3),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(2600,2600),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'zlx-15bt');
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=NNCWorkbench.mount(new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nX-RAY    ${E.sim.xray?"on":"off"}\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent=`${E.sim.xray?'x-ray':'shell'}`},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}}));
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
