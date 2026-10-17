(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,100,0],theta:0.72,phi:0.9,radius:760},front:{target:[0,110,100],theta:0,phi:1.0,radius:620},rear:{target:[0,90,-100],theta:3.14,phi:1.1,radius:600,min:180}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.15;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=281,H=182,D=287;
  const base=new T.Group();base.add(at(E.rounded(W,110,D-35,27,M.black),0,63,0));
  for(const sx of [-1,1]){base.add(at(E.rounded(8,105,30,3,M.black),sx*139,128,-30));base.add(alongX(at(cy(15,15,14,M.rubber,32),sx*148,112,-30)));}base.add(at(E.rounded(286,7,30,3,M.black),0,179,-30));
  for(const sx of [-1,1])for(let i=0;i<12;i++)base.add(at(bx(2,32,3,M.rubber),sx*138,65,-95+i*13));for(let i=0;i<17;i++)base.add(at(bx(3,1,12,M.rubber),i*12-96,119,-20));
  E.addPart('jsix.base',base,root3);
  const pod=(id,x)=>{const g=new T.Group();g.add(alongZ(at(cy(49,49,7,M.rubber,48),0,0,0)));g.add(alongZ(at(cy(43,43,8,M.silver,48),0,0,2)));const lens=new T.Mesh(new T.SphereGeometry(40,32,20,0,Math.PI*2,0,Math.PI/2),new T.MeshPhysicalMaterial({color:0xe4eaf0,roughness:.12,metalness:0,transparent:true,opacity:.4,depthWrite:false,clearcoat:1}));lens.rotation.x=Math.PI/2;lens.scale.y=.14;g.add(at(lens,0,0,6));for(const a of [0,1,2,3])NNCProduct.screw(g,Math.cos(a*Math.PI/2)*47,Math.sin(a*Math.PI/2)*47,5,1.5);E.addPart(id,at(g,x,62,D/2-15),root3)};
  pod('jsix.pod.left',-75);pod('jsix.pod.right',75);
  const z=-D/2-4;
  const pw=new T.Group();pw.add(alongZ(at(cy(6,6,30,M.black,12),0,0,-10)));pw.add(alongZ(at(cy(5,5,10,M.silver,10),30,0,0)));pw.add(at(bx(10,6,4,M.silver),30,-14,0));pw.add(rear(at(lab('POWER  FUSE  120/230',80,9),15,-26,-1)));E.addPart('jsix.io.power',at(pw,-60,55,z),root3);
  const lk=new T.Group();lk.add(at(bx(34,34,6,M.black),0,0,0));lk.add(at(bx(4,10,3,M.rubber),-7,3,-3));lk.add(at(bx(4,10,3,M.rubber),7,3,-3));lk.add(rear(at(lab('POWER LINK',50,9),0,-26,-1)));E.addPart('jsix.io.link',at(lk,40,55,z),root3);
  const sd=new T.Group();sd.add(alongZ(at(cy(8,8,8,M.rubber,16),0,0,0)));sd.add(rear(at(lab('SOUND',40,9),0,-18,-1)));E.addPart('jsix.ctl.sound',at(sd,100,55,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1200,1200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'j-six');
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=NNCWorkbench.mount(new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nMODE     sound-active\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent='sound-active'},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}}));
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
