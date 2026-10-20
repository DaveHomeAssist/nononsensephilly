// Procedural product surfaces and detail for NNC only. No renderer or simulator ownership.
(() => {
 'use strict';
 const T=THREE;
 function bevel(w,h,d,r,material){
  const b=Math.max(.02,Math.min(r,w*.2,h*.2,d*.2)),s=new T.Shape(),x=-w/2+b,y=-h/2+b,iw=w-2*b,ih=h-2*b,c=Math.min(b,iw*.2,ih*.2);
  s.moveTo(x+c,y);s.lineTo(x+iw-c,y);s.quadraticCurveTo(x+iw,y,x+iw,y+c);s.lineTo(x+iw,y+ih-c);s.quadraticCurveTo(x+iw,y+ih,x+iw-c,y+ih);s.lineTo(x+c,y+ih);s.quadraticCurveTo(x,y+ih,x,y+ih-c);s.lineTo(x,y+c);s.quadraticCurveTo(x,y,x+c,y);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:3,steps:1,curveSegments:5});g.translate(0,0,-d/2+b);
  // Extrusion UVs use world units; normalize each face before tiling surface patterns.
  const uv=g.attributes.uv,pos=g.attributes.position,n=g.attributes.normal;for(let i=0;i<uv.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));if(z>=x&&z>=y)uv.setXY(i,pos.getX(i)/w+.5,pos.getY(i)/h+.5);else if(y>=x)uv.setXY(i,pos.getX(i)/w+.5,pos.getZ(i)/d+.5);else uv.setXY(i,pos.getZ(i)/d+.5,pos.getY(i)/h+.5);}
  const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;return m;
 }
 const material=(color,roughness=.5,metalness=.15)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const at=(o,x,y,z)=>{o.position.set(x,y,z);return o;};
 function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
 // Surface finishes are drawn procedurally (no image payload). A seeded generator keeps renders repeatable.
 const rng=(state=7)=>()=>(state=(state*16807)%2147483647)/2147483647;
 function grille(w,h,woven=false){
  if(woven){
   // SM58: bright steel wire woven into a diamond mesh over the dark foam inside the ball.
   const t=texture(64,64,x=>{x.fillStyle='#16181a';x.fillRect(0,0,64,64);x.lineCap='round';for(const [colour,width] of [['#4c5154',4.4],['#eef1f2',2.2]]){x.strokeStyle=colour;x.lineWidth=width;for(let i=-64;i<=64;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i+64,64);x.stroke();x.beginPath();x.moveTo(i,64);x.lineTo(i+64,0);x.stroke();}}});
   t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;t.repeat.set(Math.max(1,Math.round(w/10)),Math.max(1,Math.round(h/20)));
   const m=new T.MeshStandardMaterial({color:0xffffff,map:t,bumpMap:t,bumpScale:1.4,roughness:.3,metalness:.9});return m;
  }
  // Speakers and subs: fine perforated steel (staggered round holes, about 4.5 mm pitch), dark powder coat.
  const t=texture(64,64,x=>{x.fillStyle='#2e3134';x.fillRect(0,0,64,64);x.fillStyle='#020303';for(let r=0;r<4;r++)for(let c=-1;c<5;c++){x.beginPath();x.arc(c*16+(r%2?8:0),r*16+8,5.3,0,Math.PI*2);x.fill();}});
  t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;t.repeat.set(Math.max(1,w/18),Math.max(1,h/18));
  return new T.MeshStandardMaterial({color:0xffffff,map:t,bumpMap:t,bumpScale:.9,roughness:.55,metalness:.45});
 }
 // Brushed aluminium: fine streaks along one axis, or concentric for a jog ring.
 function brushed(colour=0xc3c8cc,{radial=false,roughness=.34,metalness=.82}={}){
  const r=rng(radial?11:5),t=texture(256,radial?256:64,(x,w,h)=>{x.fillStyle='#b9bec2';x.fillRect(0,0,w,h);for(let i=0;i<(radial?220:260);i++){const v=Math.round(150+r()*95);x.strokeStyle=`rgba(${v},${v+2},${v+4},${(.25+r()*.5).toFixed(2)})`;x.lineWidth=.6+r()*1.2;x.beginPath();if(radial)x.arc(128,128,92+r()*36,0,Math.PI*2);else{const y=r()*h;x.moveTo(0,y);x.lineTo(w,y+(r()-.5)*.6);}x.stroke();}});
  const m=new T.MeshStandardMaterial({color:colour,map:t,roughnessMap:t,roughness,metalness});return m;
 }
 // Plastics: satin for control caps and housings, gloss for buttons, platters and lenses.
 const satin=(color=0x1a1c1f)=>material(color,.42,.05),gloss=(color=0x0c0d0f)=>new T.MeshStandardMaterial({color,roughness:.16,metalness:.05});
 function faceLabel(E,parent,text,w,h,x,y,z,{top=false,side=false,fg='#d3d6d7',bg='#101214',font}={}){
  const label=E.label(text,w,h,{w:Math.max(128,Math.round(w*5)),h:Math.max(32,Math.round(h*5)),fg,bg,font:font||`600 ${Math.round(h*2.5)}px system-ui`});if(top)label.rotation.x=-Math.PI/2;if(side)label.rotation.y=Math.PI/2;parent.add(at(label,x,y,z));return label;
 }
 function screw(parent,x,y,z,size=2,top=false){const m=new T.Mesh(new T.CylinderGeometry(size,size,1.2,12),material(0x8c9093,.35,.8));if(!top)m.rotation.x=Math.PI/2;parent.add(at(m,x,y,z));const slit=bevel(size*1.3,.35,.35,.05,material(0x111314));if(top)slit.rotation.x=Math.PI/2;parent.add(at(slit,x,y+(top?.7:0),z+(top?0:.7)));}
 function knob(parent,x,y,z,r=7,colour=0x25282b){const group=new T.Group();group.add(at(new T.Mesh(new T.CylinderGeometry(r*.85,r,r*1.25,24),material(colour,.4,.06)),0,r*.6,0));group.add(at(bevel(1,r*.12,r*.7,.08,material(0xe4e6e7)),0,r*1.25,-r*.25));parent.add(at(group,x,y,z));return group;}
 function ring(parent,r,y,colour=0x727779){const o=new T.Mesh(new T.TorusGeometry(r,.8,5,64),material(colour,.35,.65));o.rotation.x=-Math.PI/2;parent.add(at(o,0,y,0));return o;}
 function meter(parent,x,y,z,segments=12){for(let i=0;i<segments;i++){const colour=i>segments-3?0xf75438:i>segments-6?0xdcc435:0x42ca90;const m=material(colour);m.emissive.setHex(colour);m.emissiveIntensity=.45;const segment=at(bevel(2,.5,3,.1,m),x,y,z-i*4);segment.userData.nncMeter=true;parent.add(segment);}}
 function panelPrint(E,parent,w,d,y,brand){
  const tx=texture(1024,1024,(x,a,b)=>{x.fillStyle='#111316';x.fillRect(0,0,a,b);x.strokeStyle='#777c80';x.lineWidth=1;for(let i=1;i<4;i++){x.beginPath();x.moveTo(a*(.28+i*.11),b*.1);x.lineTo(a*(.28+i*.11),b*.92);x.stroke();}x.fillStyle='#d2d4d6';x.font='bold 22px sans-serif';x.fillText(brand,26,40);if(brand.includes('CDJ')){x.fillStyle='#111316';x.fillRect(0,45,a,b-45);x.fillStyle='#c3c7cc';x.font='14px sans-serif';for(const [text,px,py] of [['HOT CUE',.33,.29],['SEARCH',.08,.55],['CUE',.07,.75],['PLAY / PAUSE',.04,.89],['TEMPO',.86,.6],['LOOP',.08,.35],['TRACK SEARCH',.06,.46]])x.fillText(text,a*px,b*py);for(let k=0;k<15;k++){x.fillStyle='#989ea5';x.fillRect(a*.905,b*(.62+k*.019),18,1);}return;}x.font='12px sans-serif';for(let i=0;i<4;i++){const cx=a*(.335+i*.11);for(const [j,t] of ['TRIM','HI','MID','LOW','COLOR','CUE'].entries())x.fillText(t,cx-14,b*(.2+j*.085));for(let k=0;k<11;k++){x.fillText(String(10-k),cx+24,b*(.65+k*.023));x.fillRect(cx-10,b*(.65+k*.023),18,1);}}x.font='11px sans-serif';x.fillText('MIC / EQ',24,100);x.fillText('BEAT FX',a-138,100);x.fillText('MASTER',a-138,b*.58);});
  const plate=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({map:tx,roughness:.62,metalness:.25,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));plate.rotation.x=-Math.PI/2;parent.add(at(plate,0,y,0));return plate;
 }
 function screen(parent){parent.traverse(o=>{if(!o.isMesh||!o.material.map||o.material.map.image?.tagName!=='CANVAS')return;const tx=texture(1024,512,(x,w,h)=>{x.fillStyle='#080e17';x.fillRect(0,0,w,h);x.fillStyle='#27394c';x.fillRect(0,0,w,40);x.fillStyle='#eef4fb';x.font='600 20px sans-serif';x.fillText('COLLECTION     /     TRACK LIBRARY',24,28);x.font='14px monospace';for(let i=0;i<7;i++){x.fillStyle=i===2?'#245f7e':'#101e2e';x.fillRect(18,65+i*38,988,32);x.fillStyle='#c3d1df';x.fillText(`${String(i+1).padStart(2,'0')}    TRACK ${i+1}                 124.0 BPM     04:32`,34,86+i*38);}for(let band=0;band<2;band++){const y=375+band*60;for(let i=0;i<w;i+=3){const v=8+Math.abs(Math.sin(i*.087)*Math.cos(i*.019))*21;x.fillStyle=band?'#e88d59':'#58bee7';x.fillRect(i,y-v,2,v*2);}x.fillStyle='#fafafa';x.fillRect(w*.42,y-27,2,54);}});o.material=new T.MeshBasicMaterial({map:tx,toneMapped:false});});}
 function jog(parent,metal=false){const discs=parent.children.filter(o=>o.isMesh&&o.geometry.type==='CylinderGeometry');if(!discs.length)return;const radius=discs[0].geometry.parameters.radiusTop;
  if(metal){discs[0].material=brushed(0xd0d4d7,{roughness:.3});if(discs[1])discs[1].material=gloss();const annulus=new T.Mesh(new T.RingGeometry(discs[1]?discs[1].geometry.parameters.radiusTop:radius*.93,radius,96,1),brushed(0xd6dadd,{radial:true,roughness:.26,metalness:.9}));annulus.rotation.x=-Math.PI/2;parent.add(at(annulus,0,5.2,0));}
  ring(parent,radius*.94,6,metal?0xc8ccd0:0x727779);ring(parent,radius*.72,10,0x444a4e);for(let i=0;i<48;i++){const a=i*Math.PI/24;parent.add(at(bevel(1.3,3,2,.2,material(0x4b5054,.4,.5)),Math.sin(a)*(radius-2),4,Math.cos(a)*(radius-2)));}const tx=texture(256,256,(x,w,h)=>{x.fillStyle='#0d1520';x.fillRect(0,0,w,h);x.strokeStyle='#68bade';x.lineWidth=6;x.beginPath();x.arc(128,128,100,-1.57,3);x.stroke();x.fillStyle='#edf3f6';x.font='600 25px monospace';x.textAlign='center';x.fillText('124.0',128,124);x.font='15px monospace';x.fillText('03:12',128,151);});const display=new T.Mesh(new T.CircleGeometry(radius*.34,48),new T.MeshBasicMaterial({map:tx,toneMapped:false}));display.rotation.x=-Math.PI/2;parent.add(at(display,0,15,0));}
 function mixer(E,slug){const p=E.partObjects,standalone=slug==='djm-a9',id=standalone?'a9.ch':slug==='prime-4'?'p4.mixer':'xz.mixer',g=p.get(id);const spacing=standalone?62:slug==='prime-4'?48:50;
  if(g){for(let i=0;i<4;i++){const x=(i-1.5)*spacing;for(let row=0;row<5;row++)knob(g,x,0,-155+row*39,row===4?9:7);meter(g,x+18,2,18);g.add(at(bevel(18,2,10,.8,E.mats.amber),x,2,44));}for(const side of [-1,1])for(let k=0;k<7;k++)knob(g,side*(standalone?155:122),0,-150+k*43,k%3===0?8:6);}
  const body=p.get(standalone?'a9.body':slug==='prime-4'?'p4.body':'xz.body');if(body)panelPrint(E,body,standalone?401:slug==='prime-4'?721:871,standalone?451:slug==='prime-4'?490:459, E.catalog.dimensions_mm[1]+.4,standalone?'Pioneer DJ     DJM-A9':slug==='prime-4'?'denon DJ   PRIME 4':'Pioneer DJ     XDJ-XZ');
  if(standalone){const fx=p.get('a9.fx');for(let i=0;i<6;i++)fx.add(at(bevel(9,2,7,.5,i===1?E.mats.amber:E.mats.black),(i%3)*18-18,2,105+Math.floor(i/3)*13));knob(fx,0,1,145,13);meter(fx,-15,2,180);}
  if(!standalone){const prefix=slug==='prime-4'?'p4':'xz';for(const side of ['left','right'])jog(p.get(prefix+'.jog.'+side));const owner=p.get(prefix+'.mixer');const centre=slug==='prime-4'?245:300;for(const sign of [-1,1]){for(let i=0;i<6;i++)knob(owner,sign*centre+(i%3)*28-28,0,-190+Math.floor(i/3)*31,6);for(let i=0;i<8;i++){const z=slug==='prime-4'?175:195;if(slug==='prime-4')owner.add(at(bevel(24,3,20,1,[E.mats.green,E.mats.red,E.mats.amber][i%3]),sign*centre+(i%4)*31-46,2,z+Math.floor(i/4)*25));}for(const z of [90,140]){const button=new T.Mesh(new T.CylinderGeometry(13,13,3,32),E.mats.black);owner.add(at(button,sign*(centre+100),2,z));const rim=ring(new T.Group(),12,4,z===90?0xeecf67:0x4fe88a);rim.parent.position.set(sign*(centre+100),0,z);owner.add(rim.parent);}}}
  for(const [key,obj] of p)if(/screen|\.fx$/.test(key))screen(obj);
 }
 function speaker(E,refs,slug){const [w,h,d]=E.catalog.dimensions_mm,prefix={s181:'s181','zlx-15bt':'zlx','ekx-15sp':'ekx','cva-118':'cva'}[slug],cab=E.partObjects.get(prefix+'.cabinet');
  let side=null;
  if(slug==='zlx-15bt'){
   // The real cabinet is strongly trapezoidal in plan: full width for a short front section, then the sides run back to about half the front width.
   const r=12,back=w*.5,straight=34,shape=new T.Shape();shape.moveTo(-w/2+r,d/2-r);shape.lineTo(w/2-r,d/2-r);shape.lineTo(w/2-r,d/2-straight);shape.lineTo(back/2-r,-d/2+r);shape.lineTo(-back/2+r,-d/2+r);shape.lineTo(-w/2+r,d/2-straight);shape.closePath();const geometry=new T.ExtrudeGeometry(shape,{depth:h-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1});geometry.rotateX(Math.PI/2);geometry.center();refs.shell.geometry.dispose();refs.shell.geometry=geometry;
   const angle=Math.atan2((w-back)/2,d-straight);side=z=>z>=d/2-straight?w/2:back/2+(w-back)/2*(z+d/2)/(d-straight);
   cab.traverse(o=>{if(!o.isMesh||o===refs.shell)return;if(Math.abs(o.position.x)>w*.45&&o.position.y>h*.5&&o.position.y<h*.7){const sign=Math.sign(o.position.x);o.position.x=sign*(side(o.position.z)+1);o.rotation.y=sign*angle;}else if(o.position.z<-d/2+2&&o.position.y>200&&o.position.y<400)o.scale.x=(back-60)/260;});
  }
  // Replace the old front plate; stacking two grilles causes depth collisions.
  const front=cab.children.find(o=>o.isMesh&&o!==refs.shell&&o.position.z>d/2-8&&o.geometry.type!=='BoxGeometry');if(front){cab.remove(front);front.geometry.dispose();}
  const group=new T.Group(),panel=at(bevel(w-58,h-66,3,1,grille(w,h)),0,h/2,d/2+4);panel.name='nnc-speaker-grille';group.add(panel);
  if(slug==='s181'){for(const y of [158,543]){const vent=at(bevel(w-135,47,3,1,material(0x030405,.95)),0,y,d/2+8);vent.name='nnc-speaker-vent';group.add(vent);}}
  faceLabel(E,group,slug==='cva-118'?'CERWIN-VEGA!':'EV',slug==='cva-118'?110:45,slug==='cva-118'?17:25,0,slug==='s181'?h*.49:53,d/2+7,{fg:slug==='cva-118'?'#d73132':'#e0e2e2'});
  for(const x of [-w/2+35,w/2-35])for(const y of [42,h-42])screw(group,x,y,d/2+7,2.5);
  for(const o of [...cab.children])if(o.isMesh&&Math.abs(o.position.x)>w*.45&&o.position.y>h*.5&&o.position.y<h*.7){cab.remove(o);o.geometry.dispose();}cab.add(group);E.productExterior=cab;refs.productExterior=cab;
  // Recessed handle wells, rounded inset grip bars and mounting screws.
  const handles=slug==='cva-118'?E.partObjects.get('cva.handles'):cab;
  for(const sign of [-1,1]){const well=at(bevel(4,74,142,3,E.mats.black),sign*((side?side(0):w/2)+2),h*.61,0),grip=at(bevel(10,18,95,4,E.mats.rubber),sign*((side?side(0):w/2)+6),h*.61,0);if(side)well.rotation.y=grip.rotation.y=sign*Math.atan2(w/4,d-34);handles.add(well,grip);}
 }
 // QSC GX faceplate, laid out as on the GX5/GX7 front: brushed silver plate with two banks of through-slots
 // (dark chassis behind them), a recessed black centre panel carrying the power switch, model legend,
 // both gain knobs and the LEDs, and the QSC wordmark centred below. GX5 and GX7 share this faceplate;
 // the printed model legend is the visible difference.
 function amp(E,slug){const prefix=slug==='gx7'?'gx7':'gx5',g=E.partObjects.get(prefix+'.chassis'),[w,h,d]=E.catalog.dimensions_mm;
  const dark=material(0x08090a,.85,.1),metal=brushed(0xc9ced2,{roughness:.36}),ears=brushed(0xb9bec3,{roughness:.42});
  for(const o of g.children){if(!o.isMesh)continue;if(o.position.z>d/2&&Math.abs(o.position.x)<w/2)o.material=dark;else if(o.position.z>d/2&&Math.abs(o.position.x)>w/2)o.material=ears;}
  const pw=w-4,ph=h-8,depth=3,shape=new T.Shape();shape.moveTo(-pw/2,-ph/2);shape.lineTo(pw/2,-ph/2);shape.lineTo(pw/2,ph/2);shape.lineTo(-pw/2,ph/2);shape.closePath();
  const hole=(x0,y0,x1,y1)=>{const p=new T.Path();p.moveTo(x0,y0);p.lineTo(x0,y1);p.lineTo(x1,y1);p.lineTo(x1,y0);p.closePath();shape.holes.push(p);};
  for(const sign of [-1,1])for(let j=0;j<17;j++){const x=sign*(96+j*6.6);hole(x-1.7,-ph/2+20,x+1.7,ph/2-11);}
  hole(-76,-ph/2+17,76,ph/2-9);
  const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.5,bevelThickness:.5,bevelSegments:1,curveSegments:1});
  const uv=geometry.attributes.uv,pos=geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/pw+.5,pos.getY(i)/ph+.5);
  const plate=new T.Mesh(geometry,metal);plate.castShadow=plate.receiveShadow=true;g.add(at(plate,0,h/2,d/2+2));
  const front=d/2+2+depth;
  const panel=at(bevel(154,ph-24,1.5,.4,satin(0x15171a)),0,h/2+4,d/2+2.1);g.add(panel);
  faceLabel(E,g,'QSC',64,15,0,12.5,front+.6,{fg:'#1a1d20',bg:'rgba(0,0,0,0)',font:'900 62px system-ui'});
  faceLabel(E,g,slug.toUpperCase(),20,9,-36,h/2+9,d/2+3.6,{fg:'#e3e6e8',bg:'#15171a',font:'700 36px system-ui'});faceLabel(E,g,'POWER AMPLIFIER',30,5,-36,h/2+1,d/2+3.6,{fg:'#c3c7ca',bg:'#15171a',font:'600 14px system-ui'});
  faceLabel(E,g,'POWER\nON',14,7,-62,h/2+22,d/2+3.6,{fg:'#c9cdd0',bg:'#15171a',font:'600 14px system-ui'});
  for(const x of [-w/2+7,w/2-7])for(const y of [12,h-12])screw(g,x,y,front,3);
 }
 // Fit the camera to the product's projected silhouette (sampled mesh vertices, falling back to
 // bounding-box corners) so the limiting dimension fills FRAME_FILL of the scene, centred.
 const FRAME_FILL=.66;
 function framePoints(root3){const points=[];root3.traverse(o=>{if(!o.isMesh||o.material.wireframe)return;let node=o;while(node&&node.visible)node=node.parent;if(node)return;const p=o.geometry.attributes.position;if(!p)return;const step=Math.max(1,Math.floor(p.count/300)),pick=new Set();for(let i=0;i<p.count;i+=step)pick.add(i);
   // Keep each mesh's extreme vertices so sparse sampling never trims the silhouette.
   for(let a=0;a<3;a++){let lo=0,hi=0;for(let i=0;i<p.count;i++){const v=p.getComponent(i,a);if(v<p.getComponent(lo,a))lo=i;if(v>p.getComponent(hi,a))hi=i;}pick.add(lo);pick.add(hi);}
   for(const i of pick)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));});return points;}
 function frame(E){
  const box=E.productBounds;if(!box||box.isEmpty())return;const direction=new T.Vector3(Math.sin(E.phi)*Math.sin(E.theta),Math.cos(E.phi),Math.sin(E.phi)*Math.cos(E.theta));const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize(),centre=box.getCenter(new T.Vector3()),tan=Math.tan(T.MathUtils.degToRad(E.camera.fov/2)),aspect=E.camera.aspect||1;
  let points=E.productPoints;if(!points?.length){points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z));}
  const v=new T.Vector3();let radius=1;
  for(let pass=0;pass<6;pass++){
   radius=1;for(const p of points){v.subVectors(p,centre);const depth=v.dot(direction);radius=Math.max(radius,depth+Math.abs(v.dot(right))/(tan*aspect*FRAME_FILL),depth+Math.abs(v.dot(up))/(tan*FRAME_FILL));}
   let left=Infinity,rightEdge=-Infinity,bottom=Infinity,top=-Infinity;for(const p of points){v.subVectors(p,centre);const distance=radius-v.dot(direction),x=v.dot(right)/(distance*tan*aspect),y=v.dot(up)/(distance*tan);left=Math.min(left,x);rightEdge=Math.max(rightEdge,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
   const cx=(left+rightEdge)/2,cy=(bottom+top)/2;if(pass===5||Math.abs(cx)<.004&&Math.abs(cy)<.004)break;centre.addScaledVector(right,cx*radius*tan*aspect).addScaledVector(up,cy*radius*tan);
  }
  E.target.copy(centre);E.radius=radius;E.minRadius=Math.max(20,radius*.25);E.maxRadius=radius*3;E.camera.far=Math.max(5000,E.maxRadius+box.getSize(new T.Vector3()).length());E.camera.updateProjectionMatrix();E.updateCam();
 }
 function prepare(E){E.camera.near=Math.max(.5,Math.max(...E.catalog.dimensions_mm)*.005);E.camera.updateProjectionMatrix();E.rounded=bevel;for(const [name,c] of Object.entries({black:0x101114,dark:0x25272a,soft:0x303236,rubber:0x151618,silver:0xaeb4bb}))E.mats[name].color.setHex(c);}
 function finish(E,root3,refs,slug){
  E.cfg.views.overview.phi=['s181','zlx-15bt','ekx-15sp','cva-118','gx5','gx7','haze-1dx','j-six','lasercube-2w','vertigo-tri-led'].includes(slug)?1.12:slug==='sm58'||slug==='tl60'?1.06:.7;
  if(['s181','zlx-15bt','ekx-15sp','cva-118'].includes(slug))speaker(E,refs,slug);
  if(['gx5','gx7'].includes(slug))amp(E,slug);
  if(['prime-4','xdj-xz','djm-a9'].includes(slug))mixer(E,slug);
  if(slug==='cdj-3000'){const body=E.partObjects.get('cdj.body');body.children.filter(o=>o.isMesh&&!o.material.wireframe).forEach(o=>o.material=E.mats.black);jog(E.partObjects.get('cdj.jog'),true);screen(E.partObjects.get('cdj.screen'));const transport=E.partObjects.get('cdj.transport');for(let i=0;i<12;i++)transport.add(at(bevel(13,3,9,.7,i===1?E.mats.amber:gloss()),(i%3)*20+15,0,-290+Math.floor(i/3)*25));for(let i=0;i<4;i++)knob(transport,270,0,-315+i*26,5);panelPrint(E,body,321,445,118.4,'Pioneer DJ    CDJ-3000');}
  if(slug==='sm58'){const grillePart=E.partObjects.get('sm.grille');grillePart.children[0].material=grille(155,160,true);const seam=new T.Mesh(new T.TorusGeometry(25.5,.65,8,64),E.mats.silver);seam.rotation.x=Math.PI/2;grillePart.add(seam);const handle=E.partObjects.get('sm.handle');handle.traverse(o=>{if(o.isMesh&&!o.material.wireframe&&!o.material.map&&o.material.color&&o.material.color.getHex()<0x404040)o.material=material(0x232528,.4,.45);});faceLabel(E,handle,'SHURE\nSM58',17,11,0,106,14.2,{fg:'#e0e2e4',bg:'#25272a'});}
  if(slug==='tl60'){const tube=E.partObjects.get('tl.tube');tube.children[0].material=new T.MeshBasicMaterial({color:0xf1fcff,toneMapped:false});for(const radius of [25.2,28,32]){const m=new T.MeshBasicMaterial({color:0xb9eafa,transparent:true,opacity:radius===25.2?.16:.035,depthWrite:false,side:T.BackSide,toneMapped:false});tube.add(at(new T.Mesh(new T.CylinderGeometry(radius,radius,670,48,1,true),m),0,375,0));}faceLabel(E,E.partObjects.get('tl.mount'),'Godox',25,10,0,729,25.8,{fg:'#d6d9dd',bg:'#101114'});}
  // Detail added after addPart must retain pick and highlight ownership.
  E.pickables=[];for(const [id,part] of E.partObjects)part.traverse(o=>{if(o.isMesh){o.userData.componentId=id;E.pickables.push(o);}});
  E.scene.updateMatrixWorld(true);const bounds=new T.Box3();root3.traverse(o=>{if(!o.isMesh||o.material.wireframe)return;let node=o;while(node&&node.visible)node=node.parent;if(node)return;bounds.expandByObject(o);});E.productBounds=bounds;E.productFloorY=bounds.min.y-1;E.productPoints=framePoints(root3);
  const [w,h,d]=E.catalog.dimensions_mm,scale=Math.max(w,h,d);
  E.scene.traverse(o=>{if(o.material?.isShadowMaterial){o.position.y=E.productFloorY;o.visible=false;}});
  const shadow=texture(256,256,x=>{const gradient=x.createRadialGradient(128,128,12,128,128,125);gradient.addColorStop(0,'rgba(0,0,0,.32)');gradient.addColorStop(.4,'rgba(0,0,0,.19)');gradient.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gradient;x.fillRect(0,0,256,256);});const contact=new T.Mesh(new T.PlaneGeometry(w*1.65,d*1.65),new T.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false,toneMapped:false}));contact.name='nnc-contact-shadow';contact.rotation.x=-Math.PI/2;contact.position.set(0,E.productFloorY+.1,0);contact.rotation.z=-root3.rotation.y;E.scene.add(contact);
  if(E.renderer){E.renderer.shadowMap.type=T.PCFSoftShadowMap;E.renderer.toneMappingExposure=1.05;
   E.scene.traverse(light=>{if(light.isHemisphereLight)light.intensity=1.2;if(light.isDirectionalLight){light.intensity=light.castShadow?3.4:1.5;if(light.castShadow){light.position.set(-scale,scale*1.7,scale*1.5);light.target.position.copy(bounds.getCenter(new T.Vector3()));E.scene.add(light.target);light.shadow.camera.left=light.shadow.camera.bottom=-scale;light.shadow.camera.right=light.shadow.camera.top=scale;light.shadow.camera.near=.5;light.shadow.camera.far=scale*6;light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.0003;light.shadow.normalBias=.35;light.shadow.camera.updateProjectionMatrix();}}});
   const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,i===2?'#ffffff':'#cdd2da');g.addColorStop(.55,'#757d86');g.addColorStop(1,'#343940');x.fillStyle=g;x.fillRect(0,0,128,128);if(i%2===0){x.fillStyle='#f9fbff';x.fillRect(25,10,40,100);}return c;});const cube=new T.CubeTexture(faces);cube.needsUpdate=true;const pmrem=new T.PMREMGenerator(E.renderer),environment=pmrem.fromCubemap(cube);E.scene.environment=environment.texture;E.scene.userData.productEnvironment=environment;pmrem.dispose();cube.dispose();
  }
  E.productShell=refs.shell;E.productExterior=refs.productExterior;E.productExteriors=[];const outer=refs.productExterior||E.partObjects.get(slug==='cdj-3000'?'cdj.body':slug==='prime-4'?'p4.body':slug==='xdj-xz'?'xz.body':slug==='djm-a9'?'a9.body':'');if(outer)outer.traverse(o=>{if(o.isMesh&&!o.material.wireframe)E.productExteriors.push(o);});const dispose=E.dispose.bind(E);E.dispose=function(){E.scene.userData.productEnvironment?.dispose();E.scene.environment=null;dispose();};E.root.dataset.productDetail='true';
 }
 window.NNCProduct={prepare,finish,frame,FRAME_FILL,bevel,grille,brushed,satin,gloss,material,faceLabel,screw,knob,at};
})();
