(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,56,0],theta:0.72,phi:0.9,radius:420},front:{target:[0,56,60],theta:0,phi:1.0,radius:340},rear:{target:[0,56,-60],theta:3.14,phi:1.1,radius:330,min:120}};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.2;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=102,H=112,D=102;
  const body=new T.Group();body.add(at(E.rounded(W,H,D,8,M.black),0,H/2,0));body.add(at(bx(W-10,4,D-10,M.rubber),0,1,0));E.addPart('lc.body',body,root3);
  const ap=new T.Group();ap.add(at(bx(40,30,3,M.silver),0,0,0));ap.add(alongZ(at(cy(5,5,4,M.glass,16),0,0,1)));ap.add(at(lab('DANGER  CLASS 4',44,8),0,-22,2));E.addPart('lc.aperture',at(ap,0,70,D/2+1),root3);
  const ky=new T.Group();ky.add(at(cy(7,7,6,M.silver,16),0,0,0));ky.add(at(bx(3,8,10,M.black),0,4,0));E.addPart('lc.key',at(ky,-30,H+3,-20),root3);
  const z=-D/2-3;
  const usb=new T.Group();usb.add(at(bx(9,4,4,M.silver),0,0,0));usb.add(rear(at(lab('USB',24,7),0,-12,-1)));E.addPart('lc.io.usb',at(usb,-30,70,z),root3);
  const il=new T.Group();il.add(alongZ(at(cy(5,5,6,M.black,12),0,0,0)));il.add(rear(at(lab('INTERLOCK',34,7),0,-12,-1)));E.addPart('lc.io.interlock',at(il,0,70,z),root3);
  const dc=new T.Group();dc.add(alongZ(at(cy(4,4,6,M.black,12),0,0,0)));dc.add(rear(at(lab('DC IN',24,7),0,-12,-1)));E.addPart('lc.io.dc',at(dc,30,70,z),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(700,700),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
}
const initialSim=Object.assign({socket:null,xray:false,output:'Nothing selected. Recorded manufacturer facts only; nothing is connected.'},{});
const E=NNCWorkbench.mount(new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim,build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown connector.';break}
  case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the shell is drawn as a wireframe so hidden parts are visible. Internal positions are illustrative.':'Shell restored.';break;

  }},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='xray');if(refs.ghost)refs.ghost.visible=!refs.shell.visible}

  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SELECTED ${E.sim.socket?E.sim.socket.replace(/^[a-z0-9]+\./,'').toUpperCase():'none'}\nCLASS    4 · technician required\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent='class 4 · not armed'},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}}));
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
