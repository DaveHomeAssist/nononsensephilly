(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,100,0],theta:0.72,phi:0.9,radius:760},front:{target:[0,110,100],theta:0,phi:1.0,radius:620},rear:{target:[0,90,-100],theta:3.14,phi:1.1,radius:600,min:180}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.15;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=281,H=182,D=287;
  const base=new T.Group();base.add(at(E.rounded(W,40,D,8,M.black),0,20,0));base.add(at(bx(W-40,60,D-80,M.dark),0,70,0));const br=at(bx(W+20,8,30,M.silver),0,H+4,-40);base.add(br);for(const sx of [-1,1])base.add(at(bx(8,H,30,M.silver),sx*(W/2+6),H/2,-40));E.addPart('jsix.base',base,root3);
  const pod=(id,x)=>{const g=new T.Group();g.add(at(cy(60,60,70,M.black,32),0,0,0));const lens=at(cy(54,54,10,M.glass,32),0,40,0);g.add(lens);for(let i=0;i<10;i++){const a=i*Math.PI*2/10;g.add(at(cy(5,5,4,[M.red,M.green,M.amber][i%3],10),Math.cos(a)*38,46,Math.sin(a)*38))}g.rotation.z=x<0?.35:-.35;E.addPart(id,at(g,x,130,0),root3)};
  pod('jsix.pod.left',-80);pod('jsix.pod.right',80);
  const z=-D/2-4;
  const pw=new T.Group();pw.add(alongZ(at(cy(6,6,30,M.black,12),0,0,-10)));pw.add(alongZ(at(cy(5,5,10,M.silver,10),30,0,0)));pw.add(at(bx(10,6,4,M.silver),30,-14,0));pw.add(rear(at(lab('POWER  FUSE  120/230',80,9),15,-26,-1)));E.addPart('jsix.io.power',at(pw,-60,55,z),root3);
  const lk=new T.Group();lk.add(at(bx(34,34,6,M.black),0,0,0));lk.add(at(bx(4,10,3,M.rubber),-7,3,-3));lk.add(at(bx(4,10,3,M.rubber),7,3,-3));lk.add(rear(at(lab('POWER LINK',50,9),0,-26,-1)));E.addPart('jsix.io.link',at(lk,40,55,z),root3);
  const sd=new T.Group();sd.add(alongZ(at(cy(8,8,8,M.rubber,16),0,0,0)));sd.add(rear(at(lab('SOUND',40,9),0,-18,-1)));E.addPart('jsix.ctl.sound',at(sd,100,55,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1200,1200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
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
