(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,375,0],theta:0.72,phi:0.9,radius:1500},panel:{target:[0,80,0],theta:0.4,phi:1.1,radius:320,min:120},ports:{target:[0,80,-24],theta:3.14,phi:1.1,radius:320,min:120}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.1;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const L=750,R=24;
  const tube=new T.Group();const glow=new T.MeshStandardMaterial({color:0xffe6c8,emissive:0xffb070,emissiveIntensity:.5,roughness:.4});tube.add(at(cy(R,R,L-80,glow,32),0,L/2,0));E.addPart('tl.tube',tube,root3);
  const caps=new T.Group();for(const y of [20,L-20])caps.add(at(cy(R+1,R+1,40,M.black,32),0,y,0));caps.add(at(cy(4,4,8,M.silver,12),0,L+2,0));caps.add(at(cy(4,4,8,M.silver,12),0,-2,0));E.addPart('tl.mount',caps,root3);
  const pnl=new T.Group();pnl.add(at(bx(30,60,3,M.black),0,0,0));pnl.add(at(E.label('5600K\n100%',24,20,{w:96,h:80,bg:'#0b1220',fg:'#8ad0ff',font:'700 26px ui-monospace'}),0,16,2));for(let i=0;i<4;i++)pnl.add(at(cy(3.5,3.5,3,M.rubber,12),i*8-12,-14,2));E.addPart('tl.ctl.panel',at(pnl,0,80,R+1),root3);
  const dc=new T.Group();dc.add(alongZ(at(cy(3,3,6,M.black,10),0,0,0)));dc.add(rear(at(lab('DC',16,6),0,-10,-1)));E.addPart('tl.io.dc',at(dc,-8,70,-R-2),root3);
  const dmx=new T.Group();dmx.add(at(bx(12,10,6,M.black),0,0,0));dmx.add(rear(at(lab('DMX',16,6),0,-12,-1)));E.addPart('tl.io.dmx',at(dmx,8,95,-R-2),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nDMX      RJ45 · 32 ch\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent='app / dmx / panel'},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}});
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
