(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,70,0],theta:0.62,phi:0.8,radius:1800},top:{target:[0,70,0],theta:0.08,phi:0.3,radius:1450},rear:{target:[0,55,-100],theta:3.14,phi:1.15,radius:1300,min:300},front:{target:[0,40,120],theta:0,phi:1.25,radius:1100,min:300}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.06;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=728,H=104,D=497;
  const body=new T.Group();const shell=at(E.rounded(W,H-6,D,10,M.black),0,(H-6)/2,0);body.add(shell);refs.shell=shell;body.add(at(E.rounded(W-6,6,D-6,8,M.dark),0,H-3,0));E.addPart('p4.body',body,root3);
  const top=H+1;
  const scr=new T.Group();const panel=at(bx(250,6,150,M.black),0,0,0);panel.rotation.x=-.5;scr.add(panel);const face=at(E.label('PRIME 4   LIBRARY\n▂▃▅▆▅▃▂▃▅▇▅▃▂  ▂▃▅▆▅▃▂',236,138,{w:944,h:552,bg:'#0d1626',fg:'#7fd4ff',font:'600 48px ui-monospace'}),0,4,-1);face.rotation.x=-.5-Math.PI/2;scr.add(face);scr.add(at(cy(12,12,10,M.rubber,24),160,0,30));E.addPart('p4.screen',at(scr,0,top+40,-140),root3);
  const jog=(id,x)=>{const g=new T.Group();g.add(at(cy(78,78,10,M.rubber,64),0,0,0));g.add(at(cy(70,70,4,M.black,64),0,7,0));g.add(at(cy(32,32,6,M.glass,48),0,9,0));E.addPart(id,at(g,x,top,40),root3)};
  jog('p4.jog.left',-245);jog('p4.jog.right',245);
  const mx=new T.Group();for(let i=0;i<4;i++){const x=i*48-72;for(let k=0;k<4;k++)mx.add(at(cy(7,7,8,M.rubber,18),x,0,-70+k*36));mx.add(at(bx(8,2,80,M.rubber),x,0,110));mx.add(at(bx(14,8,10,M.silver),x,3,120-i*8))}mx.add(at(bx(80,2,10,M.rubber),0,0,180));mx.add(at(bx(10,8,16,M.silver),-6,3,180));E.addPart('p4.mixer',at(mx,0,top,0),root3);
  const med=new T.Group();for(const x of [0,60]){med.add(at(bx(40,10,30,M.silver),x,0,0));med.add(at(bx(14,6,8,M.rubber),x,0,8))}med.add(at(bx(34,5,30,M.silver),130,0,0));med.add(faceUp(at(lab('USB 1   USB 2    SD',110,8),60,6,24)));E.addPart('p4.media.top',at(med,-300,top,-210),root3);
  const fz=D/2+4;
  const ph=new T.Group();ph.add(alongZ(at(cy(6,6,10,M.black,16),0,0,0)));ph.add(alongZ(at(cy(3.5,3.5,10,M.black,12),18,0,0)));ph.add(at(lab('PHONES',40,8),8,-16,0));E.addPart('p4.front.phones',at(ph,-300,45,fz),root3);
  const sel=new T.Group();for(let i=0;i<4;i++)sel.add(at(bx(8,14,4,M.silver),i*40,0,0));sel.add(at(cy(8,8,8,M.rubber,16),200,0,0));sel.add(at(lab('ENGINE / LINE   FADER START   CONTOUR',200,8),100,-18,0));E.addPart('p4.front.selectors',at(sel,-60,45,fz),root3);
  const rz=-D/2-4,ry=50;
  const xlr=(x,y,g)=>{g.add(alongZ(at(cy(10,10,10,M.silver,24),x,y,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2,2,10,M.black,8),x+Math.cos(a*2.1+1.57)*4.5,y+Math.sin(a*2.1+1.57)*4.5,-6)))};
  const rcaP=(x,y,g,m1=M.white,m2=M.red)=>{g.add(alongZ(at(cy(4,4,10,m1,12),x-7,y,0)));g.add(alongZ(at(cy(4,4,10,m2,12),x+7,y,0)))};
  const pw=new T.Group();pw.add(at(bx(30,22,8,M.black),0,0,0));pw.add(at(bx(22,15,3,M.silver),0,0,-5));pw.add(alongZ(at(cy(7,7,8,M.rubber,16),36,0,0)));pw.add(rear(at(lab('POWER',40,8),16,-20,-1)));E.addPart('p4.io.power',at(pw,-320,ry,rz),root3);
  const u34=new T.Group();for(let i=0;i<2;i++)u34.add(at(bx(12,10,8,M.black),i*18,0,0));u34.add(rear(at(lab('USB 3  4',40,8),9,-16,-1)));E.addPart('p4.io.usb34',at(u34,-255,ry,rz),root3);
  const ub=new T.Group();ub.add(at(bx(12,11,8,M.black),0,0,0));ub.add(rear(at(lab('USB B',30,8),0,-16,-1)));E.addPart('p4.io.usbb',at(ub,-210,ry,rz),root3);
  const lk=new T.Group();lk.add(at(bx(18,14,8,M.black),0,0,0));lk.add(rear(at(lab('LINK',30,8),0,-16,-1)));E.addPart('p4.io.link',at(lk,-175,ry,rz),root3);
  const zn=new T.Group();xlr(-14,0,zn);xlr(14,0,zn);zn.add(rear(at(lab('ZONE',40,8),0,-18,-1)));E.addPart('p4.io.zone',at(zn,-120,ry,rz),root3);
  const bo=new T.Group();xlr(-14,0,bo);xlr(14,0,bo);bo.add(rear(at(lab('BOOTH',40,8),0,-18,-1)));E.addPart('p4.io.booth',at(bo,-60,ry,rz),root3);
  const ms=new T.Group();xlr(-14,0,ms);xlr(14,0,ms);rcaP(48,0,ms);ms.add(at(bx(6,12,6,M.silver),72,0,0));ms.add(rear(at(lab('MASTER XLR   RCA   ST/MONO',110,8),30,-18,-1)));E.addPart('p4.io.master',at(ms,20,ry,rz),root3);
  const li=new T.Group();for(let i=0;i<4;i++)rcaP(i*26-39,0,li);li.add(at(bx(6,12,6,M.silver),70,0,0));li.add(alongZ(at(cy(3,3,8,M.silver,10),86,0,0)));li.add(rear(at(lab('LINE   LINE/PHONO   GND',110,8),20,-16,-1)));E.addPart('p4.io.line',at(li,160,ry,rz),root3);
  const mc=new T.Group();xlr(0,0,mc);xlr(30,0,mc);mc.add(rear(at(lab('MIC 1   MIC 2',60,8),15,-18,-1)));E.addPart('p4.io.mic',at(mc,290,ry,rz),root3);
  E.addPart('p4.io.kensington',at(bx(8,4,4,M.rubber),340,ry-14,rz),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
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
