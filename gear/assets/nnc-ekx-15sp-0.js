(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,230,0],theta:0.72,phi:0.9,radius:1450},front:{target:[0,230,120],theta:0,phi:1.0,radius:1200},rear:{target:[0,230,-200],theta:3.14,phi:1.1,radius:1000},panel:{target:[0,240,-276],theta:3.14,phi:1.35,radius:560,min:200},xray:{target:[0,230,0],theta:0.5,phi:0.95,radius:1400}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.12;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=530,H=455,D=551;
  const coat=mat(0x1d1f22,.9,.02),grilleM=mat(0x14171a,.6,.35);
  const cab=new T.Group();const shell=at(E.rounded(W,H,D,6,coat),0,H/2,0);cab.add(shell);refs.shell=shell;
  cab.add(at(E.rounded(W-50,H-50,8,4,grilleM),0,H/2,D/2-1));
  for(const sx of [-1,1])cab.add(at(bx(14,60,130,M.silver),sx*(W/2+1),H*.6,20));
  cab.add(at(E.rounded(260,230,10,8,M.black),0,240,-D/2-1));
  E.addPart('ekx.cabinet',cab,root3);
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const drv=new T.Group();drv.add(alongZ(at(cy(190,190,26,M.soft,48),0,0,0)));drv.add(alongZ(at(cy(170,110,80,M.dark,48),0,0,-50)));drv.add(alongZ(at(cy(55,55,30,M.rubber,24),0,0,6)));E.addPart('ekx.driver',at(drv,0,H/2,D/2-50),root3);
  E.addPart('ekx.pole',at(cy(24,24,8,M.silver,24),0,H+3,0),root3);
  const z=-D/2-8;
  const combo=(x,y,g)=>{g.add(alongZ(at(cy(15,15,10,M.black,24),x,y,0)));g.add(alongZ(at(cy(8,8,12,M.rubber,16),x,y,-2)));for(const a of [0,1,2])g.add(alongZ(at(cy(2,2,13,M.silver,8),x+Math.cos(a*2.1+1.57)*5.5,y+Math.sin(a*2.1+1.57)*5.5,-3)))};
  const xlrM=(x,y,g)=>{g.add(alongZ(at(cy(13,13,10,M.silver,24),x,y,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2.5,2.5,10,M.black,8),x+Math.cos(a*2.1+1.57)*5.5,y+Math.sin(a*2.1+1.57)*5.5,-6)))};
  const inp=new T.Group();combo(-30,0,inp);combo(30,0,inp);inp.add(rear(at(lab('INPUT 1   INPUT 2',80,9),0,-26,-1)));E.addPart('ekx.io.inputs',at(inp,-60,300,z),root3);
  const lnk=new T.Group();xlrM(-30,0,lnk);xlrM(30,0,lnk);lnk.add(rear(at(lab('LINK 1   LINK 2',80,9),0,-24,-1)));E.addPart('ekx.io.link',at(lnk,-60,230,z),root3);
  const dsp=new T.Group();dsp.add(at(bx(90,46,4,M.black),0,0,0));dsp.add(rear(at(E.label('EKX  SUB\nLPF 100 Hz',80,36,{w:320,h:144,bg:'#0d1b2a',fg:'#8ad0ff',font:'600 30px ui-monospace'}),0,0,-3)));for(const x of [-28,0,28])dsp.add(alongZ(at(cy(7,7,6,M.silver,16),x,-40,-2)));E.addPart('ekx.ctl.dsp',at(dsp,70,300,z),root3);
  const pw=new T.Group();pw.add(at(bx(34,26,8,M.black),0,0,0));pw.add(at(bx(26,18,3,M.silver),0,0,-5));pw.add(at(bx(18,24,8,M.red),44,0,0));pw.add(rear(at(lab('MAINS IN   POWER',70,9),22,-24,-1)));E.addPart('ekx.io.power',at(pw,50,170,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(2600,2600),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'ekx-15sp');
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
