(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,110,0],theta:0.72,phi:0.9,radius:760},front:{target:[0,120,100],theta:0,phi:1.0,radius:600},rear:{target:[0,100,-100],theta:3.14,phi:1.1,radius:580,min:180}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.15;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=150,H=223,D=278;
  const body=new T.Group();body.add(at(E.rounded(W,H-60,D,8,M.black),0,(H-60)/2,0));body.add(at(bx(W-20,8,D-20,M.rubber),0,2,0));E.addPart('haze.body',body,root3);
  const tank=new T.Group();tank.add(at(E.rounded(W-16,58,D-40,8,new T.MeshStandardMaterial({color:0xcfe3ea,roughness:.3,metalness:.05,transparent:true,opacity:.75})),0,0,-10));tank.add(at(cy(14,14,12,M.black,20),-40,34,-80));E.addPart('haze.tank',at(tank,0,H-32,0),root3);
  const nz=new T.Group();nz.add(alongZ(at(cy(22,22,20,M.silver,24),0,0,0)));nz.add(alongZ(at(cy(16,16,22,M.rubber,24),0,0,2)));E.addPart('haze.nozzle',at(nz,0,110,D/2),root3);
  const dp=new T.Group();dp.add(at(bx(50,22,4,M.black),0,0,0));dp.add(at(E.label('A001',40,14,{w:160,h:56,bg:'#200a0a',fg:'#ff5a3c',font:'700 36px ui-monospace'}),0,0,3));dp.add(at(cy(9,9,8,M.rubber,16),45,0,0));dp.add(at(lab('DMX    VOLUME',60,8),10,-20,2));E.addPart('haze.ctl.display',at(dp,-10,60,D/2+2),root3);
  const z=-D/2-4;
  const dmx=new T.Group();for(const x of [-18,18]){dmx.add(alongZ(at(cy(10,10,10,M.silver,24),x,0,0)));for(const a of [0,1,2])dmx.add(alongZ(at(cy(2,2,10,M.black,8),x+Math.cos(a*2.1+1.57)*4.5,Math.sin(a*2.1+1.57)*4.5,-6)))}dmx.add(rear(at(lab('DMX IN   OUT',60,9),0,-20,-1)));E.addPart('haze.io.dmx',at(dmx,-20,110,z),root3);
  const pw=new T.Group();pw.add(at(bx(30,22,8,M.black),0,0,0));pw.add(at(bx(22,15,3,M.silver),0,0,-5));pw.add(rear(at(lab('120 V  303 W',60,9),0,-20,-1)));E.addPart('haze.io.power',at(pw,40,60,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1200,1200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nDMX      1 channel · 3-pin\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent='1 ch DMX'},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}});
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
