// NNC mobile panes share the existing explorer and preserve its selection state.
document.querySelectorAll('[data-nnc-panel]').forEach(button=>button.addEventListener('click',()=>{
 const workspace=button.closest('.workspace');workspace.dataset.panel=button.dataset.nncPanel;
 workspace.querySelectorAll('[data-nnc-panel]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 window.dispatchEvent(new Event('resize'));
}));

document.querySelector('[data-nnc-view]')?.addEventListener('change',event=>{
 document.querySelector(`[data-view="${event.target.value}"]`)?.click();
});
// Reset and other runtime actions also change presets through the view buttons.
const viewbar=document.querySelector('.viewbar');
const viewSelect=document.querySelector('[data-nnc-view]');
const syncView=()=>{
 const active=viewbar?.querySelector('[data-view][aria-pressed="true"]');
 if(active&&viewSelect)viewSelect.value=active.dataset.view;
};
if(viewbar)new MutationObserver(syncView).observe(viewbar,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
syncView();
