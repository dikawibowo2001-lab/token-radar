/* Token Radar dashboard — vanilla JS, no network, all data from ../data.js (window.RADAR).
   Views: the board (sortable, filterable), a detail view per protocol, the live-token
   table (protocols that already trade, never ranked), and the methodology panel.
   Shot scenes for screenshots: ?shot=board | ?shot=detail | ?shot=filtered — each sets
   window.__shotReady once the scene has rendered. */
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'Token Radar: no data (data.js missing).'; return; }
  var rows = D.rows, live = D.live;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) { if (v === null || v === undefined) return '—'; return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
  function pctCls(v) { if (v === null || v === undefined) return 'flat'; return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
  function ageLabel(d) { if (d === null || d === undefined) return 'unknown'; if (d < 30) return d + 'd'; if (d < 365) return Math.floor(d / 30) + 'mo'; return (d / 365).toFixed(1) + 'y'; }
  function $(id) { return document.getElementById(id); }

  /* ---------- header + stats ---------- */
  $('asof').textContent = 'Snapshot ' + D.as_of + '  ·  model ' + D.model_version;
  $('src').textContent = D.source.replace(/^DefiLlama /, 'DefiLlama ');
  $('foot-src').textContent = D.source;
  $('stats').innerHTML = [
    ['Protocols scanned', '758', 'at or above $5M TVL'],
    ['Watchlist', D.watchlist_size, 'at or above $50M, no token recorded'],
    ['Board rows', D.board_size, D.early_size + ' early finds below the floor'],
    ['Total implied value', money(D.total_implied_usd), 'sum of all 200 rows']
  ].map(function (s) { return '<div class="stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div><div class="s">' + s[2] + '</div></div>'; }).join('');

  /* ---------- state, filters, sort ---------- */
  var state = { q: '', cat: '', chain: '', signal: '', watch: false, sort: 'rank', dir: 1, selected: null };
  var SORT_DESC = { implied: true, tvl: true, chg: true, signal: true, age: true };

  function counts(key) {
    var m = {};
    rows.forEach(function (r) { (key === 'chains' ? r.chains : [r[key] || 'Uncategorized']).forEach(function (v) { m[v] = (m[v] || 0) + 1; }); });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a] || (a < b ? -1 : 1); }).map(function (k) { return [k, m[k]]; });
  }
  function fillSelect(el, label, entries) {
    el.innerHTML = '<option value="">' + label + '</option>' + entries.map(function (e) { return '<option value="' + esc(e[0]) + '">' + esc(e[0]) + ' (' + e[1] + ')</option>'; }).join('');
  }
  fillSelect($('f-cat'), 'Category: all', counts('category'));
  fillSelect($('f-chain'), 'Chain: all', counts('chains'));

  function filtered() {
    var q = state.q.toLowerCase();
    return rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (state.cat && (r.category || 'Uncategorized') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.signal && r.signal_band !== state.signal) return false;
      if (state.watch && !r.watchlist) return false;
      return true;
    });
  }
  function sortVal(r, key) {
    switch (key) {
      case 'rank': return r.rank;
      case 'name': return r.name.toLowerCase();
      case 'category': return (r.category || 'Uncategorized').toLowerCase();
      case 'tvl': return r.tvl_usd;
      case 'chg': return r.change_7d === null ? -Infinity : r.change_7d;
      case 'implied': return r.implied_value_usd;
      case 'signal': return r.signal;
      case 'age': return r.age_days === null ? -1 : r.age_days;
      default: return r.rank;
    }
  }
  function sorted(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var va = sortVal(a, key), vb = sortVal(b, key);
      var c = va < vb ? -1 : va > vb ? 1 : a.rank - b.rank;
      return c * dir;
    });
  }

  function renderBoard() {
    var list = sorted(filtered());
    $('count').textContent = list.length + ' of ' + rows.length + ' rows';
    $('rows').innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (r.rank <= 3 ? 'top3' : '') + '">' +
        '<td class="num rank">#' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.watchlist ? '<span class="badge wl">WATCHLIST</span>' : '') + '<span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + (r.chains.length > 3 ? '<span class="chip">+' + (r.chains.length - 3) + '</span>' : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td>' +
        '<td class="num"><span class="sig ' + r.signal_band + '">' + r.signal + ' · ' + r.signal_band + '</span></td></tr>';
    }).join('');
    document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
    });
  }

  /* ---------- detail view ---------- */
  function bySlug(slug) { return rows.filter(function (r) { return r.slug === slug; })[0]; }
  function byRank(rank) { return rows.filter(function (r) { return r.rank === rank; })[0]; }

  function showView(name) {
    ['board', 'detail', 'live', 'method'].forEach(function (v) { $('view-' + v).classList.toggle('hidden', v !== name); });
    ['board', 'live', 'method'].forEach(function (v) { $('tab-' + v).classList.toggle('active', v === name || (v === 'board' && name === 'detail')); });
  }

  function openDetail(slug) {
    var r = bySlug(slug);
    if (!r) return;
    state.selected = slug;
    var m = r.model;
    var base = r.tvl_usd * m.peer_multiple;
    var flag = r.flag ? '<div class="flag">⚠ ' + esc(r.flag) + '</div>' : '';
    $('detail').innerHTML =
      '<div class="d-title"><h2>' + esc(r.name) + '</h2><span class="slug">' + esc(r.slug) + '</span>' +
      '<span class="badge wl" style="' + (r.watchlist ? '' : 'display:none') + '">WATCHLIST</span>' +
      '<span class="sig ' + r.signal_band + '">' + r.signal + ' · ' + r.signal_band + ' signal</span></div>' +
      '<div class="d-grid">' +
      cell('Rank', '#' + r.rank + ' of ' + rows.length, 'by implied value') +
      cell('TVL', moneyFull(r.tvl_usd), '7d ' + pct(r.change_7d)) +
      cell('Category', esc(r.category || 'Uncategorized'), esc(r.chains.join(', ') || '—')) +
      cell('Age with no token', ageLabel(r.age_days), r.listed_at ? 'tracked since ' + r.listed_at : 'listing date unreported') +
      '</div>' + flag +
      '<div class="d-implied"><div class="k" style="color:var(--dim);font-size:11px;letter-spacing:.08em">IMPLIED VALUE — WHAT A LAUNCH WOULD BE WORTH</div>' +
      '<div class="big">' + moneyFull(r.implied_value_usd) + '</div>' +
      '<div class="eq"><b>' + moneyFull(r.tvl_usd) + '</b> TVL × <b>' + m.peer_multiple + '</b> peer multiple' +
      (m.peer_count > 0 ? ' (median mcap/TVL of ' + m.peer_count + ' tokenized ' + esc(r.category || '') + ' peers, shrunk toward the global ' + m.global_median + ')' : ' (no tokenized peer in this category — the global median ' + m.global_median + ')') +
      ' × <b>' + m.growth_multiplier + '</b> growth (' + (m.growth_pct > 0 ? '+' : '') + m.growth_pct + '% 7d) × <b>' + m.maturity_multiplier + '</b> maturity (' + ageLabel(r.age_days) + ') × <b>' + m.chain_multiplier + '</b> breadth (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</div>' +
      '<div class="eq" style="margin-top:8px">Base ' + moneyFull(base) + ' → implied ' + moneyFull(r.implied_value_usd) + '. The peer multiple is the market\'s own price for a dollar of TVL in this category — not a guess.</div></div>' +
      '<h3>Farm plan — ' + esc(r.name) + '</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) {
        var parts = s.split(' Cost: ');
        var cost = parts[1] ? 'Cost: ' + parts[1] : '';
        return '<li>' + esc(parts[0]) + (cost ? '<div class="meta2">' + esc(cost) + '</div>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<p class="hint">This protocol records no token in the snapshot. That is DefiLlama\'s record, not proof — it may still have a token its record does not carry. Never pay to claim an airdrop; real claims cost gas only.</p>';
    showView('detail');
    window.scrollTo(0, 0);
  }
  function cell(k, v, s) { return '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }

  /* ---------- live + peers ---------- */
  $('liverows').innerHTML = live.map(function (r, i) {
    return '<tr><td class="num">' + (i + 1) + '</td><td><strong>' + esc(r.name) + '</strong><span class="sub">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + money(r.mcap_usd) + '</td>' +
      '<td class="num">' + r.mcap_tvl.toFixed(3) + '×</td><td class="num ' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</td></tr>';
  }).join('');
  $('peerrows').innerHTML = D.peers.map(function (p) {
    return '<tr><td>' + esc(p.category) + '</td><td class="num">' + p.peers + '</td><td class="num">' + (p.category_median === null ? '—' : p.category_median.toFixed(3) + '×') + '</td><td class="num"><strong>' + p.multiple.toFixed(3) + '×</strong></td></tr>';
  }).join('');

  /* ---------- events ---------- */
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('q').addEventListener('input', function () { state.q = $('q').value; renderBoard(); });
  $('f-cat').addEventListener('change', function () { state.cat = $('f-cat').value; renderBoard(); });
  $('f-chain').addEventListener('change', function () { state.chain = $('f-chain').value; renderBoard(); });
  $('f-signal').addEventListener('change', function () { state.signal = $('f-signal').value; renderBoard(); });
  $('f-watch').addEventListener('change', function () { state.watch = $('f-watch').checked; renderBoard(); });
  $('f-sort').addEventListener('change', function () { setSort($('f-sort').value); });
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () { setSort(th.getAttribute('data-sort')); });
  });
  function setSort(key) {
    if (state.sort === key) { state.dir = -state.dir; }
    else { state.sort = key; state.dir = SORT_DESC[key] ? -1 : 1; }
    $('f-sort').value = key;
    renderBoard();
  }
  $('tab-board').addEventListener('click', function () { showView('board'); });
  $('tab-live').addEventListener('click', function () { showView('live'); });
  $('tab-method').addEventListener('click', function () { showView('method'); });
  $('back').addEventListener('click', function () { showView('board'); });
  $('prev').addEventListener('click', function () { var r = bySlug(state.selected); if (r && r.rank > 1) openDetail(byRank(r.rank - 1).slug); });
  $('next').addEventListener('click', function () { var r = bySlug(state.selected); if (r && r.rank < rows.length) openDetail(byRank(r.rank + 1).slug); });

  /* ---------- shot scenes (deterministic, for screenshots) ---------- */
  renderBoard();
  var shot = new URLSearchParams(window.location.search).get('shot');
  if (shot === 'detail') {
    openDetail(byRank(1).slug);
  } else if (shot === 'filtered') {
    // The board's most common category, sorted by implied value — deterministic from the data.
    var topCat = counts('category')[0][0];
    state.cat = topCat;
    $('f-cat').value = topCat;
    state.sort = 'implied'; state.dir = -1; $('f-sort').value = 'implied';
    renderBoard();
  }
  requestAnimationFrame(function () { setTimeout(function () { window.__shotReady = true; }, 60); });
})();
