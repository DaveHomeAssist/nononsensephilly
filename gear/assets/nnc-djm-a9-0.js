(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
const SOCKETS=Object.fromEntries(catalog.components.filter(c=>c.action==='socket').map(c=>[c.component_id,`${c.label} · ${c.purpose.split(/(?<=\.)\s/)[0]}`]));
const views={overview:{target:[0,55,0],theta:0.62,phi:0.78,radius:1300},top:{target:[0,55,0],theta:0.1,phi:0.3,radius:1050},rear:{target:[0,55,-100],theta:3.14,phi:1.15,radius:950,min:260},xray:{target:[0,55,0],theta:0.5,phi:0.9,radius:1200}};
function build(E){NNCProduct.prepare(E);const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=0.08;E.scene.add(root3);
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>E.rounded(w,h,d,Math.min(w,h,d)*.12,mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o},rear=o=>{o.rotation.y=Math.PI;return o},faceUp=o=>{o.rotation.x=-Math.PI/2;return o};
  const lab=(text,w,h,opts={})=>E.label(text,w,h,Object.assign({w:Math.round(w*4),h:Math.round(h*4),bg:'#9da6a3',fg:'#101414',font:'700 '+Math.round(h*2.6)+'px system-ui'},opts));
  const mat=(color,roughness=.6,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
  // Rounded boxes from the runtime are centred on the origin; everything here lifts by h/2 so the unit sits on the floor.

  const W=407,H=108,D=458;
  const body=new T.Group();const shell=at(E.rounded(W,H-8,D,8,M.black),0,(H-8)/2,0);body.add(shell);refs.shell=shell;body.add(at(E.rounded(W-6,8,D-6,6,M.dark),0,H-4,0));E.addPart('a9.body',body,root3);
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  const top=H+1;
  refs.faders=[];const ch=new T.Group();for(let i=0;i<4;i++){const x=i*62-93;for(let k=0;k<5;k++)ch.add(at(cy(8,8,8,M.rubber,20),x,0,-120+k*42));const track=at(bx(10,2,90,M.rubber),x,0,100),cap=at(bx(16,8,10,M.silver),x,3,140);ch.add(track,cap);refs.faders.push({track,cap,x})}E.addPart('a9.ch',at(ch,0,top,-20),root3);
  const xf=new T.Group();refs.crossTrack=at(bx(90,2,10,M.rubber),0,0,0);refs.crossCap=at(bx(10,8,16,M.silver),0,3,0);xf.add(refs.crossTrack,refs.crossCap);xf.add(at(cy(10,10,8,M.rubber,20),150,0,-100));xf.add(at(cy(10,10,8,M.rubber,20),150,0,-60));xf.add(at(cy(8,8,8,M.rubber,20),-150,0,-20));xf.add(at(cy(8,8,8,M.rubber,20),-150,0,20));E.addPart('a9.xfader',at(xf,0,top,180),root3);
  const fx=new T.Group();fx.add(at(bx(60,3,36,M.black),0,0,0));fx.add(faceUp(at(E.label('BEAT FX  ECHO 1/2',56,30,{w:280,h:150,bg:'#0d1626',fg:'#7fd4ff',font:'600 34px ui-monospace'}),0,2,0)));for(let k=0;k<4;k++)fx.add(at(cy(7,7,8,M.rubber,16),k*20-30,0,40));fx.add(at(bx(60,3,30,M.glass),0,0,80));E.addPart('a9.fx',at(fx,160,top,-150),root3);
  const rz=-D/2-4,ry=50;
  const xlr=(x,y,g)=>{g.add(alongZ(at(cy(10,10,10,M.silver,24),x,y,0)));for(const a of [0,1,2])g.add(alongZ(at(cy(2,2,10,M.black,8),x+Math.cos(a*2.1+1.57)*4.5,y+Math.sin(a*2.1+1.57)*4.5,-6)))};
  const rcaP=(x,y,g,m1=M.white,m2=M.red)=>{g.add(alongZ(at(cy(4,4,10,m1,12),x-7,y,0)));g.add(alongZ(at(cy(4,4,10,m2,12),x+7,y,0)))};
  const ms=new T.Group();xlr(-16,0,ms);xlr(16,0,ms);rcaP(50,0,ms);ms.add(rear(at(lab('MASTER 1 XLR   MASTER 2',90,8),16,-18,-1)));E.addPart('a9.io.master',at(ms,-150,ry,rz),root3);
  const bo=new T.Group();bo.add(alongZ(at(cy(6,6,10,M.black,16),-10,0,0)));bo.add(alongZ(at(cy(6,6,10,M.black,16),10,0,0)));bo.add(rear(at(lab('BOOTH',40,8),0,-16,-1)));E.addPart('a9.io.booth',at(bo,-70,ry,rz),root3);
  const li=new T.Group();for(let i=0;i<4;i++)rcaP(i*24-36,0,li);li.add(alongZ(at(cy(3,3,8,M.silver,10),60,0,0)));li.add(rear(at(lab('LINE / PHONO   SIGNAL GND',110,8),10,-16,-1)));E.addPart('a9.io.line',at(li,-20,ry-24,rz),root3);
  const dg=new T.Group();for(let i=0;i<4;i++)dg.add(alongZ(at(cy(4,4,10,M.amber,12),i*16-24,0,0)));dg.add(rear(at(lab('DIGITAL IN',60,8),0,-16,-1)));E.addPart('a9.io.digital',at(dg,20,ry,rz),root3);
  const mc=new T.Group();xlr(0,0,mc);mc.add(alongZ(at(cy(6,6,10,M.black,16),30,0,0)));mc.add(rear(at(lab('MIC 1 +48V   MIC 2',70,8),15,-18,-1)));E.addPart('a9.io.mic',at(mc,80,ry,rz),root3);
  const us=new T.Group();for(const [i,w] of [[0,12],[1,12],[2,9]])us.add(at(bx(w,10,8,M.black),i*20,0,0));us.add(rear(at(lab('USB A  B  C',50,8),20,-16,-1)));E.addPart('a9.io.usb',at(us,130,ry,rz),root3);
  const lk=new T.Group();for(let i=0;i<2;i++)lk.add(at(bx(18,14,8,M.black),i*24,0,0));lk.add(rear(at(lab('LINK',30,8),12,-16,-1)));E.addPart('a9.io.link',at(lk,120,ry-26,rz),root3);
  const sr=new T.Group();for(let i=0;i<2;i++)sr.add(alongZ(at(cy(6,6,10,M.black,16),i*18,0,0)));sr.add(rear(at(lab('SEND / RETURN',60,8),9,-16,-1)));E.addPart('a9.io.sendreturn',at(sr,60,ry-26,rz),root3);
  const an=new T.Group();an.add(alongZ(at(cy(4,4,14,M.black,10),0,0,0)));an.add(at(cy(3,3,80,M.black,10),0,40,-6));E.addPart('a9.antenna',at(an,-185,ry+10,rz),root3);
  const ac=new T.Group();ac.add(at(bx(30,22,8,M.black),0,0,0));ac.add(at(bx(22,15,3,M.silver),0,0,-5));ac.add(at(bx(14,20,8,M.red),32,0,0));ac.add(rear(at(lab('AC IN  POWER',60,8),14,-20,-1)));E.addPart('a9.io.ac',at(ac,165,ry-24,rz),root3);
 
  const floor=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;E.scene.add(floor);
  NNCProduct.finish(E,root3,refs,'djm-a9');
  root3.traverse(o=>{if(o.userData.nncMeter){o.material.emissiveIntensity=0;o.material.color.multiplyScalar(.1);}});

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
E.controls=NNCControls.mount(E,[
 ...refs.faders.map(({cap,track,x},i)=>({id:'a9.ch.'+(i+1)+'.fader',component:'a9.ch',source:'djma9-controls',label:'Channel '+(i+1)+' fader',kind:'fader',min:0,max:100,step:1,initial:0,object:cap,targets:[track],track:[[x,3,140],[x,3,60]],apply(value){cap.position.z=140-value*.8;}})),
 {id:'a9.xfader.position',component:'a9.xfader',source:'djma9-controls',label:'Crossfader',kind:'fader',min:0,max:100,step:1,initial:50,object:refs.crossCap,targets:[refs.crossTrack],track:[[-40,3,0],[40,3,0]],format:v=>v===50?'Centre':v+'% left → right',apply(value){refs.crossCap.position.x=-40+value*.8;}}
],{view:'top',note:'Pioneer DJ DJM-A9: four channel faders and MAGVEL crossfader. Values show reconstructed travel, not output dB. Fader curves, assignments, audio and meters are not simulated.'});
E.setView('overview');})();
