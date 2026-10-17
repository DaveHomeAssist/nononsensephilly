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
 function grille(w,h,woven=false){
  const t=texture(128,128,x=>{x.fillStyle=woven?'#55585a':'#43484a';x.fillRect(0,0,128,128);for(let y=0;y<128;y+=16)for(let i=0;i<128;i+=16){const a=i+(y%32?8:0);x.fillStyle='#080b0c';x.beginPath();x.ellipse(a,y,5.8,5.8,0,0,Math.PI*2);x.fill();x.strokeStyle=woven?'#898d8e':'#616669';x.lineWidth=woven?2:1;x.beginPath();x.arc(a,y,6.7,.1,2.9);x.stroke();}});
  t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(Math.max(1,w/30),Math.max(1,h/30));
  const m=material(woven?0xc9cdd0:0xc0c7cb,woven?.48:.7,woven?.65:.4);m.map=t;m.bumpMap=t;m.bumpScale=woven?.4:.32;return m;
 }
 function faceLabel(E,parent,text,w,h,x,y,z,{top=false,side=false,fg='#d3d6d7',bg='#101214',font}={}){
  const label=E.label(text,w,h,{w:Math.max(128,Math.round(w*5)),h:Math.max(32,Math.round(h*5)),fg,bg,font:font||`600 ${Math.round(h*2.5)}px system-ui`});if(top)label.rotation.x=-Math.PI/2;if(side)label.rotation.y=Math.PI/2;parent.add(at(label,x,y,z));return label;
 }
 function screw(parent,x,y,z,size=2,top=false){const m=new T.Mesh(new T.CylinderGeometry(size,size,1.2,12),material(0x8c9093,.35,.8));if(!top)m.rotation.x=Math.PI/2;parent.add(at(m,x,y,z));const slit=bevel(size*1.3,.35,.35,.05,material(0x111314));if(top)slit.rotation.x=Math.PI/2;parent.add(at(slit,x,y+(top?.7:0),z+(top?0:.7)));}
 function knob(parent,x,y,z,r=7,colour=0x25282b){const group=new T.Group();group.add(at(new T.Mesh(new T.CylinderGeometry(r*.85,r,r*1.25,24),material(colour,.6,.1)),0,r*.6,0));group.add(at(bevel(1,r*.12,r*.7,.08,material(0xe4e6e7)),0,r*1.25,-r*.25));parent.add(at(group,x,y,z));return group;}
 function ring(parent,r,y,colour=0x727779){const o=new T.Mesh(new T.TorusGeometry(r,.8,5,64),material(colour,.35,.65));o.rotation.x=-Math.PI/2;parent.add(at(o,0,y,0));return o;}
 function meter(parent,x,y,z,segments=12){for(let i=0;i<segments;i++){const colour=i>segments-3?0xf75438:i>segments-6?0xdcc435:0x42ca90;const m=material(colour);m.emissive.setHex(colour);m.emissiveIntensity=.45;parent.add(at(bevel(2,.5,3,.1,m),x,y,z-i*4));}}
 function panelPrint(E,parent,w,d,y,brand){
  const tx=texture(1024,1024,(x,a,b)=>{x.fillStyle='#111316';x.fillRect(0,0,a,b);x.strokeStyle='#777c80';x.lineWidth=1;for(let i=1;i<4;i++){x.beginPath();x.moveTo(a*(.28+i*.11),b*.1);x.lineTo(a*(.28+i*.11),b*.92);x.stroke();}x.fillStyle='#d2d4d6';x.font='bold 22px sans-serif';x.fillText(brand,26,40);if(brand.includes('CDJ')){x.fillStyle='#111316';x.fillRect(0,45,a,b-45);x.fillStyle='#c3c7cc';x.font='14px sans-serif';for(const [text,px,py] of [['HOT CUE',.33,.29],['SEARCH',.08,.55],['CUE',.07,.75],['PLAY / PAUSE',.04,.89],['TEMPO',.86,.6],['LOOP',.08,.35],['TRACK SEARCH',.06,.46]])x.fillText(text,a*px,b*py);for(let k=0;k<15;k++){x.fillStyle='#989ea5';x.fillRect(a*.905,b*(.62+k*.019),18,1);}return;}x.font='12px sans-serif';for(let i=0;i<4;i++){const cx=a*(.335+i*.11);for(const [j,t] of ['TRIM','HI','MID','LOW','COLOR','CUE'].entries())x.fillText(t,cx-14,b*(.2+j*.085));for(let k=0;k<11;k++){x.fillText(String(10-k),cx+24,b*(.65+k*.023));x.fillRect(cx-10,b*(.65+k*.023),18,1);}}x.font='11px sans-serif';x.fillText('MIC / EQ',24,100);x.fillText('BEAT FX',a-138,100);x.fillText('MASTER',a-138,b*.58);});
  const plate=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({map:tx,roughness:.62,metalness:.25}));plate.rotation.x=-Math.PI/2;parent.add(at(plate,0,y,0));return plate;
 }
 function screen(parent){parent.traverse(o=>{if(!o.isMesh||!o.material.map||o.material.map.image?.tagName!=='CANVAS')return;const tx=texture(1024,512,(x,w,h)=>{x.fillStyle='#080e17';x.fillRect(0,0,w,h);x.fillStyle='#27394c';x.fillRect(0,0,w,40);x.fillStyle='#eef4fb';x.font='600 20px sans-serif';x.fillText('COLLECTION     /     TRACK LIBRARY',24,28);x.font='14px monospace';for(let i=0;i<7;i++){x.fillStyle=i===2?'#245f7e':'#101e2e';x.fillRect(18,65+i*38,988,32);x.fillStyle='#c3d1df';x.fillText(`${String(i+1).padStart(2,'0')}    TRACK ${i+1}                 124.0 BPM     04:32`,34,86+i*38);}for(let band=0;band<2;band++){const y=375+band*60;for(let i=0;i<w;i+=3){const v=8+Math.abs(Math.sin(i*.087)*Math.cos(i*.019))*21;x.fillStyle=band?'#e88d59':'#58bee7';x.fillRect(i,y-v,2,v*2);}x.fillStyle='#fafafa';x.fillRect(w*.42,y-27,2,54);}});o.material=new T.MeshBasicMaterial({map:tx,toneMapped:false});});}
 function jog(parent){const discs=parent.children.filter(o=>o.isMesh&&o.geometry.type==='CylinderGeometry');if(!discs.length)return;const radius=discs[0].geometry.parameters.radiusTop;ring(parent,radius*.94,6);ring(parent,radius*.72,10,0x444a4e);for(let i=0;i<48;i++){const a=i*Math.PI/24;parent.add(at(bevel(1.3,3,2,.2,material(0x4b5054,.4,.5)),Math.sin(a)*(radius-2),4,Math.cos(a)*(radius-2)));}const tx=texture(256,256,(x,w,h)=>{x.fillStyle='#0d1520';x.fillRect(0,0,w,h);x.strokeStyle='#68bade';x.lineWidth=6;x.beginPath();x.arc(128,128,100,-1.57,3);x.stroke();x.fillStyle='#edf3f6';x.font='600 25px monospace';x.textAlign='center';x.fillText('124.0',128,124);x.font='15px monospace';x.fillText('03:12',128,151);});const display=new T.Mesh(new T.CircleGeometry(radius*.34,48),new T.MeshBasicMaterial({map:tx,toneMapped:false}));display.rotation.x=-Math.PI/2;parent.add(at(display,0,15,0));}
 function mixer(E,slug){const p=E.partObjects,standalone=slug==='djm-a9',id=standalone?'a9.ch':slug==='prime-4'?'p4.mixer':'xz.mixer',g=p.get(id);const spacing=standalone?62:slug==='prime-4'?48:50;
  if(g){for(let i=0;i<4;i++){const x=(i-1.5)*spacing;for(let row=0;row<5;row++)knob(g,x,0,-155+row*39,row===4?9:7);meter(g,x+18,2,18);g.add(at(bevel(18,2,10,.8,E.mats.amber),x,2,44));}for(const side of [-1,1])for(let k=0;k<7;k++)knob(g,side*(standalone?155:122),0,-150+k*43,k%3===0?8:6);}
  const body=p.get(standalone?'a9.body':slug==='prime-4'?'p4.body':'xz.body');if(body)panelPrint(E,body,standalone?401:slug==='prime-4'?721:871,standalone?451:slug==='prime-4'?490:459, E.catalog.dimensions_mm[1]+.4,standalone?'Pioneer DJ     DJM-A9':slug==='prime-4'?'denon DJ   PRIME 4':'Pioneer DJ     XDJ-XZ');
  if(standalone){const fx=p.get('a9.fx');for(let i=0;i<6;i++)fx.add(at(bevel(9,2,7,.5,i===1?E.mats.amber:E.mats.black),(i%3)*18-18,2,105+Math.floor(i/3)*13));knob(fx,0,1,145,13);meter(fx,-15,2,180);}
  if(!standalone){const prefix=slug==='prime-4'?'p4':'xz';for(const side of ['left','right'])jog(p.get(prefix+'.jog.'+side));const owner=p.get(prefix+'.mixer');const centre=slug==='prime-4'?245:300;for(const sign of [-1,1]){for(let i=0;i<6;i++)knob(owner,sign*centre+(i%3)*28-28,0,-190+Math.floor(i/3)*31,6);for(let i=0;i<8;i++){const z=slug==='prime-4'?175:195;if(slug==='prime-4')owner.add(at(bevel(24,3,20,1,[E.mats.green,E.mats.red,E.mats.amber][i%3]),sign*centre+(i%4)*31-46,2,z+Math.floor(i/4)*25));}for(const z of [90,140]){const button=new T.Mesh(new T.CylinderGeometry(13,13,3,32),E.mats.black);owner.add(at(button,sign*(centre+100),2,z));const rim=ring(new T.Group(),12,4,z===90?0xeecf67:0x4fe88a);rim.parent.position.set(sign*(centre+100),0,z);owner.add(rim.parent);}}}
  for(const [key,obj] of p)if(/screen|\.fx$/.test(key))screen(obj);
 }
 function speaker(E,refs,slug){const [w,h,d]=E.catalog.dimensions_mm,prefix={s181:'s181','zlx-15bt':'zlx','ekx-15sp':'ekx','cva-118':'cva'}[slug],cab=E.partObjects.get(prefix+'.cabinet');
  if(slug==='zlx-15bt'){
   const shape=new T.Shape();shape.moveTo(-w/2+12,d/2-12);shape.lineTo(w/2-12,d/2-12);shape.lineTo(w*.32-12,-d/2+12);shape.lineTo(-w*.32+12,-d/2+12);shape.closePath();const geometry=new T.ExtrudeGeometry(shape,{depth:h-24,bevelEnabled:true,bevelSize:12,bevelThickness:12,bevelSegments:4,steps:1});geometry.rotateX(Math.PI/2);geometry.center();refs.shell.geometry.dispose();refs.shell.geometry=geometry;
  }
  const front=cab.children.find(o=>o.isMesh&&o!==refs.shell&&o.position.z>d/2-8&&o.geometry.type!=='BoxGeometry');if(front)front.material=grille(w,h);
  const group=new T.Group(),panel=at(bevel(w-58,h-66,3,1,grille(w,h)),0,h/2,d/2+4);group.add(panel);
  if(slug==='s181'){panel.scale.y=.68;panel.position.y=h*.53;for(const y of [158,543])group.add(at(bevel(w-135,47,8,4,material(0x030405,.95)),0,y,d/2+7));}
  faceLabel(E,group,slug==='cva-118'?'CERWIN-VEGA!':'EV',slug==='cva-118'?110:45,slug==='cva-118'?17:25,0,slug==='s181'?h*.49:53,d/2+7,{fg:slug==='cva-118'?'#d73132':'#e0e2e2'});
  for(const x of [-w/2+35,w/2-35])for(const y of [42,h-42])screw(group,x,y,d/2+7,2.5);
  cab.traverse(o=>{if(o.isMesh&&Math.abs(o.position.x)>w*.45&&o.position.y>h*.5&&o.position.y<h*.7)o.material=E.mats.rubber;});cab.add(group);E.productExterior=cab;refs.productExterior=cab;
  // Recessed handle wells, rounded inset grip bars and mounting screws.
  const handles=slug==='cva-118'?E.partObjects.get('cva.handles'):cab;
  for(const sign of [-1,1]){const well=at(bevel(4,74,142,3,E.mats.black),sign*(w/2+2),h*.61,0);handles.add(well);const grip=at(bevel(10,18,95,4,E.mats.rubber),sign*(w/2+6),h*.61,0);handles.add(grip);}
 }
 function amp(E,slug){const prefix=slug==='gx7'?'gx7':'gx5',g=E.partObjects.get(prefix+'.chassis'),[w,h,d]=E.catalog.dimensions_mm;const front=g.children.find(o=>o.isMesh&&o.position.z>d/2);if(front)front.material=material(0xaeb5bc,.37,.72);
  const plate=at(bevel(w-38,h-8,2,.5,material(0xb8bec3,.4,.75)),0,h/2,d/2+2);g.add(plate);
  for(const side of [-1,1])for(let j=0;j<14;j++)g.add(at(bevel(3,h-28,1,.3,E.mats.black),side*85+(j-6.5)*5,h/2,d/2+3.5));
  faceLabel(E,g,'QSC',43,15,-200,h-22,d/2+4,{fg:'#111416',bg:'#b8bec3'});faceLabel(E,g,slug.toUpperCase(),38,15,198,18,d/2+4,{fg:'#111416',bg:'#b8bec3'});
  for(const x of [-w/2+7,w/2-7])for(const y of [12,h-12])screw(g,x,y,d/2+4,3);
 }
 function frame(E){
  const box=E.productBounds;if(!box||box.isEmpty())return;const direction=new T.Vector3(Math.sin(E.phi)*Math.sin(E.theta),Math.cos(E.phi),Math.sin(E.phi)*Math.cos(E.theta));const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize(),centre=box.getCenter(new T.Vector3()),tan=Math.tan(T.MathUtils.degToRad(E.camera.fov/2));let radius=1;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).sub(centre),depth=v.dot(direction);radius=Math.max(radius,depth+Math.abs(v.dot(right))/(tan*E.camera.aspect*.78),depth+Math.abs(v.dot(up))/(tan*.78));}
  E.target.copy(centre);E.radius=radius;E.minRadius=Math.max(20,radius*.25);E.maxRadius=radius*3;E.camera.far=Math.max(5000,E.maxRadius+box.getSize(new T.Vector3()).length());E.camera.updateProjectionMatrix();E.updateCam();
 }
 function prepare(E){E.rounded=bevel;for(const [name,c] of Object.entries({black:0x101114,dark:0x25272a,soft:0x303236,rubber:0x151618,silver:0xaeb4bb}))E.mats[name].color.setHex(c);}
 function finish(E,root3,refs,slug){
  E.cfg.views.overview.phi=['s181','zlx-15bt','ekx-15sp','cva-118','gx5','gx7','haze-1dx','j-six','lasercube-2w','vertigo-tri-led'].includes(slug)?1.12:slug==='sm58'||slug==='tl60'?1.06:.7;
  if(['s181','zlx-15bt','ekx-15sp','cva-118'].includes(slug))speaker(E,refs,slug);
  if(['gx5','gx7'].includes(slug))amp(E,slug);
  if(['prime-4','xdj-xz','djm-a9'].includes(slug))mixer(E,slug);
  if(slug==='cdj-3000'){const body=E.partObjects.get('cdj.body');body.children.filter(o=>o.isMesh&&!o.material.wireframe).forEach(o=>o.material=E.mats.black);jog(E.partObjects.get('cdj.jog'));screen(E.partObjects.get('cdj.screen'));const transport=E.partObjects.get('cdj.transport');for(let i=0;i<12;i++)transport.add(at(bevel(13,3,9,.7,i===1?E.mats.amber:E.mats.black),(i%3)*20+15,0,-290+Math.floor(i/3)*25));for(let i=0;i<4;i++)knob(transport,270,0,-315+i*26,5);panelPrint(E,body,321,445,118.4,'Pioneer DJ    CDJ-3000');}
  if(slug==='sm58'){const grillePart=E.partObjects.get('sm.grille');grillePart.children[0].material=grille(155,160,true);const seam=new T.Mesh(new T.TorusGeometry(25.5,.65,8,64),E.mats.silver);seam.rotation.x=Math.PI/2;grillePart.add(seam);const handle=E.partObjects.get('sm.handle');faceLabel(E,handle,'SHURE\nSM58',17,11,0,106,14.2,{fg:'#e0e2e4',bg:'#25272a'});}
  if(slug==='tl60'){const tube=E.partObjects.get('tl.tube');tube.children[0].material=new T.MeshBasicMaterial({color:0xf1fcff,toneMapped:false});for(const radius of [25.2,28,32]){const m=new T.MeshBasicMaterial({color:0xb9eafa,transparent:true,opacity:radius===25.2?.16:.035,depthWrite:false,side:T.BackSide,toneMapped:false});tube.add(at(new T.Mesh(new T.CylinderGeometry(radius,radius,670,48,1,true),m),0,375,0));}faceLabel(E,E.partObjects.get('tl.mount'),'Godox',25,10,0,729,25.8,{fg:'#d6d9dd',bg:'#101114'});}
  // Detail added after addPart must retain pick and highlight ownership.
  E.pickables=[];for(const [id,part] of E.partObjects)part.traverse(o=>{if(o.isMesh){o.userData.componentId=id;E.pickables.push(o);}});
  E.scene.updateMatrixWorld(true);const bounds=new T.Box3();root3.traverse(o=>{if(!o.isMesh||o.material.wireframe)return;let node=o;while(node&&node.visible)node=node.parent;if(node)return;bounds.expandByObject(o);});E.productBounds=bounds;E.productFloorY=bounds.min.y-1;
  const [w,h,d]=E.catalog.dimensions_mm,scale=Math.max(w,h,d);
  E.scene.traverse(o=>{if(o.material?.isShadowMaterial){o.position.y=E.productFloorY;o.visible=false;}});
  const shadow=texture(256,256,x=>{const gradient=x.createRadialGradient(128,128,12,128,128,125);gradient.addColorStop(0,'rgba(0,0,0,.32)');gradient.addColorStop(.4,'rgba(0,0,0,.19)');gradient.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gradient;x.fillRect(0,0,256,256);});const contact=new T.Mesh(new T.PlaneGeometry(w*1.65,d*1.65),new T.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false,toneMapped:false}));contact.name='nnc-contact-shadow';contact.rotation.x=-Math.PI/2;contact.position.set(0,E.productFloorY+.1,0);contact.rotation.z=-root3.rotation.y;E.scene.add(contact);
  if(E.renderer){E.renderer.shadowMap.type=T.PCFSoftShadowMap;E.renderer.toneMappingExposure=1.05;
   E.scene.traverse(light=>{if(light.isHemisphereLight)light.intensity=1.2;if(light.isDirectionalLight){light.intensity=light.castShadow?3.4:1.5;if(light.castShadow){light.position.set(-scale,scale*1.7,scale*1.5);light.target.position.copy(bounds.getCenter(new T.Vector3()));E.scene.add(light.target);light.shadow.camera.left=light.shadow.camera.bottom=-scale;light.shadow.camera.right=light.shadow.camera.top=scale;light.shadow.camera.near=.5;light.shadow.camera.far=scale*6;light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.0003;light.shadow.normalBias=.35;light.shadow.camera.updateProjectionMatrix();}}});
   const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,i===2?'#ffffff':'#cdd2da');g.addColorStop(.55,'#757d86');g.addColorStop(1,'#343940');x.fillStyle=g;x.fillRect(0,0,128,128);if(i%2===0){x.fillStyle='#f9fbff';x.fillRect(25,10,40,100);}return c;});const cube=new T.CubeTexture(faces);cube.needsUpdate=true;const pmrem=new T.PMREMGenerator(E.renderer),environment=pmrem.fromCubemap(cube);E.scene.environment=environment.texture;E.scene.userData.productEnvironment=environment;pmrem.dispose();cube.dispose();
  }
  E.productShell=refs.shell;E.productExterior=refs.productExterior;E.productExteriors=[];const outer=refs.productExterior||E.partObjects.get(slug==='cdj-3000'?'cdj.body':slug==='prime-4'?'p4.body':slug==='xdj-xz'?'xz.body':slug==='djm-a9'?'a9.body':'');if(outer)outer.traverse(o=>{if(o.isMesh&&!o.material.wireframe)E.productExteriors.push(o);});const dispose=E.dispose.bind(E);E.dispose=function(){E.scene.userData.productEnvironment?.dispose();E.scene.environment=null;dispose();};E.root.dataset.productDetail='true';
 }
 window.NNCProduct={prepare,finish,frame,bevel,grille,material,faceLabel,screw,knob,at};
})();
