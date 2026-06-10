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
  function printPdf() {
    const photoCount = buildPrintPages();
    const photoPages = Math.ceil(photoCount / 3);
    const total = 1 + photoPages;
    const site = (val('siteName') || '現場名未入力').replace(/[\\/:*?"<>|\s]+/g, '_');
    const name = site + '_工事写真台帳_' + ymd();
    const msg = 'PDF作成前確認\n\n表紙：1ページ\n写真枚数：' + photoCount + '枚\n写真ページ：' + photoPages + 'ページ\n合計：' + total + 'ページ\n保存候補名：' + name + '\n\nこの内容でPDF作成しますか？';
    if (!confirm(msg)) return;
    const oldTitle = document.title;
    document.title = name;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = oldTitle;
      }, 800);
    }, 150);
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