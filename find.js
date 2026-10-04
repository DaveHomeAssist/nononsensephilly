(function(){
  var dlg = document.getElementById('find-dlg');
  var q = document.getElementById('find-q');
  var list = document.getElementById('find-list');
  var hint = document.getElementById('find-hint');
  var openBtn = document.getElementById('find-open');
  if (!dlg || !q || !list || !openBtn) return;
  var idx = [];
  function go(panel){
    var link = document.querySelector('[data-nav="' + panel + '"]') || document.querySelector('[data-go="' + panel + '"]');
    if (link) link.click();
  }
  function add(kind, title, extra, run){
    title = (title || '').replace(/\s+/g, ' ').trim();
    if (!title) return;
    idx.push({ kind: kind, title: title, hay: (kind + ' ' + title + ' ' + (extra || '')).toLowerCase(), run: run });
  }
  document.querySelectorAll('#event-grid article[data-event]').forEach(function(card){
    var title = (card.querySelector('h3') || {}).textContent || '';
    add('Show', title, card.textContent, function(){
      var b = card.querySelector('[data-event-open]');
      if (b) b.click();
    });
  });
  document.querySelectorAll('[data-artist]').forEach(function(btn){
    var card = btn.closest('.artist');
    var named = card && card.querySelector('.name');
    var name = named ? named.textContent : ((btn.childNodes[0] && btn.childNodes[0].textContent) || btn.textContent || '');
    add('Artist', name, '', function(){ btn.click(); });
  });
  document.querySelectorAll('.rental-card').forEach(function(card){
    var title = (card.querySelector('h3') || {}).textContent || '';
    var spec = card.querySelector('[data-spec]');
    add('Gear', title, card.textContent, function(){
      go('rentals');
      if (spec) spec.click();
    });
  });
  document.querySelectorAll('.faq-item button[aria-controls]').forEach(function(btn){
    var answer = document.getElementById(btn.getAttribute('aria-controls'));
    add('FAQ', btn.textContent, answer ? answer.textContent : '', function(){
      go('faq');
      if (btn.getAttribute('aria-expanded') !== 'true') btn.click();
      btn.focus();
    });
  });
  var seen = {};
  idx = idx.filter(function(item){
    var k = item.kind + '|' + item.title.toLowerCase();
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  });
  var sel = 0;
  var shown = [];
  function esc(s){ return s.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function closeFind(){ dlg.hidden = true; openBtn.focus(); }
  function openFind(){
    document.querySelectorAll('dialog[open]').forEach(function(d){ d.close(); });
    dlg.hidden = false; q.value = ''; render(''); q.focus(); }
  function render(raw){
    var needle = raw.trim().toLowerCase();
    shown = !needle ? idx.slice(0, 8) : idx.filter(function(item){ return item.hay.indexOf(needle) !== -1; })
      .map(function(item, i){
        var t = item.title.toLowerCase();
        return { item: item, rank: t.indexOf(needle) === 0 ? 0 : t.indexOf(needle) !== -1 ? 1 : 2, i: i };
      })
      .sort(function(a, b){ return a.rank - b.rank || a.i - b.i; })
      .map(function(r){ return r.item; })
      .slice(0, 12);
    sel = 0;
    list.innerHTML = '';
    if (!shown.length){
      hint.textContent = needle ? 'Nothing matches.' : 'Shows, artists, gear, questions.';
      return;
    }
    hint.textContent = shown.length + (shown.length === 1 ? ' match' : ' matches');
    shown.forEach(function(item, i){
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.innerHTML = '<small>' + item.kind + '</small>' + esc(item.title);
      b.addEventListener('click', function(){ var run = item.run; closeFind(); run(); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }
  function move(delta){
    if (!shown.length) return;
    sel = (sel + delta + shown.length) % shown.length;
    var buttons = list.querySelectorAll('button');
    buttons.forEach(function(b, i){ b.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
    if (buttons[sel]) buttons[sel].scrollIntoView({ block: 'nearest' });
  }
  openBtn.addEventListener('click', openFind);
  dlg.addEventListener('click', function(e){ if (e.target === dlg) closeFind(); });
  q.addEventListener('input', function(){ render(q.value); });
  q.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
    else if (e.key === 'Enter'){
      e.preventDefault();
      if (shown[sel]){ var run = shown[sel].run; closeFind(); run(); }
    } else if (e.key === 'Escape'){ e.preventDefault(); closeFind(); }
  });
  document.addEventListener('keydown', function(e){
    var tag = (e.target && e.target.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
    if (e.key === 'Escape' && !dlg.hidden){ closeFind(); return; }
    if (typing) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')){ e.preventDefault(); dlg.hidden ? openFind() : closeFind(); }
    else if (e.key === '/'){ e.preventDefault(); openFind(); }
  });
})();
