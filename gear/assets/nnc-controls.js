// NNC local practice adapter. Inspection stays inert; no equipment output.
(() => {
 'use strict';
 function normalise(spec,value){
  if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Control value must be finite');
  const bounded=Math.min(spec.max,Math.max(spec.min,value));
  return Number((spec.min+Math.round((bounded-spec.min)/spec.step)*spec.step).toFixed(6));
 }
 // Relative training levels, deliberately separate from manufacturer calibration.
 function demoLevels(kind,controls,demo){
  if(!['gx7','djm-a9'].includes(kind))throw new Error('Unsupported demo model');
  const position=id=>normalise({min:0,max:100,step:1},controls[id])/100;
  const source=normalise({min:0,max:150,step:1},demo.level)/100*(demo.running===true?1:0);
  if(kind==='gx7'){
   const power=normalise({min:0,max:1,step:1},controls['gx7.ctl.power']);
   return {input:source,channels:[1,2].map(i=>source*position('gx7.ctl.gain'+i)*power)};
  }
  const channels=[1,2,3,4].map(i=>source*position('a9.ch.'+i+'.fader'));
  const cross=position('a9.xfader.position');
  return {input:source,channels,mix:(channels[0]+channels[1])/2*(1-cross)+(channels[2]+channels[3])/2*cross};
 }
 function light(E,mesh,on){
  const base=E.tinted.get(mesh)?.base||mesh.material;
  if(!mesh.userData.nncSignalColour)mesh.userData.nncSignalColour=base.color.clone();
  // Update both the original and any selected material, so deselection cannot
  // restore an obsolete meter state or hide a lit segment.
  for(const m of new Set([base,mesh.material])){
   m.color.copy(mesh.userData.nncSignalColour).multiplyScalar(on?1:.1);
   m.emissive.copy(mesh.userData.nncSignalColour);m.emissiveIntensity=on?1.2:0;
  }
  mesh.userData.nncSignalLit=on;
 }
 function meter(E,segments,value){
  const count=value<=0?0:Math.max(1,Math.floor(Math.min(1,value)*segments.length));
  segments.forEach((mesh,i)=>light(E,mesh,i<count));
 }
 function mount(E,bindings,{view,note,demo}){
  const root=E.root,canvas=E.canvas,byId=new Map(),inputs=new Map(),rows=new Map();
  for(const c of bindings){
   if(byId.has(c.id)||!E.componentMap.has(c.component)||!E.catalog.sources.some(s=>s.source_id===c.source))throw new Error('Invalid control binding: '+c.id);
   if(!(c.max>c.min&&c.step>0)||!c.object)throw new Error('Invalid control range or mesh: '+c.id);
   byId.set(c.id,c);c.object.traverse(o=>{if(o.isMesh)o.userData.nncControl=c.id;});
   for(const object of c.targets||[])object.traverse(o=>{if(o.isMesh)o.userData.nncControl=c.id;});
  }
  const defaults=Object.fromEntries(bindings.map(c=>[c.id,normalise(c,c.initial)]));
  E.cfg.initialSim.controls={...defaults};E.sim.controls={...defaults};
  const demoDefault={running:false,level:75};E.cfg.initialSim.demo={...demoDefault};E.sim.demo={...demoDefault};
  let enabled=false,active='',gesture=null,nativeStart=null,outline=null;
  const history=[],snapshot=()=>({...E.sim.controls}),equal=(a,b)=>bindings.every(c=>a[c.id]===b[c.id]);
  const element=(tag,attrs={},text='')=>{const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);el.textContent=text;return el;};
  const toolbar=element('div',{class:'nnc-control-toolbar','aria-label':'Local control practice'});
  const mode=element('button',{'data-control-mode':'','aria-pressed':'false','aria-controls':'nnc-control-panel'},'Operate');
  const undo=element('button',{'data-control-undo':''},'Undo');
  const reset=element('button',{'data-control-reset':''},'Reset practice');
  const signalToggle=element('button',{'data-demo-toggle':'','aria-pressed':'false'},'Start demo');
  toolbar.append(mode,signalToggle,undo,reset);root.querySelector('.viewbar').append(toolbar);
  const panel=element('section',{id:'nnc-control-panel',class:'nnc-control-panel','aria-label':'Local practice controls'});
  panel.append(element('h2',{},'Hands on controls'));
  const help=element('p',{class:'small'},'Choose Operate to use these controls. Changes last until you leave or reload this model.');panel.append(help);
  const signal=element('section',{class:'nnc-demo','aria-label':'Silent demo signal'});
  signal.append(element('h3',{},'Demo signal · silent'));
  const signalStatus=element('p',{'data-demo-status':'',role:'status',class:'small'});signal.append(signalStatus);
  const sourceLabel=element('label',{for:'nnc-demo-level'},'Source level '),sourceValue=element('output',{for:'nnc-demo-level'});
  const sourceInput=element('input',{id:'nnc-demo-level',type:'range',min:0,max:150,step:1,value:75,'data-demo-level':'','aria-label':'Demo source level'});
  sourceLabel.append(sourceValue);signal.append(sourceLabel,sourceInput);
  const meterRows=[];
  const meterLabels=demo.kind==='gx7'?['CH 1 output','CH 2 output']:['CH 1 post-fader','CH 2 post-fader','CH 3 post-fader','CH 4 post-fader','Mix output'];
  for(const [i,label] of meterLabels.entries()){
   const row=element('div',{class:'nnc-demo-meter'}),name=element('span',{},label),value=element('output');
   const bar=element('meter',{min:0,max:150,low:75,high:100,optimum:60,value:0,'aria-label':label,'data-demo-meter':i});
   row.append(name,value,bar);meterRows.push({row,value,bar});
  }
  const signalDetails=element('details');signalDetails.append(element('summary',{},'Demo routing & limits'));
  signalDetails.append(element('p',{class:'small'},demo.kind==='gx7'?
   'Equal steady inputs → gain → output. Power must be on. Crossover filtering is not simulated.':
   'Steady inputs → channel faders → crossfader → mix. Training assignment: CH 1/2 = A (left), CH 3/4 = B (right). Model channel LEDs show input; these bars show post-fader level.'));
  signalDetails.append(element('p',{class:'small'},'Relative training levels, not dB or measured output. 100% marks demo overload.'));signal.append(signalDetails);
  panel.append(signal);
  const badge=element('span',{class:'nnc-demo-badge','data-demo-badge':''});badge.hidden=true;E.stage.append(badge);
  sourceInput.addEventListener('input',()=>{if(!enabled)return;E.sim.demo.level=normalise({min:0,max:150,step:1},Number(sourceInput.value));render();});
  signalToggle.addEventListener('click',()=>{cancel();finishNative();if(!enabled&&!E.sim.demo.running)return;E.sim.demo.running=!E.sim.demo.running;render();});
  function renderSignal(){
   const state=E.sim.demo,levels=demoLevels(demo.kind,E.sim.controls,state);
   sourceInput.disabled=!enabled;sourceInput.value=state.level;sourceValue.textContent=state.level+'%';sourceInput.setAttribute('aria-valuetext',state.level+'% relative demo input');
   signalToggle.disabled=!enabled&&!state.running;signalToggle.textContent=state.running?'Stop demo':'Start demo';signalToggle.setAttribute('aria-pressed',String(state.running));
   const powerOff=demo.kind==='gx7'&&!E.sim.controls['gx7.ctl.power'];
   const message=state.running?(powerOff?'Demo running · power off, outputs muted':'Demo running · steady silent input'):'Demo stopped · no signal';
   if(signalStatus.textContent!==message)signalStatus.textContent=message;
   const values=demo.kind==='gx7'?levels.channels:[...levels.channels,levels.mix];
   values.forEach((value,i)=>{const percent=Math.round(value*100),row=meterRows[i];row.bar.value=percent;row.bar.setAttribute('aria-valuetext',percent+'%'+(value>=1?' · demo overload':''));row.value.textContent=percent+'%'+(value>=1?' · OVER':'');});
   badge.hidden=!state.running;badge.textContent='SILENT DEMO · '+(powerOff?'power off':demo.kind==='gx7'?values.map((v,i)=>'CH '+(i+1)+' '+Math.round(v*100)+'%').join(' / '):'mix '+Math.round(levels.mix*100)+'%');
   demo.paint(E,levels);E.requestRender();
  }
  const fieldset=element('fieldset',{'aria-label':'Adjust local controls'});panel.append(fieldset);
  const status=element('p',{'data-control-status':'',role:'status',class:'small'});panel.append(status,element('p',{class:'small'},note));
  root.querySelector('.inspector').insertBefore(panel,root.querySelector('.inspector [data-search]').previousElementSibling);
  const readout=element('span',{class:'nnc-control-readout','data-control-readout':''});readout.hidden=true;E.stage.append(readout);
  const oldPartState=E.cfg.partState;
  E.cfg.partState=(e,c)=>bindings.some(b=>b.component===c?.component_id)?(enabled?'Use the model or Hands on controls above. Local practice only.':'Inspection only in this mode. Choose Operate to adjust this control.'):oldPartState?.(e,c)||'';
  function format(c,value){return c.format?c.format(value):value+'% position';}
  for(const c of bindings){
   const row=element('div',{class:'nnc-control-row','data-control-row':c.id});
   const label=element('label',{for:'control-'+c.id},c.label),output=element('output',{for:'control-'+c.id});label.append(output);
   const input=c.kind==='switch'?element('button',{type:'button','aria-label':c.label,'aria-pressed':'false'}):element('input',{type:'range',min:c.min,max:c.max,step:c.step,'aria-label':c.label});
   input.id='control-'+c.id;input.dataset.control=c.id;inputs.set(c.id,{input,output});rows.set(c.id,row);row.append(label,input);const meterIndex=bindings.indexOf(c);if(meterRows[meterIndex])row.append(meterRows[meterIndex].row);fieldset.append(row);
   input.addEventListener('focus',()=>choose(c));
   if(c.kind==='switch')input.addEventListener('click',()=>{const before=snapshot();set(c,E.sim.controls[c.id]===c.min?c.max:c.min);remember(before);announce(c);});
   else{
    input.addEventListener('input',()=>{if(!enabled)return;if(!nativeStart)nativeStart=snapshot();set(c,Number(input.value));});
    input.addEventListener('change',()=>{finishNative();announce(c);});
    input.addEventListener('blur',finishNative);
   }
  }
  function finishNative(){if(nativeStart){remember(nativeStart);nativeStart=null;}}
  function remember(before){if(!equal(before,snapshot())){history.push(before);if(history.length>50)history.shift();}undo.disabled=!history.length;}
  function restore(values){E.sim.controls={...values};for(const c of bindings)c.sync?.(values[c.id],E);E.renderSim();}
  function announce(c){status.textContent=c.label+': '+format(c,E.sim.controls[c.id])+'. Local practice.';}
  function set(c,value){if(!enabled)return;E.sim.controls[c.id]=normalise(c,value);c.sync?.(E.sim.controls[c.id],E);E.renderSim();}
  function choose(c,fromStage=false){
   const wasOpen=root.dataset.inspector==='open';active=c.id;E.select(c.component);
   if(fromStage&&!wasOpen){root.dataset.inspector='closed';root.querySelector('[data-inspector-toggle]').setAttribute('aria-expanded','false');}
   render();E.highlight();
  }
  function clearOutline(){if(outline){E.scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}}
  function drawOutline(){
   clearOutline();const c=byId.get(active),operating=enabled&&c&&E.selected===c.component;
   const parentOutline=E.scene.getObjectByName('nnc-selection-outline');if(parentOutline)parentOutline.visible=!operating;
   if(!operating)return;
   // Keep position marks legible: outline the moving control instead of tinting
   // the entire parent strip (which can contain four independent faders).
   E.partObjects.get(c.component).traverse(o=>{const tint=E.tinted.get(o);if(tint){o.material=tint.base;E.tinted.delete(o);}});
   E.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(c.object);
   outline=new THREE.Box3Helper(box,new THREE.Color(getComputedStyle(root).getPropertyValue('--nnc-highlight').trim()));
   outline.name='nnc-active-control';outline.material.depthTest=false;outline.renderOrder=6;E.scene.add(outline);
  }
  function render(){
   for(const c of bindings){
    if(c.read)E.sim.controls[c.id]=normalise(c,c.read(E));
    const value=E.sim.controls[c.id];c.apply(value);const {input,output}=inputs.get(c.id);output.textContent=format(c,value);
    if(c.kind==='switch'){input.textContent=format(c,value);input.setAttribute('aria-pressed',String(value!==c.min));}
    else{input.value=value;input.setAttribute('aria-valuetext',format(c,value));}
    rows.get(c.id).dataset.active=String(active===c.id&&E.selected===c.component);
   }
   fieldset.disabled=!enabled;root.dataset.controlMode=enabled?'operate':'inspect';mode.setAttribute('aria-pressed',String(enabled));mode.textContent=enabled?'Inspect instead':'Operate';
   undo.disabled=!enabled||!history.length;reset.disabled=!enabled;
   const c=byId.get(active);readout.hidden=!enabled||!c||E.selected!==c.component;
   if(bindings.some(b=>b.component===E.selected))E.operateEl.hidden=true;
   if(!readout.hidden)readout.textContent=c.label+' · '+format(c,E.sim.controls[c.id]);
   help.textContent=enabled?'Local practice · drag knobs vertically or faders along their track. Buttons toggle on release. Use Start demo for silent meter feedback.':'Choose Operate to use these controls. Settings reset when you leave or reload this model.';
   const hint=root.querySelector('.orbitbar .hint');hint.textContent=enabled?'Drag a control to operate · empty space to orbit · Space deselects':'Drag to orbit · scroll to zoom · click only inspects';
   if(enabled)E.hoverEl.textContent=c&&E.selected===c.component?c.label+' · '+(c.kind==='switch'?'click to toggle':c.kind==='knob'?'drag up / down':'drag along the track'):'Local practice · drag a control or use the inspector';
   E.updatePartState();drawOutline();renderSignal();E.requestRender();
  }
  function cancel(){
   if(!gesture)return;const old=gesture;gesture=null;restore(old.before);
   if(canvas.hasPointerCapture?.(old.pointer))canvas.releasePointerCapture(old.pointer);
   status.textContent='Adjustment cancelled.';
  }
  mode.addEventListener('click',()=>{cancel();finishNative();enabled=!enabled;if(enabled){E.setView(view);if(root.dataset.inspector!=='open')root.querySelector('[data-inspector-toggle]').click();}else E.hoverEl.textContent='Click a component to inspect';E.highlight();});
  undo.addEventListener('click',()=>{cancel();finishNative();const previous=history.pop();if(previous)restore(previous);render();status.textContent='Last adjustment undone.';});
  reset.addEventListener('click',()=>{cancel();finishNative();rememberReset();});
  function rememberReset(){const before=snapshot();E.sim.demo={...demoDefault};restore(defaults);remember(before);render();status.textContent='Control positions reset; demo stopped. View and appearance preserved.';}
  // Integrate legacy practice buttons and Reset practice into this same state.
  const oldRender=E.cfg.renderSim;E.cfg.renderSim=function(e){oldRender?.(e);render();};
  const oldAction=E.cfg.onAction;E.cfg.onAction=function(e,a,c){cancel();finishNative();const before=snapshot();oldAction?.(e,a,c);for(const b of bindings)if(b.read)e.sim.controls[b.id]=normalise(b,b.read(e));remember(before);};
  const oldReset=E.cfg.onSim;E.cfg.onSim=function(e,action){oldReset?.(e,action);if(action==='reset'){gesture=null;nativeStart=null;history.length=0;render();}};
  const oldHighlight=E.highlight.bind(E);E.highlight=function(){oldHighlight();if(active&&E.selected!==byId.get(active)?.component)active='';render();};
  const visible=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
  function hit(event){
   const rect=canvas.getBoundingClientRect();E.scene.updateMatrixWorld(true);
   E.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);E.ray.setFromCamera(E.pointer,E.camera);
   const first=E.ray.intersectObjects(E.pickables,false).find(h=>visible(h.object));
   return byId.get(first?.object.userData.nncControl);
  }
  function track(c){
   if(!c.track)return null;const rect=canvas.getBoundingClientRect();
   const project=p=>{const v=c.object.parent.localToWorld(new THREE.Vector3(...p)).project(E.camera);return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};};
   return c.track.map(project);
  }
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  canvas.addEventListener('pointerdown',e=>{
   if(gesture){stop(e);return;}
   if(!enabled||e.button!==0||!e.isPrimary)return;
   const c=hit(e);if(!c)return;
   stop(e);finishNative();const armed=e.pointerType!=='touch'||active===c.id;
   choose(c,true);canvas.focus({preventScroll:true});
   gesture={pointer:e.pointerId,c,x:e.clientX,y:e.clientY,value:E.sim.controls[c.id],before:snapshot(),armed,moved:false,track:track(c)};
   canvas.setPointerCapture(e.pointerId);
  },true);
  canvas.addEventListener('pointermove',e=>{
   if(!gesture)return;if(e.pointerId!==gesture.pointer){stop(e);return;}stop(e);
   const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>5)g.moved=true;
   if(!g.armed||!g.moved||g.c.kind==='switch')return;
   let delta=-dy/160;
   if(g.track){const [a,b]=g.track,tx=b.x-a.x,ty=b.y-a.y,len=tx*tx+ty*ty;if(len<100)return;delta=(dx*tx+dy*ty)/len;}
   set(g.c,g.value+delta*(g.c.max-g.c.min));
  },true);
  canvas.addEventListener('pointerup',e=>{
   if(!gesture)return;stop(e);if(e.pointerId!==gesture.pointer)return;
   const g=gesture;gesture=null;
   if(g.armed&&g.c.kind==='switch'&&!g.moved&&hit(e)?.id===g.c.id)set(g.c,g.value===g.c.min?g.c.max:g.c.min);
   remember(g.before);announce(g.c);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  },true);
  canvas.addEventListener('pointercancel',e=>{if(gesture){stop(e);cancel();}},true);
  canvas.addEventListener('lostpointercapture',cancel);
  canvas.addEventListener('wheel',e=>{if(gesture)stop(e);},{capture:true,passive:false});
  document.addEventListener('keydown',e=>{if(gesture&&(e.key==='Escape'||e.code==='Space')){stop(e);cancel();}},true);
  root.addEventListener('pointerdown',e=>{if(gesture&&e.target!==canvas)cancel();},true);
  root.addEventListener('click',e=>{if(e.target.closest('[data-tab],[data-gear-toggle],[data-appearance-open],[data-view],[data-reset-view]'))cancel();},true);
  window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  canvas.addEventListener('webglcontextlost',cancel);
  render();
  return {bindings,normalise,set:(id,value)=>{const c=byId.get(id);if(!c)throw new Error('Unsupported control: '+id);const before=snapshot();set(c,value);remember(before);},get enabled(){return enabled;}};
 }
 window.NNCControls={mount,normalise,demoLevels,light,meter};
})();
