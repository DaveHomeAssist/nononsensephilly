(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,140,0],theta:0.72,phi:0.9,radius:900},front:{target:[0,150,100],theta:0,phi:1.0,radius:700},rear:{target:[0,100,-100],theta:3.14,phi:1.1,radius:650,min:200}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.15;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=290,H=272,D=345;
  const body=new T.Group();body.add(at(E.rounded(250,182,150,12,M.black),0,106,-75));
  for(const sx of [-1,1]){body.add(at(E.rounded(8,184,38,3,M.black),sx*130,179,-70));body.add(alongX(at(cy(17,17,16,M.rubber,32),sx*139,154,-70)));}body.add(at(E.rounded(268,8,38,3,M.black),0,267,-70));
  for(const sx of [-1,1])for(let i=0;i<8;i++)body.add(at(bx(3,38,10,M.rubber),sx*126,110,-110+i*13));
  // Rear badge faces -z (the rear face) and uses a font sized to the plane so it reads correctly from behind.
  body.add(rear(at(lab('ADJ\nVERTIGO TRI LED',140,35,{bg:'#101114',fg:'#d9dde0',font:'700 40px system-ui'}),0,122,-151)));E.addPart('vert.body',body,root3);
  const optical=(id,left)=>{const g=new T.Group();const geom=new T.SphereGeometry(137,48,24,left?-Math.PI/2:Math.PI/2,Math.PI,0,Math.PI/2);geom.rotateX(Math.PI/2);geom.scale(1,.87,.58);const m=mat(0x121b26,.2,.35);g.add(new T.Mesh(geom,m));
   for(let row=0;row<2;row++)for(let i=0;i<4;i++){const a=(left?Math.PI/2:-Math.PI/2)+.3+i*.84,r=62+row*43,x=Math.cos(a)*r,y=Math.sin(a)*r*.87;const pane=at(E.rounded(19,14,2,1,M.glass),x,y,Math.sqrt(Math.max(0,137*137-r*r))*.58+1);pane.lookAt(new T.Vector3(x*1.4,y*1.4,190));const colour=[0x356b94,0x2a4c86,0x407a96][(i+row)%3];pane.material=new T.MeshStandardMaterial({color:colour,emissive:colour,emissiveIntensity:.2,roughness:.12,metalness:.6});g.add(pane);}E.addPart(id,at(g,0,135,23),root3)};
  optical('vert.dome.left',true);optical('vert.dome.right',false);
  const rim=new T.Mesh(new T.TorusGeometry(137,3,8,96),M.black);rim.scale.y=.87;root3.add(at(rim,0,135,23));
  const z=-D/2+20-4;
  const iec=new T.Group();for(const x of [-30,30]){iec.add(at(bx(30,22,8,M.black),x,0,0));iec.add(at(bx(22,15,3,M.silver),x,0,-5))}iec.add(rear(at(lab('IEC IN     IEC OUT',80,9),0,-22,-1)));E.addPart('vert.io.iec',at(iec,-40,60,z),root3);
  const sd=new T.Group();sd.add(alongZ(at(cy(8,8,8,M.rubber,16),0,0,0)));sd.add(rear(at(lab('SOUND',40,9),0,-18,-1)));E.addPart('vert.ctl.sound',at(sd,80,60,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1300,1300),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'vertigo-tri-led');
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
