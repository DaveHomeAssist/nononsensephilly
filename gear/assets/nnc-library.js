(() => {
 const search=document.querySelector('#gear-search'),cards=[...document.querySelectorAll('[data-gear]')];let category='all';
 function filter(){const term=search.value.trim().toLowerCase();let count=0;for(const card of cards){card.hidden=!(category==='all'||card.dataset.category===category)||!card.dataset.search.includes(term);if(!card.hidden)count++;}document.querySelector('[data-results]').textContent=count+' '+(count===1?'model':'models');document.querySelector('[data-empty]').hidden=count!==0;}
 search.addEventListener('input',filter);
 document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));filter();document.querySelector('#gear-list').scrollTop=0;}));
 document.querySelector('[data-clear-search]').addEventListener('click',()=>{search.value='';document.querySelector('[data-filter="all"]').click();search.focus();});
 const theme=document.querySelector('[data-model-theme]'),syncTheme=()=>{if(window.fmpTheme)theme.value=window.fmpTheme.preference;};theme.addEventListener('change',()=>window.fmpTheme?.set(theme.value));document.addEventListener('fmp-theme',syncTheme);syncTheme();
})();
