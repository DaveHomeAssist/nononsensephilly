(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,60,0],theta:0.62,phi:0.8,radius:2000},top:{target:[0,60,0],theta:0.08,phi:0.3,radius:1600},rear:{target:[0,60,-100],theta:3.14,phi:1.15,radius:1500,min:320},xray:{target:[0,60,0],theta:0.5,phi:0.9,radius:1900}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.06;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=878,H=118,D=466;
  const body=new T.Group();const shell=at(E.rounded(W,H-8,D,10,M.black),0,(H-8)/2,0);body.add(shell);refs.shell=shell;body.add(at(E.rounded(W-6,8,D-6,8,M.dark),0,H-4,0));for(const sx of [-1,1])body.add(at(bx(20,30,120,M.rubber),sx*(W/2+2),H*.55,0));E.addPart('xz.body',body,root3);
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const top=H+1;
  const jog=(id,x)=>{const g=new T.Group();g.add(at(cy(103,103,10,M.rubber,64),0,0,0));g.add(at(cy(95,95,4,M.black,64),0,7,0));g.add(at(cy(38,38,6,M.glass,48),0,9,0));g.add(faceUp(at(E.label('DECK',50,26,{w:200,h:104,bg:'#0b1220',fg:'#9fd2ff',font:'700 52px ui-monospace'}),0,13,0)));E.addPart(id,at(g,x,top,60),root3)};
  jog('xz.jog.left',-300);jog('xz.jog.right',300);
  const scr=new T.Group();scr.add(at(bx(160,4,95,M.black),0,0,0));scr.add(faceUp(at(E.label('XDJ-XZ  BROWSE\n▂▃▅▆▅▃▂▃▅▇▅▃▂',150,85,{w:600,h:340,bg:'#0d1626',fg:'#7fd4ff',font:'600 40px ui-monospace'}),0,3,0)));scr.add(at(cy(12,12,10,M.rubber,24),110,0,0));E.addPart('xz.screen',at(scr,0,top,-150),root3);
  const pads=new T.Group();for(const sx of [-1,1])for(let i=0;i<8;i++)pads.add(at(bx(24,6,20,[M.red,M.amber,M.green,M.glass][i%4]),sx*300+(i%4)*32-48,0,Math.floor(i/4)*26-10));E.addPart('xz.pads',at(pads,0,top,195),root3);
  const mx=new T.Group();for(let i=0;i<4;i++){const x=i*50-75;for(let k=0;k<4;k++)mx.add(at(cy(7,7,8,M.rubber,18),x,0,-120+k*40));mx.add(at(bx(8,2,80,M.rubber),x,0,80));mx.add(at(bx(14,8,10,M.silver),x,3,90-i*8))}mx.add(at(bx(80,2,10,M.rubber),0,0,150));mx.add(at(bx(10,8,16,M.silver),8,3,150));E.addPart('xz.mixer',at(mx,0,top,0),root3);
  const us=new T.Group();for(const x of [0,120]){us.add(at(bx(40,10,30,M.silver),x,0,0));us.add(at(bx(14,6,8,M.rubber),x,0,8))}us.add(faceUp(at(lab('USB 1       USB 2',120,8),60,6,24)));E.addPart('xz.media.usb',at(us,-120,top,-200),root3);
  const rz=-D/2-4,ry=50;
  const xlr=(x,y,g)=>{g.add(alongZ(at(cy(10,10,10,M.silver,24),x,y,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2,2,10,M.black,8),x+Math.cos(a*2.1+1.57)*4.5,y+Math.sin(a*2.1+1.57)*4.5,-6)))};
  const rcaP=(x,y,g,m1=M.white,m2=M.red)=>{g.add(alongZ(at(cy(4,4,10,m1,12),x-7,y,0)));g.add(alongZ(at(cy(4,4,10,m2,12),x+7,y,0)))};
  const ms=new T.Group();xlr(-16,0,ms);xlr(16,0,ms);rcaP(50,0,ms);ms.add(rear(at(lab('MASTER XLR   RCA',80,8),16,-18,-1)));E.addPart('xz.io.master',at(ms,-330,ry,rz),root3);
  const bo=new T.Group();bo.add(alongZ(at(cy(6,6,10,M.black,16),-10,0,0)));bo.add(alongZ(at(cy(6,6,10,M.black,16),10,0,0)));bo.add(rear(at(lab('BOOTH',40,8),0,-16,-1)));E.addPart('xz.io.booth',at(bo,-240,ry,rz),root3);
  const li=new T.Group();for(let i=0;i<2;i++)rcaP(i*30-15,0,li);li.add(alongZ(at(cy(3,3,8,M.silver,10),40,0,0)));li.add(rear(at(lab('CH3 / CH4 LINE-PHONO  GND',110,8),10,-16,-1)));E.addPart('xz.io.inputs',at(li,-120,ry,rz),root3);
  const mc=new T.Group();xlr(0,0,mc);mc.add(alongZ(at(cy(6,6,10,M.black,16),30,0,0)));mc.add(rear(at(lab('MIC 1    MIC 2',60,8),15,-18,-1)));E.addPart('xz.io.mic',at(mc,20,ry,rz),root3);
  const ub=new T.Group();ub.add(at(bx(12,11,8,M.black),0,0,0));ub.add(rear(at(lab('USB',30,8),0,-16,-1)));E.addPart('xz.io.usbb',at(ub,110,ry,rz),root3);
  const lk=new T.Group();lk.add(at(bx(18,14,8,M.black),0,0,0));lk.add(rear(at(lab('LINK',30,8),0,-16,-1)));E.addPart('xz.io.link',at(lk,160,ry,rz),root3);
  const ac=new T.Group();ac.add(at(bx(30,22,8,M.black),0,0,0));ac.add(at(bx(22,15,3,M.silver),0,0,-5));ac.add(at(bx(14,20,8,M.red),32,0,0));ac.add(rear(at(lab('AC IN  POWER',60,8),14,-20,-1)));E.addPart('xz.io.ac',at(ac,330,ry,rz),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(3200,3200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nX-RAY    ${E.sim.xray?"on":"off"}\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent=`${E.sim.xray?'x-ray':'shell'}`},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}});
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
