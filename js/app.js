/* eslint-disable no-alert, no-unused-vars */
(function () {
  'use strict';
  // このファイルは元HTMLから分離したアプリ本体のスクリプトです。
  // config.js で定義されている NOTE_LINES や PRESETS を利用しています。

  // エントリー配列の初期化
  let entries = Array.from({ length: 3 }, (_, i) => ({
    no: String(i + 1),
    work_type: '',
    notes: Array(NOTE_LINES).fill(''),
    image: '',
    fit: 'cover'
  }));

  let selectedPhotoBox = null;
  const coverIds = ['siteName', 'workName', 'startDate', 'finishDate', 'contractorName', 'showContractor'];
  const DRAFT_KEY = 'yamazaki_tosou_photo_ledger_draft';
  let draftTimer = null;
  let hasUserChanged = false;
  let draftWarningShown = false;

  function byId(id) {
    return document.getElementById(id);
  }
  function val(id) {
    return byId(id)?.value || '';
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
  function showTab(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    byId(id).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderCoverScreen();
    if (id === 'ledger') {
      renderLedger();
    }
  }
  coverIds.forEach(id => setTimeout(() => {
    const el = byId(id);
    if (el) {
      el.addEventListener('input', renderCoverScreen);
      el.addEventListener('change', renderCoverScreen);
    }
  }, 0));
  function getCover() {
    return {
      siteName: val('siteName'),
      workName: val('workName'),
      startDate: val('startDate'),
      finishDate: val('finishDate'),
      contractorName: val('contractorName'),
      showContractor: val('showContractor') || 'yes'
    };
  }
  function coverMarkup(c) {
    const show = c.showContractor !== 'no';
    return `<div class="cover-inner ${show ? '' : 'no-contractor'}"><div class="cover-title"><span>工 事 写 真 帳</span></div><div class="cover-spacer"></div><div class="cover-row"><div class="cover-label">現 場 名</div><div class="cover-value">${esc(c.siteName)}</div></div><div class="cover-row"><div class="cover-label">工 事 名</div><div class="cover-value">${esc(c.workName)}</div></div><div class="cover-row"><div class="cover-label">工　　期</div><div class="cover-period"><div class="cover-sub-label">着 工</div><div class="cover-value">${esc(c.startDate)}</div></div></div><div class="cover-row"><div></div><div class="cover-period"><div class="cover-sub-label">竣 工</div><div class="cover-value">${esc(c.finishDate)}</div></div></div>${show ? `<div class="cover-row cover-contractor"><div class="cover-label">施 工 者</div><div class="cover-value">${esc(c.contractorName)}</div></div>` : ''}</div>`;
  }
  function renderCoverScreen() {
    const el = byId('coverScreen');
    if (el) {
      el.innerHTML = coverMarkup(getCover());
    }
  }
  function currentPreset() {
    return PRESETS[val('resizePreset')] || PRESETS.middle;
  }
  function updateResizePresetNote() {
    const p = currentPreset();
    const el = byId('resizePresetNote');
    if (el) {
      el.textContent = '現在：' + p.label + '　目安 ' + p.range + '。写真の内容により前後します。';
    }
  }
  function formatBytes(b) {
    if (!Number.isFinite(b)) return '-';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }
  function dataUrlBytes(u) {
    const b = String(u).split(',')[1] || '';
    return Math.round(b.length * 3 / 4);
  }
  function imgTag(src, fit) {
    return `<img src="${esc(src)}" style="object-fit:${fit || 'cover'};">`;
  }
  function placeholder() {
    return '<span>タップして写真を追加<br>または下部「撮影/選択」</span>';
  }
  function makeSideBox(e) {
    const notes = Array.isArray(e.notes) ? e.notes : [];
    let noteHtml = '';
    for (let i = 0; i < NOTE_LINES; i++) {
      noteHtml += `<div class="side-row note-line"><input class="note-input" data-note-index="${i}" value="${esc(notes[i] || '')}" placeholder="自由入力"></div>`;
    }
    return `<div class="side-box"><div class="side-row side-no"><div class="no-label">No.</div><input class="no-input" value="${esc(e.no || '')}"></div><div class="side-row work-row"><div class="work-label">工種</div><input class="work-input" value="${esc(e.work_type || '')}"></div>${noteHtml}</div>`;
  }
  function createEntryCard(e) {
    const d = document.createElement('div');
    d.className = 'entry-card';
    d.dataset.fit = e.fit || 'cover';
    d.innerHTML = `<div class="photo-box">${e.image ? imgTag(e.image, e.fit || 'cover') : placeholder()}</div>${makeSideBox(e)}<div class="card-footer no-print"><button type="button" onclick="deleteCardPhoto(this)">写真だけ削除</button><button type="button" onclick="clearCardText(this)">入力文だけ削除</button><button type="button" class="danger" onclick="deleteCard(this)">この枠を削除</button><select onchange="changeCardFit(this)"><option value="cover" ${(e.fit || 'cover') === 'cover' ? 'selected' : ''}>枠いっぱい</option><option value="contain" ${(e.fit || 'cover') === 'contain' ? 'selected' : ''}>全体表示</option></select></div>`;
    const box = d.querySelector('.photo-box');
    box.onclick = ev => {
      ev.preventDefault();
      openPhotoActionSheet(box);
    };
    box.addEventListener('dragover', ev => ev.preventDefault());
    box.addEventListener('drop', ev => {
      ev.preventDefault();
      if (ev.dataTransfer.files[0]) loadImage(ev.dataTransfer.files[0], box);
    });
    addPhotoTools(box);
    return d;
  }
  function renderLedger() {
    const g = byId('ledgerList');
    if (!g) return;
    syncEntriesFromDom(false);
    g.innerHTML = '';
    entries.forEach(e => g.appendChild(createEntryCard(e)));
    updatePhotoCount();
  }
  function addEntry() {
    syncEntriesFromDom();
    const n = entries.length + 1;
    entries.push({
      no: String(n),
      work_type: '',
      notes: Array(NOTE_LINES).fill(''),
      image: '',
      fit: 'cover'
    });
    renderLedger();
    queueDraftSave();
  }
  function addEntryAndScroll() {
    addEntry();
    const cards = document.querySelectorAll('.entry-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function renumberEntries() {
    document.querySelectorAll('.entry-card').forEach((c, i) => {
      const no = c.querySelector('.no-input');
      if (no) no.value = String(i + 1);
    });
    syncEntriesFromDom();
    updatePhotoCount();
    queueDraftSave();
  }
  function addPhotoTools(box) {
    if (box.querySelector('.photo-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'photo-tools no-print';
    tools.innerHTML = '<button type="button">撮影</button><button type="button">選択</button>';
    tools.children[0].onclick = ev => {
      ev.stopPropagation();
      pickPhotoFromSource(box, 'camera');
    };
    tools.children[1].onclick = ev => {
      ev.stopPropagation();
      pickPhotoFromSource(box, 'library');
    };
    box.appendChild(tools);
  }
  function markSelected(box) {
    selectedPhotoBox = box;
    document.querySelectorAll('.photo-box').forEach(p => p.classList.remove('is-selected'));
    box?.classList.add('is-selected');
  }
  function pickPhotoFromSource(box, source) {
    box = box || document.querySelector('.photo-box');
    if (!box) return;
    markSelected(box);
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    if (source === 'camera') inp.setAttribute('capture', 'environment');
    inp.onchange = () => {
      if (inp.files && inp.files[0]) loadImage(inp.files[0], box);
    };
    inp.click();
  }
  function openPhotoActionSheet(box) {
    markSelected(box);
    const old = byId('photoActionSheet');
    if (old) old.remove();
    const sheet = document.createElement('div');
    sheet.id = 'photoActionSheet';
    sheet.className = 'no-print';
    sheet.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:90;background:rgba(255,255,255,.98);border-top:1px solid #ccc;padding:12px 12px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(0,0,0,.18);display:grid;gap:8px;';
    sheet.innerHTML = '<button class="primary" style="min-height:52px" id="asCamera">カメラで撮影</button><button style="min-height:52px" id="asLibrary">写真/ファイルから選択</button><button id="asCover">表示：枠いっぱい</button><button id="asContain">表示：全体表示</button><button class="danger" style="min-height:48px" id="asCancel">キャンセル</button>';
    document.body.appendChild(sheet);
    byId('asCamera').onclick = () => {
      sheet.remove();
      pickPhotoFromSource(box, 'camera');
    };
    byId('asLibrary').onclick = () => {
      sheet.remove();
      pickPhotoFromSource(box, 'library');
    };
    byId('asCover').onclick = () => {
      sheet.remove();
      setBoxFit(box, 'cover');
    };
    byId('asContain').onclick = () => {
      sheet.remove();
      setBoxFit(box, 'contain');
    };
    byId('asCancel').onclick = () => sheet.remove();
  }
  function shootSelected() {
    pickPhotoFromSource(selectedPhotoBox || document.querySelector('.photo-box'), 'camera');
  }
  function chooseSelected() {
    pickPhotoFromSource(selectedPhotoBox || document.querySelector('.photo-box'), 'library');
  }
  function setBoxFit(box, fit) {
    const card = box.closest('.entry-card');
    card.dataset.fit = fit;
    const img = box.querySelector('img');
    if (img) img.style.objectFit = fit;
    syncEntriesFromDom();
    queueDraftSave();
    statusMsg('表示方法を変更しました。');
  }
  function changeCardFit(sel) {
    const card = sel.closest('.entry-card');
    const box = card.querySelector('.photo-box');
    setBoxFit(box, sel.value);
  }
  function loadImage(file, box) {
    const before = file.size;
    const p = currentPreset();
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const ratio = Math.min(1, p.maxW / w, p.maxH / h);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = canvas.toDataURL('image/jpeg', p.quality);
        box.innerHTML = imgTag(data, box.closest('.entry-card')?.dataset.fit || 'cover');
        addPhotoTools(box);
        markSelected(box);
        syncEntriesFromDom();
        updatePhotoCount();
        queueDraftSave();
        const after = dataUrlBytes(data);
        byId('resizeStatus').textContent = '取込前 ' + formatBytes(before) + ' → 取込後 約' + formatBytes(after) + '（' + p.label + '）';
      };
      img.onerror = () => alert('写真を読み込めませんでした。');
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }
  function deleteCardPhoto(btn) {
    const card = btn.closest('.entry-card');
    const box = card?.querySelector('.photo-box');
    if (!box) return;
    box.innerHTML = placeholder();
    addPhotoTools(box);
    syncEntriesFromDom();
    updatePhotoCount();
    queueDraftSave();
    statusMsg('選択枠の写真だけ削除しました。');
  }
  function clearCardText(btn) {
    const card = btn.closest('.entry-card');
    card?.querySelectorAll('.work-input,.note-input').forEach(i => i.value = '');
    syncEntriesFromDom();
    queueDraftSave();
    statusMsg('選択枠の入力文だけ削除しました。');
  }
  function deleteCard(btn) {
    if (!confirm('この写真枠を削除します。よろしいですか？')) return;
    btn.closest('.entry-card')?.remove();
    syncEntriesFromDom();
    updatePhotoCount();
    queueDraftSave();
    statusMsg('写真枠を削除しました。');
  }
  function clearPhotosOnly() {
    document.querySelectorAll('.photo-box').forEach(box => {
      box.innerHTML = placeholder();
      addPhotoTools(box);
    });
    syncEntriesFromDom();
    updatePhotoCount();
    queueDraftSave();
    statusMsg('写真だけ削除しました。');
  }
  function clearDescriptionsOnly() {
    document.querySelectorAll('.work-input,.note-input').forEach(i => i.value = '');
    syncEntriesFromDom();
    queueDraftSave();
    statusMsg('入力文を削除しました。写真とNo.は残しています。');
  }
  function clearPhotosAndDescriptions() {
    if (!confirm('写真と入力文を全削除します。No.は残します。よろしいですか？')) return;
    clearPhotosOnly();
    clearDescriptionsOnly();
    statusMsg('写真＆入力文を全削除しました。No.は残しています。');
  }
  function openDeleteMenu() {
    const old = byId('deleteActionSheet');
    if (old) old.remove();
    const sheet = document.createElement('div');
    sheet.id = 'deleteActionSheet';
    sheet.className = 'no-print';
    sheet.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:95;background:#fff;border-top:1px solid #ccc;padding:12px 12px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(0,0,0,.18);display:grid;gap:8px;';
    sheet.innerHTML = '<button id="delSelectedPhoto">選択中の写真だけ削除</button><button id="delSelectedText">選択中の入力文だけ削除</button><button class="danger" id="delAllPhoto">全写真削除</button><button class="danger" id="delAllText">全入力文削除</button><button id="delCancel">キャンセル</button>';
    document.body.appendChild(sheet);
    const card = selectedPhotoBox?.closest('.entry-card');
    byId('delSelectedPhoto').onclick = () => {
      sheet.remove();
      if (card) deleteCardPhoto(card.querySelector('.card-footer button'));
    };
    byId('delSelectedText').onclick = () => {
      sheet.remove();
      if (card) clearCardText(card.querySelector('.card-footer button'));
    };
    byId('delAllPhoto').onclick = () => {
      sheet.remove();
      if (confirm('全写真を削除しますか？')) clearPhotosOnly();
    };
    byId('delAllText').onclick = () => {
      sheet.remove();
      if (confirm('全入力文を削除しますか？')) clearDescriptionsOnly();
    };
    byId('delCancel').onclick = () => sheet.remove();
  }
  function syncEntriesFromDom(readDom = true) {
    const cards = [...document.querySelectorAll('.entry-card')];
    if (!cards.length && !readDom) return;
    entries = cards.map((c, i) => {
      const img = c.querySelector('.photo-box img');
      const notes = [...c.querySelectorAll('.note-input')].map(x => x.value || '');
      while (notes.length < NOTE_LINES) notes.push('');
      return {
        no: c.querySelector('.no-input')?.value || String(i + 1),
        work_type: c.querySelector('.work-input')?.value || '',
        notes: notes.slice(0, NOTE_LINES),
        image: img ? img.src : '',
        fit: c.dataset.fit || 'cover'
      };
    });
  }
  function entryHasPhoto(e) {
    return !!e.image;
  }
  function updatePhotoCount() {
    const cnt = (entries || []).filter(entryHasPhoto).length;
    const pages = Math.ceil(cnt / 3);
    const status = byId('resizeStatus');
    if (status && cnt) {
      status.textContent = status.textContent.replace(/　写真.*/, '') + '　写真 ' + cnt + '枚 / 写真ページ ' + pages + 'ページ';
    }
  }
  function statusMsg(msg) {
    const el = byId('resizeStatus');
    if (el) el.textContent = msg;
  }
  function buildDataForSave() {
    syncEntriesFromDom();
    return {
      cover: getCover(),
      compression: val('resizePreset') || 'middle',
      entries,
      savedAt: new Date().toISOString()
    };
  }
  function exportJson() {
    const data = buildDataForSave();
    saveInputData(data);
    saveDraftNow(false);
    hasUserChanged = false;
    statusMsg('入力データを保存しました。');
  }
  function normalizeImportEntry(e, i) {
    let notes = Array.isArray(e.notes) ? e.notes.slice(0, NOTE_LINES) : [e.stage || '', e.location || '', e.content || ''];
    while (notes.length < NOTE_LINES) notes.push('');
    return {
      no: e.no || String(i + 1),
      work_type: e.work_type || '',
      notes,
      image: e.image || '',
      fit: e.fit || 'cover'
    };
  }
  function applyData(data) {
    const c = data.cover || {};
    const map = {
      siteName: c.siteName || c.project_name || '',
      workName: c.workName || c.subtitle || '',
      startDate: c.startDate || c.start || '',
      finishDate: c.finishDate || c.end || '',
      contractorName: c.contractorName || c.contractor || '',
      showContractor: c.showContractor || 'yes'
    };
    Object.entries(map).forEach(([k, v]) => {
      const el = byId(k);
      if (el) el.value = v;
    });
    if (data.compression && PRESETS[data.compression]) byId('resizePreset').value = data.compression;
    entries = (data.entries && data.entries.length ? data.entries : entries).map(normalizeImportEntry);
    renderLedger();
    renderCoverScreen();
    updateResizePresetNote();
    updatePhotoCount();
  }
  function importJson(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    if (!confirm('現在の入力内容を読み込むデータで上書きします。よろしいですか？')) {
      ev.target.value = '';
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        applyData(data);
        saveDraftNow(false);
        hasUserChanged = false;
        statusMsg('入力データを読み込みました。');
      } catch (e) {
        alert('入力データを読み込めませんでした: ' + (e.message || e));
      }
    };
    r.readAsText(f);
    ev.target.value = '';
  }
  function removeImagesForLiteDraft(data) {
    return {
      ...data,
      entries: (data.entries || []).map(e => ({ ...e, image: '' })),
      liteDraft: true
    };
  }
  function saveDraftNow(silent = true) {
    try {
      const data = buildDataForSave();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      if (!silent) statusMsg('下書きを保存しました。');
      return true;
    } catch (e) {
      try {
        const lite = removeImagesForLiteDraft(buildDataForSave());
        localStorage.setItem(DRAFT_KEY, JSON.stringify(lite));
        if (!draftWarningShown) {
          draftWarningShown = true;
          statusMsg('写真枚数が多いため、文字情報を下書き保存しました。PDF作成前は「保存」を押してください。');
        }
        return false;
      } catch (err) {
        if (!draftWarningShown) {
          draftWarningShown = true;
          statusMsg('端末容量の都合で下書き保存できません。「保存」を押して控えを残してください。');
        }
        return false;
      }
    }
  }
  function queueDraftSave() {
    hasUserChanged = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveDraftNow(true), 700);
  }
  function restoreDraftIfNeeded() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const count = Array.isArray(data.entries) ? data.entries.filter(entryHasPhoto).length : 0;
      const title = data.cover?.siteName || data.cover?.workName || '前回の入力';
      if (confirm('前回の続きが見つかりました。\n\n' + title + '\n写真 ' + count + '枚\n\n続きから開きますか？')) {
        applyData(data);
        hasUserChanged = false;
        statusMsg(data.liteDraft ? '文字情報の下書きを開きました。写真は保存データから読み込んでください。' : '前回の続きから再開しました。');
      }
    } catch (e) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }
  function ymd() {
    const d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }
  function makePrintEntry(e) {
    const row = document.createElement('div');
    row.className = 'print-entry';
    const photo = document.createElement('div');
    photo.className = 'print-photo';
    const img = document.createElement('img');
    img.src = e.image;
    img.style.objectFit = e.fit || 'cover';
    photo.appendChild(img);
    const info = document.createElement('div');
    info.className = 'print-info';
    const no = document.createElement('div');
    no.className = 'print-no';
    no.textContent = 'No.　' + (e.no || '');
    const work = document.createElement('div');
    work.className = 'print-work';
    const lab = document.createElement('div');
    lab.className = 'print-work-label';
    lab.textContent = '工種';
    const wt = document.createElement('div');
    wt.className = 'print-work-text';
    wt.textContent = e.work_type || '';
    work.appendChild(lab);
    work.appendChild(wt);
    info.appendChild(no);
    info.appendChild(work);
    for (let i = 0; i < NOTE_LINES; i++) {
      const line = document.createElement('div');
      line.className = 'print-line';
      line.textContent = (e.notes && e.notes[i]) || '';
      info.appendChild(line);
    }
    row.appendChild(photo);
    row.appendChild(info);
    return row;
  }

  function drawPdfText(ctx, text, x, y, size, options = {}) {
    const font = options.font || 'Yu Gothic, Hiragino Sans, Hiragino Kaku Gothic ProN, Meiryo, sans-serif';
    ctx.save();
    ctx.fillStyle = options.color || '#111827';
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.font = (options.weight ? options.weight + ' ' : '') + size + 'px ' + font;
    ctx.fillText(String(text || ''), x, y);
    ctx.restore();
  }
  function wrapPdfText(ctx, text, maxWidth) {
    const src = String(text || '');
    const lines = [];
    let line = '';
    for (const ch of src) {
      if (ch === '\n') {
        lines.push(line);
        line = '';
        continue;
      }
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line || !lines.length) lines.push(line);
    return lines;
  }
  function drawPdfWrappedText(ctx, text, x, y, maxWidth, lineHeight, size, options = {}) {
    ctx.save();
    ctx.font = (options.weight ? options.weight + ' ' : '') + size + 'px ' + (options.font || 'Yu Gothic, Hiragino Sans, Hiragino Kaku Gothic ProN, Meiryo, sans-serif');
    ctx.fillStyle = options.color || '#111827';
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = 'middle';
    const lines = wrapPdfText(ctx, text, maxWidth);
    const startY = y - ((lines.length - 1) * lineHeight / 2);
    lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
    ctx.restore();
  }
  function loadPdfImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function drawImageInBox(ctx, img, x, y, w, h, fit) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    let sw = iw, sh = ih, sx = 0, sy = 0;
    if ((fit || 'cover') === 'contain') {
      const scale = Math.min(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return;
    }
    const srcRatio = iw / ih;
    const dstRatio = w / h;
    if (srcRatio > dstRatio) {
      sw = ih * dstRatio;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / dstRatio;
      sy = (ih - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function makeA4Canvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111111';
    ctx.fillStyle = '#111827';
    ctx.lineWidth = 2;
    return { canvas, ctx };
  }
  function drawCoverCanvas(cover) {
    const { canvas, ctx } = makeA4Canvas();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;

    // 参考PDFに合わせたA4固定レイアウト
    // PDFキャンバス: 1240 x 1754px / 出力: A4縦
    const page = {
      borderX: 153,
      borderY: 147,
      borderW: 964,
      borderH: 1432,
      labelX: 230,
      lineX: 210,
      lineRight: 1062,
      valueCenterX: 655
    };

    ctx.strokeRect(page.borderX, page.borderY, page.borderW, page.borderH);

    drawPdfText(ctx, '工事写真帳', 620, 314, 40, {
      align: 'center',
      font: 'Yu Mincho, Hiragino Mincho ProN, serif',
      weight: '500'
    });
    ctx.beginPath();
    ctx.moveTo(290, 343);
    ctx.lineTo(930, 343);
    ctx.stroke();

    function drawLongRow(label, value, lineY) {
      const textY = lineY - 28;
      drawPdfText(ctx, label, page.labelX, textY, 25, { font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
      drawPdfText(ctx, value || '', page.valueCenterX, textY, 26, { align: 'center', font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
      ctx.beginPath();
      ctx.moveTo(page.lineX, lineY);
      ctx.lineTo(page.lineRight, lineY);
      ctx.stroke();
    }

    drawLongRow('現場名', cover.siteName || '', 537);
    drawLongRow('工事名', cover.workName || '', 732);
    // 既存入力欄(contractorName)を、参考帳票の「工事箇所」欄として出力
    if ((cover.showContractor || 'yes') !== 'no') {
      drawLongRow('工事箇所', cover.contractorName || '', 862);
    }

    drawPdfText(ctx, '工期', 245, 967, 25, { font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
    drawPdfText(ctx, '着手', 438, 967, 25, { font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
    drawPdfText(ctx, cover.startDate || '', 705, 967, 26, { align: 'center', font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
    ctx.beginPath();
    ctx.moveTo(370, 992);
    ctx.lineTo(page.lineRight, 992);
    ctx.stroke();

    drawPdfText(ctx, '竣工', 438, 1097, 25, { font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
    drawPdfText(ctx, cover.finishDate || '', 705, 1097, 26, { align: 'center', font: 'Yu Mincho, Hiragino Mincho ProN, serif' });
    ctx.beginPath();
    ctx.moveTo(370, 1122);
    ctx.lineTo(page.lineRight, 1122);
    ctx.stroke();

    return canvas;
  }
  function drawDottedLine(ctx, x1, y, x2) {
    ctx.save();
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }
  async function makePhotoPageCanvas(pageEntries) {
    const { canvas, ctx } = makeA4Canvas();

    // 参考PDFのA4写真台帳に合わせた固定配置
    // 1ページ3段、左写真・右情報欄、上下余白を参考帳票と同等に調整
    const photoX = 117;
    const photoW = 646;
    const photoH = 485;
    const infoX = 849;
    const infoW = 300;
    const infoH = 485;
    const topYs = [88, 636, 1184];
    const rowCount = 9;
    const rowH = infoH / rowCount;

    ctx.strokeStyle = '#111111';
    ctx.fillStyle = '#111827';
    ctx.lineWidth = 2;

    for (let idx = 0; idx < pageEntries.length; idx++) {
      const e = pageEntries[idx];
      const y = topYs[idx];

      if (e.image) {
        try {
          const img = await loadPdfImage(e.image);
          ctx.save();
          ctx.beginPath();
          ctx.rect(photoX, y, photoW, photoH);
          ctx.clip();
          drawImageInBox(ctx, img, photoX, y, photoW, photoH, e.fit || 'cover');
          ctx.restore();
        } catch (err) {
          drawPdfText(ctx, '写真を読み込めませんでした', photoX + photoW / 2, y + photoH / 2, 18, { align: 'center', color: '#999999' });
        }
      }

      // 右側情報欄：参考帳票と同じ、均等罫線の写真説明枠
      ctx.lineWidth = 2;
      ctx.strokeRect(infoX, y, infoW, infoH);
      for (let i = 1; i < rowCount; i++) {
        const lineY = y + rowH * i;
        if (i === 4) {
          // 参考帳票の強調行に合わせて点線化
          drawDottedLine(ctx, infoX, lineY, infoX + infoW);
        } else {
          ctx.beginPath();
          ctx.moveTo(infoX, lineY);
          ctx.lineTo(infoX + infoW, lineY);
          ctx.stroke();
        }
      }

      // No.は情報欄の上段。番号は残しつつ、全体を中央寄せ
      drawPdfText(ctx, 'No.　' + (e.no || ''), infoX + infoW / 2, y + rowH * 0.62, 24, { align: 'center' });

      // 工種・自由入力は参考帳票に近い位置へ配置。中央寄せは維持。
      const notes = Array.isArray(e.notes) ? e.notes : [];
      drawPdfWrappedText(ctx, e.work_type || '', infoX + infoW / 2, y + rowH * 3.5, infoW - 44, 24, 20, { align: 'center', weight: '600' });
      for (let i = 0; i < NOTE_LINES; i++) {
        const rowIndex = 4 + i;
        if (rowIndex >= rowCount) break;
        drawPdfWrappedText(ctx, notes[i] || '', infoX + infoW / 2, y + rowH * (rowIndex + 0.5), infoW - 34, 23, 19, { align: 'center', weight: i === 0 ? '600' : '' });
      }
    }
    return canvas;
  }
  function dataUrlToBytes(dataUrl) {
    const b64 = String(dataUrl).split(',')[1] || '';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function asciiBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }
  function concatBytes(parts) {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    parts.forEach(p => {
      out.set(p, pos);
      pos += p.length;
    });
    return out;
  }
  function createPdfFromJpegs(jpegs) {
    const pageW = 595.28;
    const pageH = 841.89;
    const parts = [];
    const offsets = [0];
    let pos = 0;
    function addBytes(bytes) {
      parts.push(bytes);
      pos += bytes.length;
    }
    function addString(str) {
      addBytes(asciiBytes(str));
    }
    function startObj(id) {
      offsets[id] = pos;
      addString(id + ' 0 obj\n');
    }
    addString('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    const pageObjIds = [];
    for (let i = 0; i < jpegs.length; i++) {
      pageObjIds.push(3 + i * 3);
    }
    startObj(1);
    addString('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    startObj(2);
    addString('<< /Type /Pages /Count ' + jpegs.length + ' /Kids [' + pageObjIds.map(id => id + ' 0 R').join(' ') + '] >>\nendobj\n');
    jpegs.forEach((jpeg, i) => {
      const pageId = 3 + i * 3;
      const contentId = 4 + i * 3;
      const imageId = 5 + i * 3;
      const imName = 'Im' + (i + 1);
      startObj(pageId);
      addString('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /' + imName + ' ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>\nendobj\n');
      const content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/' + imName + ' Do\nQ\n';
      startObj(contentId);
      addString('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
      startObj(imageId);
      addString('<< /Type /XObject /Subtype /Image /Width ' + jpeg.width + ' /Height ' + jpeg.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.bytes.length + ' >>\nstream\n');
      addBytes(jpeg.bytes);
      addString('\nendstream\nendobj\n');
    });
    const xrefPos = pos;
    const size = 3 + jpegs.length * 3;
    addString('xref\n0 ' + size + '\n');
    addString('0000000000 65535 f \n');
    for (let i = 1; i < size; i++) {
      addString(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    addString('trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function createDirectPdfBlob() {
    syncEntriesFromDom();
    const canvases = [drawCoverCanvas(getCover())];
    const photos = entries.filter(entryHasPhoto);
    for (let i = 0; i < photos.length; i += 3) {
      canvases.push(await makePhotoPageCanvas(photos.slice(i, i + 3)));
    }
    const jpegs = canvases.map(canvas => ({
      width: canvas.width,
      height: canvas.height,
      bytes: dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92))
    }));
    return createPdfFromJpegs(jpegs);
  }
  function downloadPdfBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 60000);
  }

  function buildPrintPages() {
    syncEntriesFromDom();
    const root = byId('printRoot');
    root.innerHTML = '';
    const cover = document.createElement('div');
    cover.className = 'print-page cover-page';
    cover.innerHTML = coverMarkup(getCover());
    root.appendChild(cover);
    const photos = entries.filter(entryHasPhoto);
    for (let i = 0; i < photos.length; i += 3) {
      const page = document.createElement('div');
      page.className = 'print-page photo-print-page';
      photos.slice(i, i + 3).forEach(e => page.appendChild(makePrintEntry(e)));
      root.appendChild(page);
    }
    return photos.length;
  }
  async function printPdf() {
    syncEntriesFromDom();
    const photoCount = entries.filter(entryHasPhoto).length;
    const photoPages = Math.ceil(photoCount / 3);
    const total = 1 + photoPages;
    const site = (val('siteName') || '現場名未入力').replace(/[\\/:*?"<>|\s]+/g, '_');
    const name = site + '_工事写真台帳_' + ymd() + '.pdf';
    const msg = 'PDF作成前確認\n\n表紙：1ページ\n写真枚数：' + photoCount + '枚\n写真ページ：' + photoPages + 'ページ\n合計：' + total + 'ページ\n保存候補名：' + name + '\n\nこの内容でPDFを直接作成しますか？';
    if (!confirm(msg)) return;
    try {
      statusMsg('PDF作成中です。画面を閉じずにお待ちください。');
      const blob = await createDirectPdfBlob();
      downloadPdfBlob(blob, name);
      statusMsg('PDFを作成しました。保存先を確認してください。');
    } catch (e) {
      console.error(e);
      alert('PDF作成に失敗しました。写真枚数を減らすか、保存後に再度お試しください。');
      statusMsg('PDF作成に失敗しました。');
    }
  }
  // HTML内のonclick/onchangeから呼び出せるように公開します。
  Object.assign(window, {
    showTab,
    updateResizePresetNote,
    addEntry,
    addEntryAndScroll,
    renumberEntries,
    shootSelected,
    chooseSelected,
    exportJson,
    importJson,
    printPdf,
    openDeleteMenu,
    deleteCardPhoto,
    clearCardText,
    deleteCard,
    changeCardFit,
    clearPhotosOnly,
    clearDescriptionsOnly,
    clearPhotosAndDescriptions
  });

  // ブラウザ側の印刷操作からでもPDF用DOMを組み立てます。
  window.addEventListener('beforeprint', buildPrintPages);

  // 入力中データをDOMから常に拾い、下書き保存します。
  document.addEventListener('input', ev => {
    if (ev.target && ev.target.closest && (ev.target.closest('.entry-card') || coverIds.includes(ev.target.id))) {
      syncEntriesFromDom();
      updatePhotoCount();
      queueDraftSave();
    }
  });
  document.addEventListener('change', ev => {
    if (ev.target && ev.target.closest && (ev.target.closest('.entry-card') || coverIds.includes(ev.target.id) || ev.target.id === 'resizePreset')) {
      syncEntriesFromDom();
      updatePhotoCount();
      queueDraftSave();
    }
  });
  window.addEventListener('beforeunload', ev => {
    if (hasUserChanged) {
      saveDraftNow(true);
      ev.preventDefault();
      ev.returnValue = '';
    }
  });

  // 初期表示
  updateResizePresetNote();
  renderLedger();
  renderCoverScreen();
  setTimeout(restoreDraftIfNeeded, 350);
})();