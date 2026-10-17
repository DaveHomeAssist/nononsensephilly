(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,320,0],theta:0.72,phi:0.86,radius:1650},front:{target:[0,320,120],theta:0,phi:1.0,radius:1350},rear:{target:[0,320,-200],theta:3.14,phi:1.1,radius:1150},panel:{target:[0,330,-299],theta:3.14,phi:1.35,radius:620,min:220},xray:{target:[0,320,0],theta:0.5,phi:0.95,radius:1550}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.12;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=533,H=635,D=597;
  const carpet=mat(0x23262a,.95,0),grilleM=mat(0x14171a,.6,.35);
  const cab=new T.Group();const shell=at(E.rounded(W,H,D,14,carpet),0,H/2,0);cab.add(shell);refs.shell=shell;
  cab.add(at(E.rounded(W-50,H-60,8,10,grilleM),0,H/2,D/2-1));
  for(const sx of [-1,1])for(const sy of [0,1])for(const sz of [-1,1])cab.add(at(bx(40,40,40,M.black),sx*(W/2-18),sy?H-20:20,sz*(D/2-18)));
  cab.add(at(E.rounded(280,330,10,8,M.black),0,330,-D/2-1));
  E.addPart('cva.cabinet',cab,root3);
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const drv=new T.Group();drv.add(alongZ(at(cy(228,228,30,M.soft,48),0,0,0)));drv.add(alongZ(at(cy(205,140,95,M.dark,48),0,0,-60)));drv.add(alongZ(at(cy(70,70,40,M.rubber,32),0,0,8)));E.addPart('cva.driver',at(drv,0,H/2,D/2-60),root3);
  const hd=new T.Group();for(const sx of [-1,1])hd.add(at(bx(12,70,150,M.rubber),sx*(W/2+1),H*.62,0));hd.add(at(cy(22,22,6,M.silver,24),0,H+2,0));E.addPart('cva.handles',hd,root3);
  const z=-D/2-8;
  const xlrF=(x,y,g)=>{g.add(alongZ(at(cy(11,11,10,M.silver,24),x,y,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2,2,10,M.black,8),x+Math.cos(a*2.1+1.57)*5,y+Math.sin(a*2.1+1.57)*5,-6)))};
  const trs=(x,y,g)=>g.add(alongZ(at(cy(6,6,10,M.black,16),x,y,0)));
  const pw=new T.Group();pw.add(at(bx(34,26,8,M.black),0,0,0));pw.add(at(bx(26,18,3,M.silver),0,0,-5));pw.add(at(bx(18,24,8,M.red),44,0,0));pw.add(rear(at(lab('POWER IN   ON/OFF',70,9),22,-24,-1)));E.addPart('cva.io.power',at(pw,-60,210,z),root3);
  const inp=new T.Group();xlrF(-40,0,inp);trs(-10,0,inp);xlrF(40,0,inp);trs(70,0,inp);inp.add(rear(at(lab('IN L        IN R',100,9),15,-22,-1)));E.addPart('cva.io.input',at(inp,-40,455,z),root3);
  const th=new T.Group();xlrF(-15,0,th);trs(15,0,th);th.add(rear(at(lab('THRU',40,9),0,-22,-1)));E.addPart('cva.io.thru',at(th,-70,390,z),root3);
  const lk=new T.Group();xlrF(-15,0,lk);trs(15,0,lk);lk.add(at(bx(8,14,6,M.silver),40,0,0));lk.add(rear(at(lab('LINK OUT   M/S',70,9),12,-22,-1)));E.addPart('cva.io.link',at(lk,60,390,z),root3);
  const led=new T.Group();for(const [i,m] of [[0,M.green],[1,M.amber],[2,M.red],[3,M.green]])led.add(alongZ(at(cy(3,3,4,m,10),i*18-27,0,0)));led.add(rear(at(lab('PWR LIM PROT SIG',80,8),0,-14,-1)));E.addPart('cva.ctl.leds',at(led,-70,330,z),root3);
  const lv=new T.Group();lv.add(alongZ(at(cy(12,12,12,M.rubber,24),0,0,0)));lv.add(rear(at(lab('LEVEL',40,9),0,-22,-1)));E.addPart('cva.ctl.level',at(lv,60,330,z),root3);
  const hp=new T.Group();hp.add(alongZ(at(cy(9,9,10,M.rubber,20),0,0,0)));hp.add(rear(at(lab('HIGH PASS\n65 85 130 BYP',60,16),0,-26,-1)));E.addPart('cva.ctl.hpf',at(hp,-70,265,z),root3);
  const lp=new T.Group();lp.add(alongZ(at(cy(12,12,12,M.rubber,24),0,0,0)));lp.add(rear(at(lab('LOW PASS 65–130',70,9),0,-24,-1)));E.addPart('cva.ctl.lpf',at(lp,60,265,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(2600,2600),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
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
