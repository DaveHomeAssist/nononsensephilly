(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,60,0],theta:0.62,phi:0.78,radius:1250},top:{target:[0,60,0],theta:0.15,phi:0.35,radius:1000},rear:{target:[0,60,-100],theta:3.14,phi:1.15,radius:850,min:240},front:{target:[0,40,120],theta:0,phi:1.2,radius:800,min:240}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.08;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=329,H=118,D=453;
  const body=new T.Group();const shell=at(E.rounded(W,H-4,D,10,M.black),0,(H-4)/2,0);body.add(shell);refs.shell=shell;
  body.add(at(E.rounded(W-6,4,D-6,1,M.black),0,H-2,0)); // aluminium top plate
  body.add(at(bx(W-20,8,D-20,M.rubber),0,2,0));
  E.addPart('cdj.body',body,root3);
  const ghost=new T.Mesh(shell.geometry,new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.copy(shell.position);ghost.visible=false;body.add(ghost);refs.ghost=ghost;
  const top=H+1;
  const jog=new T.Group();jog.add(at(cy(103,103,10,M.rubber,64),0,0,0));jog.add(at(cy(96,96,4,M.black,64),0,7,0));jog.add(at(cy(40,40,6,M.glass,48),0,9,0));jog.add(faceUp(at(E.label('03:12',60,30,{w:240,h:120,bg:'#0b1220',fg:'#9fd2ff',font:'700 60px ui-monospace'}),0,13,0)));E.addPart('cdj.jog',at(jog,20,top,70),root3);
  const scr=new T.Group();scr.add(at(bx(200,4,112,M.black),0,0,0));scr.add(faceUp(at(E.label('CDJ-3000   LIBRARY\n▂▃▅▆▅▃▂▃▅▇▅▃▂',190,100,{w:760,h:400,bg:'#0d1626',fg:'#7fd4ff',font:'600 44px ui-monospace'}),0,3,0)));E.addPart('cdj.screen',at(scr,10,top,-150),root3);
  const hc=new T.Group();for(let i=0;i<8;i++)hc.add(at(bx(18,6,14,[M.red,M.amber,M.green,M.glass][i%4]),i*25-88,0,0));hc.add(faceUp(at(lab('HOT CUE  A – H',120,8),0,4,20)));E.addPart('cdj.hotcues',at(hc,10,top,-72),root3);
  const tr=new T.Group();for(const [z,colour] of [[0,0x43cb7b],[-40,0xe6b94c]]){tr.add(at(cy(16,16,6,M.black,32),0,0,z));const ring=new T.Mesh(new T.TorusGeometry(14.5,.8,8,48),new T.MeshBasicMaterial({color:colour}));ring.rotation.x=-Math.PI/2;tr.add(at(ring,0,3.2,z));}tr.add(at(bx(12,6,110,M.rubber),270,0,-30));tr.add(at(bx(16,8,10,M.silver),270,4,-10));E.addPart('cdj.transport',at(tr,-130,top,150),root3);
  const sd=new T.Group();sd.add(at(bx(34,5,6,M.rubber),0,0,0));sd.add(at(lab('SD',30,8),0,-12,0));E.addPart('cdj.media.sd',at(sd,-110,30,D/2+1),root3);
  const usb=new T.Group();usb.add(at(bx(40,10,30,M.silver),0,0,0));usb.add(at(bx(14,6,8,M.rubber),0,0,8));usb.add(faceUp(at(lab('USB',30,8),0,6,24)));E.addPart('cdj.media.usb',at(usb,-120,top,-190),root3);
  const rz=-D/2-4,ry=45;
  const rcaPair=(id,x,txt)=>{const g=new T.Group();g.add(alongZ(at(cy(5,5,10,M.white,14),-9,0,0)));g.add(alongZ(at(cy(5,5,10,M.red,14),9,0,0)));g.add(rear(at(lab(txt,50,8),0,-16,-1)));E.addPart(id,at(g,x,ry,rz),root3)};
  rcaPair('cdj.io.audio',-100,'AUDIO OUT');
  const dig=new T.Group();dig.add(alongZ(at(cy(5,5,10,M.amber,14),0,0,0)));dig.add(rear(at(lab('DIGITAL OUT',50,8),0,-16,-1)));E.addPart('cdj.io.digital',at(dig,-45,ry,rz),root3);
  const lan=new T.Group();lan.add(at(bx(18,14,8,M.black),0,0,0));lan.add(at(bx(12,6,2,M.silver),0,-3,-5));lan.add(rear(at(lab('LINK',30,8),0,-16,-1)));E.addPart('cdj.io.link',at(lan,10,ry,rz),root3);
  const ub=new T.Group();ub.add(at(bx(12,11,8,M.black),0,0,0));ub.add(at(bx(8,7,2,M.silver),0,0,-5));ub.add(rear(at(lab('USB',30,8),0,-16,-1)));E.addPart('cdj.io.usbb',at(ub,45,ry,rz),root3);
  const ac=new T.Group();ac.add(at(bx(30,22,8,M.black),0,0,0));ac.add(at(bx(22,15,3,M.silver),0,0,-5));ac.add(at(bx(16,20,8,M.red),36,0,0));ac.add(rear(at(lab('AC IN   POWER',60,8),16,-20,-1)));E.addPart('cdj.io.ac',at(ac,100,ry,rz),root3);
  const kl=new T.Group();kl.add(at(bx(8,4,4,M.rubber),0,0,0));E.addPart('cdj.io.kensington',at(kl,145,ry-10,rz),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'cdj-3000');
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
