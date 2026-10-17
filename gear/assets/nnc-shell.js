// Presentation and local preferences for the existing equipment-model runtime.
// This adapter owns no renderer, camera, catalog or simulator implementation.
(() => {
 'use strict';
 const root=document.querySelector('#bench-root');
 const gearSelect=root.querySelector('[data-gear-select]'),gearOpen=root.querySelector('[data-gear-open]');
 gearSelect.addEventListener('change',()=>{gearOpen.href=gearSelect.value;});
 const preferences=window.NNCAppearance,{colours,validate}=preferences;
 let settings=preferences.read();
 let explorer,grid,outline;
 const css=name=>getComputedStyle(root).getPropertyValue(name).trim();
 function apply(){
  preferences.applyColours(settings);
  root.dataset.customPanel=String(!!settings.panel);root.dataset.inspectorSize=settings.size||'standard';root.dataset.inspectorSide=settings.side||'right';
  for(const [key,token] of Object.entries(colours)){const input=root.querySelector(`[data-appearance="${key}"]`);if(input)input.value=css(token);}
  root.querySelector('[data-appearance="grid"]').checked=settings.grid!==false;
  root.querySelector('[data-appearance="size"]').value=settings.size||'standard';root.querySelector('[data-appearance="side"]').value=settings.side||'right';
  const theme=root.querySelector('[data-workbench-theme]');if(theme&&window.fmpTheme)theme.value=window.fmpTheme.preference;
  if(grid){grid.visible=settings.grid!==false;for(const material of [].concat(grid.material)){material.color.set(css('--nnc-grid-colour'));material.opacity=Number(css('--nnc-grid-opacity'));material.transparent=true;}}
  if(explorer){explorer.accentColor=null;for(const material of explorer.tints.values())material.dispose();explorer.tints.clear();explorer.highlight();explorer.requestRender();}
 }
 function save(){return preferences.write(settings);}
 const dialog=root.querySelector('[data-appearance-dialog]');
 root.querySelectorAll('[data-appearance-open]').forEach(button=>button.addEventListener('click',()=>{apply();dialog.showModal();}));
 root.querySelector('[data-appearance-close]').addEventListener('click',()=>dialog.close());
 root.querySelector('[data-appearance-reset]').addEventListener('click',()=>{settings={};const saved=save();apply();root.querySelector('[data-appearance-status]').textContent=saved?'Default appearance restored.':'Defaults apply here; this browser could not save the reset.';});
 root.querySelectorAll('[data-appearance]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.appearance;settings=validate({...settings,[key]:input.type==='checkbox'?input.checked:input.value});const saved=save();apply();root.querySelector('[data-appearance-status]').textContent=saved?'Saved for every gear model on this device.':'Changes apply here; this browser could not save them.';}));
 root.querySelector('[data-workbench-theme]').addEventListener('change',event=>window.fmpTheme?.set(event.target.value));
 const inspectorButton=root.querySelector('[data-inspector-toggle]');
 function inspect(open){root.dataset.inspector=open?'open':'closed';inspectorButton.setAttribute('aria-expanded',String(open));}
 inspectorButton.addEventListener('click',()=>inspect(root.dataset.inspector!=='open'));
 root.querySelector('[data-inspector-close]').addEventListener('click',()=>{inspect(false);inspectorButton.focus();});
 root.querySelector('[data-find-component]').addEventListener('click',()=>{inspect(true);root.querySelector('[data-search]').focus();});
 root.querySelector('[data-focus-selection]').addEventListener('click',()=>explorer?.focusSelected());
 root.querySelector('[data-clear-selection]').addEventListener('click',()=>{explorer?.clearSelection();const fragment=new URLSearchParams(location.hash.slice(1));fragment.delete('part');history.replaceState(null,'',location.pathname+location.search+(fragment.size?'#'+fragment.toString():''));});
 const fullscreen=root.querySelector('[data-fullscreen]');fullscreen.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch{root.querySelector('[data-workbench-status]').textContent='Full screen is unavailable in this browser.';}});
 document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'Exit full screen':'Full screen';fullscreen.setAttribute('aria-pressed',String(!!document.fullscreenElement));});
 document.addEventListener('keydown',event=>{if(dialog.open)return;if(event.key==='Escape'){if(root.dataset.inspector==='open'){inspect(false);inspectorButton.focus();}return;}if(/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;if(event.key==='/'){event.preventDefault();root.querySelector('[data-find-component]').click();}if(event.key.toLowerCase()==='f'){event.preventDefault();explorer?.focusSelected();}});
 const viewSelect=root.querySelector('[data-nnc-view]');viewSelect.addEventListener('change',()=>root.querySelector(`[data-view="${viewSelect.value}"]`)?.click());
 const syncView=()=>{const active=root.querySelector('[data-view][aria-pressed="true"]');if(active)viewSelect.value=active.dataset.view;};
 new MutationObserver(syncView).observe(root.querySelector('.viewbar'),{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 document.addEventListener('fmp-theme',apply);
 function clearOutline(){if(!outline)return;outline.traverse(object=>{object.geometry?.dispose();if(object.material)object.material.dispose();});explorer.scene.remove(outline);outline=null;}
 function highlight(){
  clearOutline();const part=explorer.partObjects.get(explorer.selected);
  if(part){
   explorer.scene.updateMatrixWorld(true);outline=new THREE.Group();outline.name='nnc-selection-outline';
   part.traverse(mesh=>{if(!mesh.isMesh)return;if(mesh.material.wireframe)return;const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,28),new THREE.LineBasicMaterial({color:css('--nnc-highlight'),transparent:true,opacity:Number(css('--nnc-outline-opacity')),depthTest:false,depthWrite:false}));edges.matrix.copy(mesh.matrixWorld);edges.matrixAutoUpdate=false;edges.renderOrder=5;outline.add(edges);});
   explorer.scene.add(outline);
  }
  const component=explorer.componentMap.get(explorer.selected);root.querySelector('[data-selection-title]').textContent=component?.label||'Choose a component';root.querySelector('[data-selection-category]').textContent=component?.category||'Click the model or use Find component';
  root.querySelector('[data-clear-selection]').hidden=!component;root.querySelector('[data-focus-selection]').disabled=!component;
 }
 window.NNCWorkbench={mount(instance){
  explorer=instance;
  const view=instance.setView.bind(instance);instance.setView=function(name){view(name);if(name==='overview')NNCProduct.frame(instance);};
  const resize=instance.resize.bind(instance);instance.resize=function(){resize();if(instance.cfg.currentView==='overview')NNCProduct.frame(instance);};
  const render=instance.cfg.renderSim;instance.cfg.renderSim=function(e){render?.(e);if(e.productShell)for(const surface of e.productExteriors||[])surface.visible=e.productShell.visible;};
  const size=Math.max(...instance.catalog.dimensions_mm)*5;grid=new THREE.GridHelper(size,24,css('--nnc-grid-colour'),css('--nnc-grid-colour'));grid.geometry.attributes.color.array.fill(1);grid.geometry.attributes.color.needsUpdate=true;grid.position.y=(instance.productFloorY??0)-2;instance.scene.add(grid);
  const original=instance.highlight.bind(instance);instance.highlight=function(){original();highlight();};
  const select=instance.select.bind(instance);instance.select=function(id){select(id);if(instance.componentMap.has(id))inspect(true);};
  apply();syncView();inspect(!!instance.selected);instance.requestRender();return instance;
 }};
 apply();syncView();
})();
