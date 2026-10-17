(function(){'use strict';
const root=document.getElementById('bench-root'), catalog=JSON.parse(document.getElementById('equipment-catalog').textContent);let refs={};
// 538 W × 701 H × 582 D mm cabinet; the camera sits about three cabinet widths away.
const views={overview:{target:[0,350,0],theta:.72,phi:.86,radius:1700},front:{target:[0,350,120],theta:0,phi:1.05,radius:1300},rear:{target:[0,330,-180],theta:3.14,phi:1.12,radius:1150},plate:{target:[0,290,-291],theta:3.14,phi:1.35,radius:620,min:220},driver:{target:[0,350,0],theta:.55,phi:.95,radius:1500}};
const SOCKETS={'s181.io.input':'Factory 1/4-inch INPUT · amplifier feed to the driver (recorded)','s181.io.output':'Factory 1/4-inch OUTPUT · parallel through to a second cabinet (recorded)','s181.io.added-a':'Added socket A · upper LOW (recorded role) · pinout unmetered','s181.io.added-b':'Added socket B · lower LOW (recorded role) · pinout unmetered','s181.io.added-c':'Added socket C · HI (recorded role) · pinout unmetered; likely a pass-through, not measured'};
function build(E){const T=THREE,M=E.mats,root3=new T.Group();root3.rotation.y=.12;E.scene.add(root3);
  // Form follows the EV data sheet envelope only. The S-181 is a bandpass box: the 18-inch driver is
  // sealed inside and fires into a vented front chamber, so the visible openings are the front vents
  // and the rear connector recess. Vent shape, hardware and plate placement are approximate.
  const W=538,H=701,D=582;
  const mesh=(g,mat)=>{const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m};
  const bx=(w,h,d,mat)=>mesh(new T.BoxGeometry(w,h,d),mat),cy=(rt,rb,h,mat,seg=32)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);
  const at=(o,x,y,z)=>{o.position.set(x,y,z);return o},rear=o=>{o.rotation.y=Math.PI;return o},alongZ=o=>{o.rotation.x=Math.PI/2;return o},alongX=o=>{o.rotation.z=Math.PI/2;return o};
  const carpet=new T.MeshStandardMaterial({color:0x23262a,roughness:.95,metalness:0});
  const cabinet=new T.Group();
  const shell=at(E.rounded(W,H,D,14,carpet),0,H/2,0);cabinet.add(shell);refs.shell=shell; // rounded boxes are centred, so lift by H/2
  // Front vents: two horizontal slots in a recessed baffle.
  cabinet.add(at(E.rounded(W-70,H-80,8,10,M.black),0,H/2,D/2-2));
  for(const y of [190,H-190])cabinet.add(at(bx(W-150,96,14,M.rubber),0,y,D/2+1));
  cabinet.add(at(bx(W-150,10,4,M.silver),0,H/2,D/2+5));
  // Corner protectors, side handles and feet.
  for(const sx of [-1,1])for(const sy of [0,1])for(const sz of [-1,1])cabinet.add(at(bx(44,44,44,M.black),sx*(W/2-20),sy?H-22:22,sz*(D/2-20)));
  for(const sx of [-1,1])cabinet.add(at(bx(12,70,150,M.rubber),sx*(W/2+1),H*.62,0));
  for(const [x,z] of [[-W/2+60,D/2-60],[W/2-60,D/2-60],[-W/2+60,-D/2+60],[W/2-60,-D/2+60]])cabinet.add(at(cy(22,22,12,M.rubber,20),x,-6,z));
  // Rear recess carrying the factory jack plate (upper) and the added Bauder plate (lower).
  cabinet.add(at(E.rounded(300,420,10,8,M.black),0,310,-D/2-1));
  E.addPart('s181.cabinet',cabinet,root3);
  // Ghost shell for the driver view: the opaque cabinet hides the woofer, so the view swaps in a wireframe.
  const ghost=new T.Mesh(new T.BoxGeometry(W,H,D),new T.MeshBasicMaterial({color:0x9a4525,wireframe:true,transparent:true,opacity:.35}));ghost.position.y=H/2;ghost.visible=false;root3.add(ghost);refs.ghost=ghost;
  // Driver: 18-inch (457 mm) frame, chamber divider behind the front vents. Position is illustrative.
  const driver=new T.Group();driver.add(alongZ(at(cy(228,228,30,M.soft,48),0,0,0)));driver.add(alongZ(at(cy(205,140,95,M.dark,48),0,0,-60)));driver.add(alongZ(at(cy(70,70,40,M.rubber,32),0,0,8)));driver.add(alongZ(at(cy(90,90,70,M.silver,32),0,0,-125)));
  E.addPart('s181.driver',at(driver,0,H/2,-40),root3);refs.driver=driver;
  // Factory plate: two 1/4-inch jacks.
  const jackPlate=at(E.rounded(170,80,4,6,M.silver),0,470,-D/2-7);root3.add(jackPlate);
  const jack=(id,x,text)=>{const g=new T.Group();g.add(alongZ(at(cy(11,11,8,M.black,24),0,0,0)));g.add(alongZ(at(cy(5.5,5.5,10,M.rubber,16),0,0,-2)));g.add(rear(at(E.label(text,70,16,{w:280,h:64,bg:'#9da6a3',fg:'#101414',font:'700 30px system-ui'}),0,-28,-1)));E.addPart(id,at(g,x,470,-D/2-10),root3)};
  jack('s181.io.input',-42,'INPUT');jack('s181.io.output',42,'OUTPUT');
  // Added "Bauder" plate: three round NL4-style sockets, lettered A, B, C.
  const plate=at(E.rounded(200,230,4,6,M.silver),0,260,-D/2-7);root3.add(plate);refs.plate=plate;
  const socket=(id,x,y,letter,role)=>{const g=new T.Group();g.add(alongZ(at(cy(24,24,10,M.black,32),0,0,0)));g.add(alongZ(at(cy(15,15,12,M.rubber,24),0,0,-2)));for(const a of [0,1,2,3])g.add(alongZ(at(cy(3,3,14,M.silver,10),Math.cos(a*Math.PI/2+Math.PI/4)*8.5,Math.sin(a*Math.PI/2+Math.PI/4)*8.5,-3)));
    g.add(rear(at(E.label(letter,24,24,{w:96,h:96,bg:'#9da6a3',fg:'#101414',font:'800 72px system-ui'}),38,10,-1)));g.add(rear(at(E.label(role,64,14,{w:256,h:56,bg:'#9da6a3',fg:'#101414',font:'700 30px system-ui'}),0,-36,-1)));
    E.addPart(id,at(g,x,y,-D/2-12),root3)};
  socket('s181.io.added-a',-30,330,'A','LOW');socket('s181.io.added-b',-30,235,'B','LOW');socket('s181.io.added-c',50,283,'C','HI');
  // Floor shadow catcher.
  const floor=new T.Mesh(new T.PlaneGeometry(2600,2600),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-12;floor.receiveShadow=true;E.scene.add(floor);
}
const E=new FMPBench.Explorer({root:'#bench-root',catalog,views,defaultView:'overview',initialSim:{socket:null,xray:false,cabinets:1,output:'No socket chosen. Recorded roles only; the plate pinout is unmetered.'},build,onAction(E,a,c){switch(a){
  case'socket':{const id=c.component_id||c.socket;E.sim.socket=SOCKETS[id]?id:null;E.sim.output=SOCKETS[id]||'Unknown socket.';break}
  case'driver':case'xray':E.sim.xray=!E.sim.xray;E.sim.output=E.sim.xray?'X-ray view: the cabinet shell is drawn as a wireframe so the hidden DL18MT is visible. Driver position is illustrative.':'Cabinet shell restored.';break;
  case'cabinets':E.sim.cabinets=Number(c.count)||1;E.sim.output=`${E.sim.cabinets} × 8 Ω cabinet${E.sim.cabinets>1?'s':''} on one amplifier channel → ${(8/E.sim.cabinets).toFixed(E.sim.cabinets===3?2:0)} Ω nominal. Check the amplifier's minimum load before patching.`;break;
  case'reset':break;}},
 renderSim(E){const view=E.cfg.currentView;if(refs.shell){refs.shell.visible=!(E.sim.xray||view==='driver');refs.ghost.visible=!refs.shell.visible}
  const rd=root.querySelector('[data-readout]');if(rd)rd.textContent=`SOCKET   ${E.sim.socket?E.sim.socket.replace('s181.io.','').toUpperCase():'none'}\nX-RAY    ${E.sim.xray?'on':'off'}\nLOAD     ${E.sim.cabinets} × 8 Ω → ${(8/E.sim.cabinets).toFixed(E.sim.cabinets===3?2:0)} Ω\nPINOUT   unmetered\n\n${E.sim.output}`;
  const st=root.querySelector('[data-system-state]');if(st)st.textContent=`${E.sim.cabinets} × S-181 · ${E.sim.xray?'x-ray':'shell'}`},
 practice(){return null},
 partState(E,c){if(!c)return'';return c.action?`Local simulator action: ${c.action}. Nothing is wired, metered or driven.`:'Inspection only. No simulator action is assigned.'}});
const orig=E.setView.bind(E);E.setView=function(n){this.cfg.currentView=n;orig(n);E.renderSim()};
root.querySelectorAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>E.action(b.dataset.sim,b.dataset)));
E.setView('overview');})();
