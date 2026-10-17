// NNC mobile panes share the existing explorer and preserve its selection state.
document.querySelectorAll('[data-nnc-panel]').forEach(button=>button.addEventListener('click',()=>{
 const workspace=button.closest('.workspace');workspace.dataset.panel=button.dataset.nncPanel;
 workspace.querySelectorAll('[data-nnc-panel]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 window.dispatchEvent(new Event('resize'));
}));

document.querySelector('[data-nnc-view]')?.addEventListener('change',event=>{
 document.querySelector(`[data-view="${event.target.value}"]`)?.click();
});
