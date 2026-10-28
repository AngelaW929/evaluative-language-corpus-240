(() => {
  const corpus = window.CORPUS_DATA;
  if (!corpus || !Array.isArray(corpus.documents)) {
    document.body.innerHTML = '<main style="padding:40px;font-family:sans-serif">语料数据加载失败，请刷新页面。</main>';
    return;
  }

  const docs = corpus.documents;
  const articleTags = window.ARTICLE_TAGS || {};
  const palette = {
    '医学': '#a25058', '计算机科学': '#315f91', '语言学': '#9c6b2f',
    '环境科学': '#648260', '生物学': '#7c5e89', '社会科学': '#b65f43'
  };
  const state = { view: 'library', page: 1, pageSize: 20, query: '', set: '', subject: '', journal: '', year: '', section: '', method: '', profile: '', dimension: '', sort: 'corpus', concordance: [] };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const debounce = (fn, wait = 160) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };
  const subjectColor = subject => palette[subject] || '#607080';
  const sectionSentences = section => section.p.flat();
  const profileLabels = {
    evidence_validation: '证据验证型', effect_comparison: '效果比较型', mechanism_explanation: '机制解释型',
    application_implication: '应用启示型', exploratory_description: '探索描述型', limitation_reflection: '限制反思型',
    needs_review: '待人工复核'
  };
  const dimensionLabels = { importance: '重要性', significance: '显著性', validity: '有效性', quality: '质量', expectedness: '预期性' };
  const functionLabels = { hedging: '模糊限制', boosting: '强化断言', comparison: '比较评价', limitation: '局限反思', implication: '推论启示', recommendation: '建议行动' };
  const profileLabel = code => profileLabels[code] || code;
  const dimensionLabel = code => dimensionLabels[code] || code;
  const functionLabel = code => functionLabels[code] || code;
  function articleMetrics(doc) {
    const sentences = doc.c.flatMap(sectionSentences);
    const paragraphs = doc.c.reduce((sum, section) => sum + section.p.length, 0);
    const words = sentences.join(' ').match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length || 0;
    return { sentences: sentences.length, paragraphs, words, sections: doc.c.map(section => section.t) };
  }
  function normalizedArticleTags(doc) {
    const tags = articleTags[doc.id] || {};
    return {
      label: tags.label || 'needs_review',
      evaluation_dimensions: Array.isArray(tags.evaluation_dimensions) ? tags.evaluation_dimensions : [],
      discourse_functions: Array.isArray(tags.discourse_functions) ? tags.discourse_functions : [],
      topic_tags: Array.isArray(tags.topic_tags) ? tags.topic_tags : [],
      confidence: Number.isFinite(Number(tags.confidence)) ? Number(tags.confidence) : 0,
      reason: tags.reason || '尚未生成机器辅助标签。'
    };
  }
  const sectionCode = type => ({ Results: 'RES', Discussion: 'DIS', 'Results and Discussion': 'RAD' }[type] || 'SEC');
  const sentenceId = (doc, section, sectionIndex, paragraphIndex, sentenceIndex) =>
    `${doc.id}-${sectionCode(section.t)}-C${String(sectionIndex + 1).padStart(2, '0')}-P${String(paragraphIndex + 1).padStart(2, '0')}-S${String(sentenceIndex + 1).padStart(2, '0')}`;
  function indexedSectionSentences(doc, section, sectionIndex) {
    const rows = [];
    section.p.forEach((paragraph, paragraphIndex) => paragraph.forEach((text, sentenceIndex) => rows.push({
      id: sentenceId(doc, section, sectionIndex, paragraphIndex, sentenceIndex), doc, type: section.t,
      sectionIndex, paragraphIndex, sentenceIndex, sectionSentenceIndex: rows.length, text
    })));
    return rows.map((row, index) => ({ ...row, prev: rows[index - 1]?.text || '', next: rows[index + 1]?.text || '' }));
  }
  const documentSentenceRows = doc => doc.c.flatMap((section, sectionIndex) => indexedSectionSentences(doc, section, sectionIndex));
  const docText = doc => `${doc.t} ${doc.au} ${doc.doi} ${doc.j} ${doc.m} ${profileLabel(doc._tags.label)} ${doc._tags.evaluation_dimensions.map(dimensionLabel).join(' ')} ${doc._tags.discourse_functions.map(functionLabel).join(' ')} ${doc._tags.topic_tags.join(' ')} ${doc.c.flatMap(s => sectionSentences(s)).join(' ')}`.toLowerCase();
  docs.forEach(doc => { doc._metrics = articleMetrics(doc); doc._tags = normalizedArticleTags(doc); doc._search = docText(doc); });

  const stats = corpus.stats;
  $('statDocs').textContent = stats.documents.toLocaleString('zh-CN');
  $('statSections').textContent = stats.sections.toLocaleString('zh-CN');
  $('statSentences').textContent = stats.sentences.toLocaleString('zh-CN');
  $('statWords').textContent = `${(stats.words / 10000).toFixed(1)} 万`;

  function optionList(values, target, labeler = value => value) {
    [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')).forEach(value => {
      const option = document.createElement('option');
      option.value = value; option.textContent = labeler(value); target.append(option);
    });
  }
  optionList(docs.map(d => d.s), $('filterSubject'));
  optionList(docs.map(d => d.j), $('filterJournal'));
  optionList(docs.map(d => d.y), $('filterYear'));
  optionList(docs.map(d => d.m), $('filterMethod'));
  optionList(docs.map(d => d._tags.label), $('filterProfile'), profileLabel);
  optionList(docs.flatMap(d => d._tags.evaluation_dimensions), $('filterDimension'), dimensionLabel);
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
      if (state.method && doc.m !== state.method) return false;
      if (state.profile && doc._tags.label !== state.profile) return false;
      if (state.dimension && !doc._tags.evaluation_dimensions.includes(state.dimension)) return false;
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
      ['year', state.year, state.year], ['section', state.section, state.section], ['method', state.method, state.method],
      ['profile', state.profile, profileLabel(state.profile)], ['dimension', state.dimension, dimensionLabel(state.dimension)],
      ['query', state.query, `检索：${state.query}`]
    ].filter(([,value]) => value);
    $('activeFilters').innerHTML = values.map(([key,,label]) => `<span class="filter-tag">${escapeHtml(label)}<button data-clear="${key}" aria-label="移除">×</button></span>`).join('');
    $('activeFilters').querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => clearOne(b.dataset.clear)));
  }

  function clearOne(key) {
    state[key] = ''; state.page = 1;
    const map = { set:'filterSet', subject:'filterSubject', journal:'filterJournal', year:'filterYear', section:'filterSection', method:'filterMethod', profile:'filterProfile', dimension:'filterDimension', query:'articleSearch' };
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
    const filteredSentenceTotal = filtered.reduce((sum, doc) => sum + doc.c.reduce((sectionSum, section) => sectionSum + sectionSentences(section).length, 0), 0);
    $('filteredSentenceCount').textContent = filteredSentenceTotal.toLocaleString('zh-CN');
    $('articleGrid').innerHTML = pageDocs.map(doc => `
      <article class="article-card" data-doc="${doc.id}" tabindex="0" style="--subject-color:${subjectColor(doc.s)}">
        <div class="card-topline"><span class="doc-id">${doc.id}</span><span class="set-badge">${doc.a === 'main_4disciplines_160' ? '主分析集' : '扩展集'}</span></div>
        <h3>${highlight(doc.t, state.query)}</h3>
        <p class="journal-line">${escapeHtml(doc.j)} · ${escapeHtml(doc.s)}</p>
        <div class="article-tag-row"><span class="tag-chip metadata">${escapeHtml(doc.m)}</span><span class="tag-chip profile">${escapeHtml(profileLabel(doc._tags.label))}</span>${doc._tags.evaluation_dimensions.slice(0,2).map(tag => `<span class="tag-chip dimension">${escapeHtml(dimensionLabel(tag))}</span>`).join('')}</div>
        <p class="snippet">${findSnippet(doc)}</p>
        <div class="card-bottom"><div class="section-badges">${doc.c.map(sec => `<span>${escapeHtml(sec.t)} · ${sectionSentences(sec).length} 句</span>`).join('')}</div><span class="year">${doc.y}</span></div>
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
    const articleSentenceRows = documentSentenceRows(doc);
    const tags = doc._tags;
    const metrics = doc._metrics;
    const licenseLabel = /licenses\/by\/4\.0/i.test(doc.l) ? 'CC BY 4.0' : doc.l;
    const sections = doc.c.map((sec, sectionIndex) => {
      const rows = indexedSectionSentences(doc, sec, sectionIndex);
      return `<section class="section-block">
        <div class="section-heading"><div><h3>${escapeHtml(sec.t)}</h3><p>章节 ${sectionIndex + 1} · ${rows.length} 句</p></div><button class="section-export" data-export-section="${sectionIndex}"><span class="material-symbols-rounded">download</span>导出本节</button></div>
        <div class="sentence-list">${rows.map(row => `<article class="sentence-row" id="${row.id}" data-sentence-id="${row.id}">
          <div class="sentence-ref"><strong>${row.id}</strong><span>章节第 ${row.sectionSentenceIndex + 1} 句 · 段落 ${row.paragraphIndex + 1}</span></div>
          <p>${highlight(row.text, state.query)}</p>
          <button class="sentence-copy" data-copy-sentence="${row.id}" aria-label="复制 ${row.id}"><span class="material-symbols-rounded">content_copy</span></button>
        </article>`).join('')}</div>
      </section>`;
    }).join('');
    $('dialogContent').innerHTML = `
      <p class="dialog-kicker">${doc.id} · ${escapeHtml(doc.s)} · ${doc.y}</p>
      <h2 class="dialog-title">${escapeHtml(doc.t)}</h2>
      <p>${escapeHtml(doc.au)}</p>
      <dl class="dialog-metadata">
        <div><dt>期刊</dt><dd>${escapeHtml(doc.j)}</dd></div><div><dt>DOI</dt><dd>${escapeHtml(doc.doi)}</dd></div><div><dt>研究类型</dt><dd>${escapeHtml(doc.m)}</dd></div>
        <div><dt>索引</dt><dd>${escapeHtml(doc.i)}</dd></div><div><dt>开放许可</dt><dd>${escapeHtml(doc.l)}</dd></div><div><dt>分析集合</dt><dd>${doc.a === 'main_4disciplines_160' ? '四学科主分析集' : '扩展验证集'}</dd></div>
      </dl>
      <div class="dialog-tools"><a href="${escapeHtml(doc.u)}" target="_blank" rel="noopener"><span class="material-symbols-rounded">open_in_new</span>查看全文</a><button data-copy-citation="${doc.id}"><span class="material-symbols-rounded">content_copy</span>复制引文</button><button data-copy-doi="${doc.doi}"><span class="material-symbols-rounded">fingerprint</span>复制 DOI</button><button data-export-article="${doc.id}"><span class="material-symbols-rounded">table_view</span>导出本文句级 CSV</button></div>
      <section class="article-tag-panel">
        <div class="tag-panel-heading"><div><p class="overline">ARTICLE TAGS</p><h3>文章细化标签</h3></div><span class="tag-confidence">机器辅助 · 置信度 ${Math.round(tags.confidence * 100)}%</span></div>
        <div class="tag-group-grid">
          <article><h4>语料元数据</h4><div class="tag-list"><span>${escapeHtml(doc.m)}</span><span>${escapeHtml(doc.i)}</span><span>${escapeHtml(licenseLabel)}</span><span>${metrics.sections.map(escapeHtml).join(' + ')}</span><span>${metrics.sentences.toLocaleString('zh-CN')} 句</span><span>${metrics.paragraphs.toLocaleString('zh-CN')} 段</span><span>${metrics.words.toLocaleString('zh-CN')} 词</span></div></article>
          <article><h4>主导评价画像</h4><div class="tag-list featured"><span>${escapeHtml(profileLabel(tags.label))}</span></div><p>${escapeHtml(tags.reason)}</p></article>
          <article><h4>评价维度</h4><div class="tag-list">${tags.evaluation_dimensions.map(tag => `<span>${escapeHtml(dimensionLabel(tag))}</span>`).join('') || '<span>待复核</span>'}</div></article>
          <article><h4>话语功能</h4><div class="tag-list">${tags.discourse_functions.map(tag => `<span>${escapeHtml(functionLabel(tag))}</span>`).join('') || '<span>待复核</span>'}</div></article>
          <article class="topic-tag-group"><h4>主题标签</h4><div class="tag-list topics">${tags.topic_tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('') || '<span>待复核</span>'}</div></article>
        </div>
        <p class="tag-audit-note"><span class="material-symbols-rounded">fact_check</span>评价画像、维度和话语功能为文章级机器辅助特征，用于筛选与候选召回；正式论文分析仍需按句人工复核。</p>
      </section>
      <div class="sentence-mode-note"><span class="material-symbols-rounded">segment</span><div><strong>句级精确模式</strong><p>每句均保留章节、段落和句内位置，并分配可复核的稳定 ID。点击句子右侧图标可复制“句级 ID + 原文”。</p></div></div>
      ${sections}`;
    $('articleDialog').showModal();
    $('dialogContent').querySelector('[data-copy-citation]').addEventListener('click', () => copyText(`${doc.au} (${doc.y}). ${doc.t}. ${doc.j}. https://doi.org/${doc.doi}`));
    $('dialogContent').querySelector('[data-copy-doi]').addEventListener('click', () => copyText(doc.doi));
    $('dialogContent').querySelector('[data-export-article]').addEventListener('click', () => exportSentenceRows(`${doc.id}_sentences.csv`, articleSentenceRows));
    $('dialogContent').querySelectorAll('[data-export-section]').forEach(button => button.addEventListener('click', () => {
      const sectionIndex = Number(button.dataset.exportSection);
      exportSentenceRows(`${doc.id}_${sectionCode(doc.c[sectionIndex].t)}_sentences.csv`, indexedSectionSentences(doc, doc.c[sectionIndex], sectionIndex));
    }));
    $('dialogContent').querySelectorAll('[data-copy-sentence]').forEach(button => button.addEventListener('click', () => {
      const row = articleSentenceRows.find(item => item.id === button.dataset.copySentence);
      if (row) copyText(`${row.id}\n${row.text}`);
    }));
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
  setControl('filterSet','set'); setControl('filterSubject','subject'); setControl('filterJournal','journal'); setControl('filterYear','year'); setControl('filterSection','section'); setControl('filterMethod','method'); setControl('filterProfile','profile'); setControl('filterDimension','dimension'); setControl('sortArticles','sort');
  $('articleSearch').addEventListener('input', debounce(e => { state.query = e.target.value.trim(); state.page = 1; renderArticles(); }));
  $('clearFilters').addEventListener('click', () => {
    Object.assign(state, {page:1, query:'', set:'', subject:'', journal:'', year:'', section:'', method:'', profile:'', dimension:''});
    ['filterSet','filterSubject','filterJournal','filterYear','filterSection','filterMethod','filterProfile','filterDimension','articleSearch'].forEach(id => $(id).value = '');
    document.querySelectorAll('.subject-chip').forEach(b => b.classList.toggle('active', !b.dataset.subject)); renderArticles();
  });
  $('subjectRibbon').addEventListener('click', e => {
    const button = e.target.closest('[data-subject]'); if (!button) return;
    state.subject = button.dataset.subject; state.page = 1; $('filterSubject').value = state.subject;
    document.querySelectorAll('.subject-chip').forEach(b => b.classList.toggle('active', b === button)); renderArticles(); switchView('library');
  });
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); switchView('library'); $('articleSearch').focus(); } });

  function flattenSentences() {
    return docs.flatMap(documentSentenceRows);
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
    $('kwicList').innerHTML = all.slice(0,100).map(row => `<article class="kwic-item" style="--subject-color:${subjectColor(row.doc.s)}"><div class="kwic-meta"><strong>${escapeHtml(row.doc.s)} · ${escapeHtml(row.type)}</strong><span class="kwic-profile">${escapeHtml(profileLabel(row.doc._tags.label))}</span><b>${row.id}</b>${escapeHtml(row.doc.j)}<br/>${row.doc.y}</div><div class="kwic-context"><p class="neighbor"><span>前句</span>${escapeHtml(row.prev)}</p><div class="kwic-target-line"><p class="target">${highlight(row.text, query)}</p><button data-copy-concordance="${row.id}" aria-label="复制 ${row.id}"><span class="material-symbols-rounded">content_copy</span></button></div><p class="neighbor"><span>后句</span>${escapeHtml(row.next)}</p></div></article>`).join('');
    $('kwicList').querySelectorAll('[data-copy-concordance]').forEach(button => button.addEventListener('click', () => {
      const row = all.find(item => item.id === button.dataset.copyConcordance);
      if (row) copyText(`${row.id}\n${row.text}`);
    }));
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
  function exportSentenceRows(filename, rows) {
    downloadCsv(filename,
      ['sentence_id','doc_id','analysis_set','subject','journal','year','doi','study_method','evaluation_profile','evaluation_dimensions','discourse_functions','topic_tags','tag_confidence','section_type','section_index','section_sentence_index','paragraph_index','sentence_in_paragraph','previous_sentence','sentence_text','next_sentence'],
      rows.map(row => [row.id,row.doc.id,row.doc.a,row.doc.s,row.doc.j,row.doc.y,row.doc.doi,row.doc.m,row.doc._tags.label,row.doc._tags.evaluation_dimensions.join('|'),row.doc._tags.discourse_functions.join('|'),row.doc._tags.topic_tags.join('|'),row.doc._tags.confidence,row.type,row.sectionIndex + 1,row.sectionSentenceIndex + 1,row.paragraphIndex + 1,row.sentenceIndex + 1,row.prev,row.text,row.next]));
    showToast(`已导出 ${rows.length.toLocaleString('zh-CN')} 个句子`);
  }
  $('downloadMetadata').addEventListener('click', () => {
    const data = filteredDocs();
    downloadCsv('corpus_metadata_with_article_tags.csv', ['doc_id','analysis_set','subject','journal','year','doi','title','authors','study_method','index','license','section_types','section_count','paragraph_count','sentence_count','word_count','evaluation_profile','evaluation_dimensions','discourse_functions','topic_tags','tag_confidence','tag_reason'], data.map(d => [d.id,d.a,d.s,d.j,d.y,d.doi,d.t,d.au,d.m,d.i,d.l,d._metrics.sections.join('|'),d.c.length,d._metrics.paragraphs,d._metrics.sentences,d._metrics.words,d._tags.label,d._tags.evaluation_dimensions.join('|'),d._tags.discourse_functions.join('|'),d._tags.topic_tags.join('|'),d._tags.confidence,d._tags.reason]));
    showToast(`已导出 ${data.length} 篇元数据`);
  });
  $('exportConcordance').addEventListener('click', () => {
    if (!state.concordance.length) { showToast('请先执行语境检索'); return; }
    downloadCsv('concordance_results.csv', ['sentence_id','doc_id','subject','journal','year','doi','study_method','evaluation_profile','evaluation_dimensions','discourse_functions','section_type','section_index','paragraph_index','sentence_in_paragraph','previous_sentence','target_sentence','next_sentence'], state.concordance.map(r => [r.id,r.doc.id,r.doc.s,r.doc.j,r.doc.y,r.doc.doi,r.doc.m,r.doc._tags.label,r.doc._tags.evaluation_dimensions.join('|'),r.doc._tags.discourse_functions.join('|'),r.type,r.sectionIndex + 1,r.paragraphIndex + 1,r.sentenceIndex + 1,r.prev,r.text,r.next]));
    showToast(`已导出 ${state.concordance.length} 条语境`);
  });
  $('downloadSentences').addEventListener('click', () => {
    const selectedDocs = filteredDocs();
    exportSentenceRows('corpus_sentences_filtered.csv', selectedDocs.flatMap(documentSentenceRows));
  });

  renderArticles();
})();
