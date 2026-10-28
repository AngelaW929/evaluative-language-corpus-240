(() => {
  const corpus = window.CORPUS_DATA;
  if (!corpus || !Array.isArray(corpus.documents)) {
    document.body.innerHTML = '<main style="padding:40px;font-family:sans-serif">语料数据加载失败，请刷新页面。</main>';
    return;
  }

  const docs = corpus.documents;
  const palette = {
    '医学': '#a25058', '计算机科学': '#315f91', '语言学': '#9c6b2f',
    '环境科学': '#648260', '生物学': '#7c5e89', '社会科学': '#b65f43'
  };
  const state = { view: 'library', page: 1, pageSize: 20, query: '', set: '', subject: '', journal: '', year: '', section: '', sort: 'corpus', concordance: [] };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const debounce = (fn, wait = 160) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };
  const subjectColor = subject => palette[subject] || '#607080';
  const sectionSentences = section => section.p.flat();
  const docText = doc => `${doc.t} ${doc.au} ${doc.doi} ${doc.j} ${doc.c.flatMap(s => sectionSentences(s)).join(' ')}`.toLowerCase();
  docs.forEach(doc => { doc._search = docText(doc); });

  const stats = corpus.stats;
  $('statDocs').textContent = stats.documents.toLocaleString('zh-CN');
  $('statSections').textContent = stats.sections.toLocaleString('zh-CN');
  $('statSentences').textContent = stats.sentences.toLocaleString('zh-CN');
  $('statWords').textContent = `${(stats.words / 10000).toFixed(1)} 万`;

  function optionList(values, target) {
    [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')).forEach(value => {
      const option = document.createElement('option');
      option.value = value; option.textContent = value; target.append(option);
    });
  }
  optionList(docs.map(d => d.s), $('filterSubject'));
  optionList(docs.map(d => d.j), $('filterJournal'));
  optionList(docs.map(d => d.y), $('filterYear'));
  optionList(docs.map(d => d.s), $('concordanceSubject'));

  const subjects = [...new Set(docs.map(d => d.s))];
  $('subjectRibbon').innerHTML = `<button class="subject-chip active" data-subject=""><span class="subject-dot" style="--subject-color:#20242d"></span><span><strong>全部学科</strong><small>${docs.length} 篇</small></span></button>` + subjects.map(subject => {
    const count = docs.filter(d => d.s === subject).length;
    return `<button class="subject-chip" data-subject="${escapeHtml(subject)}"><span class="subject-dot" style="--subject-color:${subjectColor(subject)}"></span><span><strong>${escapeHtml(subject)}</strong><small>${count} 篇</small></span></button>`;
  }).join('');

  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === view));
    document.querySelector(`[data-panel="${view}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  document.querySelectorAll('[data-view-jump]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.viewJump)));
  $('startExplore').addEventListener('click', () => { switchView('library'); setTimeout(() => $('articleSearch').focus(), 350); });

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${q})`, 'ig'), '<mark>$1</mark>');
  }

  function filteredDocs() {
    let out = docs.filter(doc => {
      if (state.set && doc.a !== state.set) return false;
      if (state.subject && doc.s !== state.subject) return false;
      if (state.journal && doc.j !== state.journal) return false;
      if (state.year && String(doc.y) !== String(state.year)) return false;
      if (state.section && !doc.c.some(sec => sec.t === state.section)) return false;
      if (state.query && !doc._search.includes(state.query.toLowerCase())) return false;
      return true;
    });
    if (state.sort === 'yearDesc') out.sort((a,b) => b.y - a.y || a.id.localeCompare(b.id));
    if (state.sort === 'yearAsc') out.sort((a,b) => a.y - b.y || a.id.localeCompare(b.id));
    if (state.sort === 'title') out.sort((a,b) => a.t.localeCompare(b.t));
    if (state.sort === 'corpus') out.sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    return out;
  }

  function findSnippet(doc) {
    const query = state.query.trim();
    const all = doc.c.flatMap(sec => sectionSentences(sec));
    if (query) {
      const match = all.find(sentence => sentence.toLowerCase().includes(query.toLowerCase()));
      if (match) return highlight(match, query);
    }
    const fallback = all[0] || doc.ab || '';
    return highlight(fallback, query);
  }

  function renderActiveFilters() {
    const values = [
      ['set', state.set, state.set === 'main_4disciplines_160' ? '主分析集' : '扩展验证集'],
      ['subject', state.subject, state.subject], ['journal', state.journal, state.journal],
      ['year', state.year, state.year], ['section', state.section, state.section],
      ['query', state.query, `检索：${state.query}`]
    ].filter(([,value]) => value);
    $('activeFilters').innerHTML = values.map(([key,,label]) => `<span class="filter-tag">${escapeHtml(label)}<button data-clear="${key}" aria-label="移除">×</button></span>`).join('');
    $('activeFilters').querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => clearOne(b.dataset.clear)));
  }

  function clearOne(key) {
    state[key] = ''; state.page = 1;
    const map = { set:'filterSet', subject:'filterSubject', journal:'filterJournal', year:'filterYear', section:'filterSection', query:'articleSearch' };
    if (map[key]) $(map[key]).value = '';
    if (key === 'subject') document.querySelectorAll('.subject-chip').forEach(b => b.classList.toggle('active', !b.dataset.subject));
    renderArticles();
  }

  function renderArticles() {
    const filtered = filteredDocs();
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const pageDocs = filtered.slice(start, start + state.pageSize);
    $('articleCount').textContent = filtered.length.toLocaleString('zh-CN');
    $('articleGrid').innerHTML = pageDocs.map(doc => `
      <article class="article-card" data-doc="${doc.id}" tabindex="0" style="--subject-color:${subjectColor(doc.s)}">
        <div class="card-topline"><span class="doc-id">${doc.id}</span><span class="set-badge">${doc.a === 'main_4disciplines_160' ? '主分析集' : '扩展集'}</span></div>
        <h3>${highlight(doc.t, state.query)}</h3>
        <p class="journal-line">${escapeHtml(doc.j)} · ${escapeHtml(doc.s)}</p>
        <p class="snippet">${findSnippet(doc)}</p>
        <div class="card-bottom"><div class="section-badges">${doc.c.map(sec => `<span>${escapeHtml(sec.t)}</span>`).join('')}</div><span class="year">${doc.y}</span></div>
      </article>`).join('');
    $('articleEmpty').hidden = filtered.length !== 0;
    $('articleGrid').hidden = filtered.length === 0;
    renderPagination(pages);
    renderActiveFilters();
    document.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', () => openArticle(card.dataset.doc));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openArticle(card.dataset.doc); });
    });
  }

  function renderPagination(pages) {
    if (pages <= 1) { $('pagination').innerHTML = ''; return; }
    const pageSet = new Set([1, pages, state.page - 1, state.page, state.page + 1].filter(x => x >= 1 && x <= pages));
    let last = 0; const parts = [];
    [...pageSet].sort((a,b)=>a-b).forEach(page => {
      if (page - last > 1) parts.push('<span>…</span>');
      parts.push(`<button data-page="${page}" class="${page === state.page ? 'active' : ''}">${page}</button>`); last = page;
    });
    $('pagination').innerHTML = parts.join('');
    $('pagination').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.page); renderArticles(); $('libraryView').scrollIntoView({behavior:'smooth'}); }));
  }

  function openArticle(id) {
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    const sections = doc.c.map(sec => {
      const sentenceCount = sec.p.reduce((n,p)=>n+p.length,0);
      return `<section class="section-block"><div class="section-heading"><h3>${escapeHtml(sec.t)}</h3><span>${sentenceCount} 句</span></div>${sec.p.map(p => `<p>${highlight(p.join(' '), state.query)}</p>`).join('')}</section>`;
    }).join('');
    $('dialogContent').innerHTML = `
      <p class="dialog-kicker">${doc.id} · ${escapeHtml(doc.s)} · ${doc.y}</p>
      <h2 class="dialog-title">${escapeHtml(doc.t)}</h2>
      <p>${escapeHtml(doc.au)}</p>
      <dl class="dialog-metadata">
        <div><dt>期刊</dt><dd>${escapeHtml(doc.j)}</dd></div><div><dt>DOI</dt><dd>${escapeHtml(doc.doi)}</dd></div><div><dt>研究类型</dt><dd>${escapeHtml(doc.m)}</dd></div>
        <div><dt>索引</dt><dd>${escapeHtml(doc.i)}</dd></div><div><dt>开放许可</dt><dd>${escapeHtml(doc.l)}</dd></div><div><dt>分析集合</dt><dd>${doc.a === 'main_4disciplines_160' ? '四学科主分析集' : '扩展验证集'}</dd></div>
      </dl>
      <div class="dialog-tools"><a href="${escapeHtml(doc.u)}" target="_blank" rel="noopener"><span class="material-symbols-rounded">open_in_new</span>查看全文</a><button data-copy-citation="${doc.id}"><span class="material-symbols-rounded">content_copy</span>复制引文</button><button data-copy-doi="${doc.doi}"><span class="material-symbols-rounded">fingerprint</span>复制 DOI</button></div>
      ${sections}`;
    $('articleDialog').showModal();
    $('dialogContent').querySelector('[data-copy-citation]').addEventListener('click', () => copyText(`${doc.au} (${doc.y}). ${doc.t}. ${doc.j}. https://doi.org/${doc.doi}`));
    $('dialogContent').querySelector('[data-copy-doi]').addEventListener('click', () => copyText(doc.doi));
  }
  $('dialogClose').addEventListener('click', () => $('articleDialog').close());
  $('articleDialog').addEventListener('click', e => { if (e.target === $('articleDialog')) $('articleDialog').close(); });

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); showToast('已复制到剪贴板'); }
    catch { showToast('复制失败，请手动选择'); }
  }
  function showToast(message) {
    const toast = $('toast'); toast.querySelector('span:last-child').textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setControl(id, key) {
    $(id).addEventListener('change', e => { state[key] = e.target.value; state.page = 1; renderArticles(); });
  }
  setControl('filterSet','set'); setControl('filterSubject','subject'); setControl('filterJournal','journal'); setControl('filterYear','year'); setControl('filterSection','section'); setControl('sortArticles','sort');
  $('articleSearch').addEventListener('input', debounce(e => { state.query = e.target.value.trim(); state.page = 1; renderArticles(); }));
  $('clearFilters').addEventListener('click', () => {
    Object.assign(state, {page:1, query:'', set:'', subject:'', journal:'', year:'', section:''});
    ['filterSet','filterSubject','filterJournal','filterYear','filterSection','articleSearch'].forEach(id => $(id).value = '');
    document.querySelectorAll('.subject-chip').forEach(b => b.classList.toggle('active', !b.dataset.subject)); renderArticles();
  });
  $('subjectRibbon').addEventListener('click', e => {
    const button = e.target.closest('[data-subject]'); if (!button) return;
    state.subject = button.dataset.subject; state.page = 1; $('filterSubject').value = state.subject;
    document.querySelectorAll('.subject-chip').forEach(b => b.classList.toggle('active', b === button)); renderArticles(); switchView('library');
  });
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); switchView('library'); $('articleSearch').focus(); } });

  function flattenSentences() {
    const rows = [];
    docs.forEach(doc => doc.c.forEach(sec => sec.p.forEach(paragraph => paragraph.forEach((sentence, index) => rows.push({ doc, type: sec.t, text: sentence, prev: index ? paragraph[index-1] : '', next: index + 1 < paragraph.length ? paragraph[index+1] : '' })))));
    return rows;
  }
  const sentenceIndex = flattenSentences();

  function runConcordance() {
    const query = $('concordanceSearch').value.trim();
    const subject = $('concordanceSubject').value;
    const section = $('concordanceSection').value;
    const cs = $('caseSensitive').checked;
    if (!query) { state.concordance = []; $('concordanceSummary').innerHTML = '<strong>等待检索</strong><span>输入词项后显示最多 100 条语境</span>'; $('kwicList').innerHTML = ''; return; }
    const needle = cs ? query : query.toLowerCase();
    const all = sentenceIndex.filter(row => {
      if (subject && row.doc.s !== subject) return false;
      if (section && row.type !== section) return false;
      const hay = cs ? row.text : row.text.toLowerCase();
      return hay.includes(needle);
    });
    state.concordance = all;
    $('concordanceSummary').innerHTML = `<strong>${all.length.toLocaleString('zh-CN')} 条命中</strong><span>当前展示前 ${Math.min(100, all.length)} 条</span>`;
    $('kwicList').innerHTML = all.slice(0,100).map(row => `<article class="kwic-item" style="--subject-color:${subjectColor(row.doc.s)}"><div class="kwic-meta"><strong>${escapeHtml(row.doc.s)} · ${escapeHtml(row.type)}</strong>${row.doc.id}<br/>${escapeHtml(row.doc.j)}<br/>${row.doc.y}</div><div class="kwic-context"><p class="neighbor">${escapeHtml(row.prev)}</p><p class="target">${highlight(row.text, query)}</p><p class="neighbor">${escapeHtml(row.next)}</p></div></article>`).join('');
  }
  $('runConcordance').addEventListener('click', runConcordance);
  $('concordanceSearch').addEventListener('keydown', e => { if (e.key === 'Enter') runConcordance(); });
  ['concordanceSubject','concordanceSection','caseSensitive'].forEach(id => $(id).addEventListener('change', runConcordance));
  document.querySelectorAll('[data-query]').forEach(b => b.addEventListener('click', () => { $('concordanceSearch').value = b.dataset.query; runConcordance(); }));

  function csvValue(value) { const s = String(value ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
  function downloadCsv(filename, headers, rows) {
    const csv = '\ufeff' + [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  $('downloadMetadata').addEventListener('click', () => {
    const data = filteredDocs();
    downloadCsv('corpus_metadata.csv', ['doc_id','analysis_set','subject','journal','year','doi','title','authors','section_types'], data.map(d => [d.id,d.a,d.s,d.j,d.y,d.doi,d.t,d.au,d.c.map(s=>s.t).join('|')]));
    showToast(`已导出 ${data.length} 篇元数据`);
  });
  $('exportConcordance').addEventListener('click', () => {
    if (!state.concordance.length) { showToast('请先执行语境检索'); return; }
    downloadCsv('concordance_results.csv', ['doc_id','subject','journal','year','doi','section_type','previous_sentence','target_sentence','next_sentence'], state.concordance.map(r => [r.doc.id,r.doc.s,r.doc.j,r.doc.y,r.doc.doi,r.type,r.prev,r.text,r.next]));
    showToast(`已导出 ${state.concordance.length} 条语境`);
  });

  renderArticles();
})();
