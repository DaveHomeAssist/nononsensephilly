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
  // Upcoming shows first, so the empty search already shows what's next.
  document.querySelectorAll('.ev-up-grid article[data-event]').forEach(function(card){
    var title = (card.querySelector('h3') || {}).textContent || '';
    add('Next show', title, card.textContent, function(){
      var b = card.querySelector('[data-event-open]');
      if (b) b.click();
    });
  });
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
  var shown = [];
  var returnFocus = openBtn;
  function closeFind(){
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('close', function(){
    if (dlg.open) return; // An earlier close event must not hide a newly reopened search.
    dlg.hidden = true;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  });
  function openFind(){
    returnFocus = document.activeElement;
    document.querySelectorAll('dialog[open]').forEach(function(d){ d.close(); });
    dlg.hidden = false;
    q.value = '';
    render('');
    dlg.showModal();
    q.focus();
  }
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
    list.replaceChildren();
    if (!shown.length){
      hint.textContent = needle ? 'Nothing matches.' : 'Shows, artists, gear, questions.';
      return;
    }
    hint.textContent = shown.length + (shown.length === 1 ? ' match' : ' matches');
    shown.forEach(function(item, i){
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      var kind = document.createElement('small');
      kind.textContent = item.kind;
      b.append(kind, document.createTextNode(item.title));
      b.addEventListener('click', function(){ var run = item.run; closeFind(); run(); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }
  function focusResult(index){
    var buttons = list.querySelectorAll('button');
    if (!buttons.length) return;
    buttons[(index + buttons.length) % buttons.length].focus();
  }
  openBtn.addEventListener('click', openFind);
  document.getElementById('find-close').addEventListener('click', closeFind);
  dlg.addEventListener('click', function(e){ if (e.target === dlg) closeFind(); });
  q.addEventListener('input', function(){ render(q.value); });
  q.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); focusResult(0); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); focusResult(-1); }
    else if (e.key === 'Enter'){
      e.preventDefault();
      var first = list.querySelector('button');
      if (first) first.click();
    }
  });
  list.addEventListener('keydown', function(e){
    var buttons = Array.from(list.querySelectorAll('button'));
    var index = buttons.indexOf(e.target);
    if (index < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusResult(index + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusResult(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusResult(0); }
    else if (e.key === 'End') { e.preventDefault(); focusResult(-1); }
  });
  dlg.addEventListener('keydown', function(e){
    if (e.key !== 'Tab') return;
    var nodes = Array.from(dlg.querySelectorAll('button:not([disabled]), input:not([disabled])'));
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', function(e){
    var tag = (e.target && e.target.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
    if (e.key === 'Escape' && dlg.open){ e.preventDefault(); closeFind(); return; }
    if (typing) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')){ e.preventDefault(); dlg.open ? closeFind() : openFind(); }
    else if (e.key === '/'){ e.preventDefault(); openFind(); }
  });
})();
