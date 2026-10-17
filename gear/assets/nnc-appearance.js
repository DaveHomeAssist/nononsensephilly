// One validated preference contract for the library and every NNC workbench.
(() => {
 'use strict';
 const key='nncGearAppearance.v1';
 const colours={background:'--nnc-scene-bg',panel:'--nnc-panel',highlight:'--nnc-highlight',gridColour:'--nnc-grid-colour'};
 function validate(value){const next={};if(!value||typeof value!=='object')return next;for(const name of Object.keys(colours))if(typeof value[name]==='string'&&/^#[0-9a-f]{6}$/i.test(value[name]))next[name]=value[name];if(typeof value.grid==='boolean')next.grid=value.grid;if(['compact','standard','wide'].includes(value.size))next.size=value.size;if(['left','right'].includes(value.side))next.side=value.side;return next;}
 function read(){try{return validate(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return {};}}
 function write(value){try{localStorage.setItem(key,JSON.stringify(validate(value)));return true;}catch{return false;}}
 function applyColours(value){const settings=validate(value),root=document.documentElement;for(const [name,token] of Object.entries(colours)){if(settings[name])root.style.setProperty(token,settings[name]);else root.style.removeProperty(token);}if(settings.panel){const c=settings.panel.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);const light=.2126*c[0]+.7152*c[1]+.0722*c[2]>.179;root.style.setProperty('--nnc-panel-ink',light?'var(--nnc-ink-on-light)':'var(--nnc-ink-on-dark)');}else root.style.removeProperty('--nnc-panel-ink');}
 window.NNCAppearance={colours,validate,read,write,applyColours};applyColours(read());
})();
