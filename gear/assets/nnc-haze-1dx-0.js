(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,110,0],theta:0.72,phi:0.9,radius:760},front:{target:[75,90,42],theta:1.57,phi:1.3,radius:480},rear:{target:[0,100,-100],theta:3.14,phi:1.1,radius:580,min:180}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.15;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#101114',fg:'#d9dde0',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=150,H=223,D=278;
  const body=new T.Group();body.add(at(E.rounded(W,178,D,5,M.black),0,93,0));for(const sx of [-1,1])for(const sz of [-1,1])body.add(at(bx(16,8,22,M.rubber),sx*56,3,sz*115));
  for(const z of [-55,55])body.add(at(E.rounded(10,35,12,3,M.black),0,199,z));body.add(at(E.rounded(13,9,122,4,M.rubber),0,219,0));
  for(const z of [-D/2+10,D/2-10])for(const y of [17,169]){const screw=at(cy(2.4,2.4,2,M.silver,12),W/2+1,y,z);screw.rotation.z=Math.PI/2;body.add(screw);}E.addPart('haze.body',body,root3);
  const tank=new T.Group();tank.add(at(E.rounded(60,135,105,7,new T.MeshStandardMaterial({color:0xe3e0cb,roughness:.6})),0,0,0));tank.add(at(cy(16,16,14,M.black,32),0,75,0));tank.add(at(cy(9,9,3,M.rubber,24),0,84,0));for(let i=0;i<12;i++){const a=i*Math.PI/6;tank.add(at(bx(2,11,2,M.soft),Math.cos(a)*16,75,Math.sin(a)*16));}const path=new T.CatmullRomCurve3([new T.Vector3(0,85,0),new T.Vector3(0,103,14),new T.Vector3(0,102,50),new T.Vector3(0,70,65)]);tank.add(new T.Mesh(new T.TubeGeometry(path,24,1.8,8,false),new T.MeshStandardMaterial({color:0xc2c8b5,transparent:true,opacity:.7})));E.addPart('haze.tank',at(tank,0,106,-90),root3);
  const nz=new T.Group();nz.add(at(E.rounded(3,78,74,3,M.rubber),0,0,0));nz.add(at(bx(2,62,60,M.black),2,0,0));for(let i=0;i<6;i++)nz.add(at(bx(2,2,58,M.soft),4,-25+i*10,0));E.addPart('haze.nozzle',at(nz,W/2+2,78,42),root3);
  NNCProduct.faceLabel(E,body,'HURRICANE\nHAZE 1DX',80,24,W/2+3,95,-66,{side:true,fg:'#d3d6d9'});
  const dp=new T.Group();dp.add(at(bx(50,22,4,M.black),0,0,0));dp.add(at(E.label('A001',40,14,{w:160,h:56,bg:'#200a0a',fg:'#ff5a3c',font:'700 36px ui-monospace'}),0,0,3));for(let i=0;i<4;i++)dp.add(at(bx(7,4,3,M.rubber),i*12-18,-20,2));E.addPart('haze.ctl.display',at(dp,0,145,-D/2-3),root3);dp.rotation.y=Math.PI;
  const z=-D/2-4;
  const dmx=new T.Group();for(const x of [-18,18]){dmx.add(alongZ(at(cy(10,10,10,M.silver,24),x,0,0)));for(const a of [0,1,2])dmx.add(alongZ(at(cy(2,2,10,M.black,8),x+Math.cos(a*2.1+1.57)*4.5,Math.sin(a*2.1+1.57)*4.5,-6)))}dmx.add(rear(at(lab('DMX IN   OUT',60,9),0,-20,-1)));E.addPart('haze.io.dmx',at(dmx,-20,82,z),root3);
  const pw=new T.Group();pw.add(at(bx(30,22,8,M.black),0,0,0));pw.add(at(bx(22,15,3,M.silver),0,0,-5));pw.add(rear(at(lab('120 V  303 W',60,9),0,-20,-1)));E.addPart('haze.io.power',at(pw,40,42,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1200,1200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'haze-1dx');
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=NNCWorkbench.mount(new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nDMX      1 channel · 3-pin\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent='1 ch DMX'},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}}));
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
