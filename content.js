window.PanelContent = (() => {
  const K = window.Kit;
  const { h, icon, call, setView, failed, tone, note, card, field, select, check, grid, confirmButton, openDialog, dlg, busy, alert, message, date } = K;
  const AUD = { all: 'أونلاين وسنتر', online: 'أونلاين بس', center: 'السنتر بس' };
  const MB = b => (b / 1048576).toFixed(b > 104857600 ? 0 : 1) + ' MB';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let data = null;
  const uploads = [];
  async function load() { const r = await call('admin.content'); if (r.ok) data = r; return r; }
  function compress(file, max = 1400) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  function guessMime(file, kind) {
    if (file.type) return file.type === 'video/x-m4v' ? 'video/x-m4v' : file.type;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (kind === 'pdf') return 'application/pdf';
    return { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', m4v: 'video/x-m4v' }[ext] || 'video/mp4';
  }
  async function put(url, blob, range) {
    const r = await fetch(Panel.workerOrigin() + '/upload', { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Url': url, 'X-Range': range }, body: blob, credentials: 'omit' });
    try { return await r.json(); } catch { return { ok: false, code: 'server' }; }
  }
  async function upload(file, kind, onProgress) {
    const mime = guessMime(file, kind);
    if (kind === 'video' && !/^video\//.test(mime)) throw new Error('validation');
    if (kind === 'pdf' && mime !== 'application/pdf') throw new Error('validation');
    const start = await call('admin.uploadStart', { kind, name: file.name.replace(/\.[^.]+$/, '') || file.name, size: file.size, mime });
    if (!start.ok) throw new Error(start.code);
    const size = file.size, chunk = start.chunk || 8388608;
    let offset = 0, fails = 0, id = '';
    onProgress(0);
    while (!id) {
      const end = Math.min(offset + chunk, size) - 1;
      let r;
      try { r = await put(start.upload, file.slice(offset, end + 1), 'bytes ' + offset + '-' + end + '/' + size); } catch { r = { ok: false, code: 'network' }; }
      if (r.ok && r.done) { id = r.id; break; }
      if (r.ok) { offset = r.next || end + 1; fails = 0; onProgress(offset / size); continue; }
      if (r.code === 'upload_expired' || r.code === 'validation') throw new Error(r.code);
      if (++fails > 6) throw new Error(r.code || 'network');
      await sleep(1500 * fails);
      try {
        const q = await put(start.upload, null, 'bytes */' + size);
        if (q.ok && q.done) { id = q.id; break; }
        if (q.ok) { offset = q.next || 0; onProgress(offset / size); }
      } catch {}
    }
    onProgress(1);
    const done = await call('admin.uploadDone', { fileId: id, kind, auth: start.auth });
    if (!done.ok) throw new Error(done.code);
    return done.file;
  }
  function queueRow(name, kind) {
    const barIn = h('span', { class: 'up-fill' });
    const label = h('small', { class: 'muted', text: 'جاري التجهيز…' });
    const row = h('div', { class: 'row-item up-row' }, h('div', { class: 'course-info' }, h('b', {}, icon(kind === 'video' ? 'video' : 'pdf'), ' ', name), label, h('div', { class: 'up-bar' }, barIn)));
    return { row, set(p) { barIn.style.setProperty('--p', Math.round(p * 100) + '%'); label.textContent = p >= 1 ? 'بنأكد الملف…' : 'اترفع ' + Math.round(p * 100) + '%'; }, ok() { row.dataset.state = 'ok'; label.textContent = 'اترفع بنجاح'; barIn.style.setProperty('--p', '100%'); }, bad(code) { row.dataset.state = 'bad'; label.textContent = message(code); } };
  }
  async function runUpload(file, kind, box, after) {
    const q = queueRow(file.name, kind);
    box.prepend(q.row);
    uploads.push(file.name);
    window.onbeforeunload = () => 'uploading';
    try { const f = await upload(file, kind, p => q.set(p)); q.ok(); await load(); if (after) after(f); return f; }
    catch (e) { q.bad(e.message); return null; }
    finally { uploads.pop(); if (!uploads.length) window.onbeforeunload = null; }
  }
  function picker(accept, multiple, onPick) {
    const input = h('input', { type: 'file', accept, multiple: multiple || null, class: 'hidden-input' });
    input.addEventListener('change', () => { const files = [...input.files]; input.value = ''; if (files.length) onPick(files); });
    document.body.append(input);
    input.click();
    setTimeout(() => input.remove(), 60000);
  }
  function imagesDialog(onUploaded, back) {
    const list = [];
    const box = note();
    const name = h('input', { maxlength: 100, placeholder: 'مثال: ملزمة الباب الأول', value: '' });
    const thumbs = h('div', { class: 'thumbs' });
    const prev = h('div', { class: 'pdf-preview', hidden: true });
    const queue = h('div', { class: 'list' });
    let built = null;
    function draw() {
      built = null; prev.hidden = true; up.disabled = true;
      thumbs.replaceChildren(...(list.length ? list.map((x, i) => h('figure', { class: 'thumb', draggable: 'true', 'data-i': i },
        h('img', { src: x.url, alt: 'صفحة ' + (i + 1) }), h('figcaption', {}, h('b', { class: 'num', text: String(i + 1) }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'قبل', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); } }, icon('up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'بعد', disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); } }, icon('down')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'شيل الصورة', onclick: () => { URL.revokeObjectURL(x.url); list.splice(i, 1); draw(); } }, icon('trash'))))) : [h('p', { class: 'empty', text: 'اختار الصور من جهازك. مش هتترفع غير بعد ما تشوف المعاينة وتوافق.' })]));
      thumbs.querySelectorAll('.thumb').forEach(t => {
        t.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', t.dataset.i); });
        t.addEventListener('dragover', e => e.preventDefault());
        t.addEventListener('drop', e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')), to = Number(t.dataset.i); if (Number.isInteger(from) && from !== to) { const [m] = list.splice(from, 1); list.splice(to, 0, m); draw(); } });
      });
      count.textContent = list.length ? list.length + ' صورة' : '';
    }
    const count = h('span', { class: 'muted' });
    const add = h('button', { class: 'btn outline', type: 'button', onclick: () => picker('image/jpeg,image/png,image/webp', true, files => { files.filter(f => /^image\/(jpeg|png|webp)$/.test(f.type) && f.size < 25 * 1048576).slice(0, 120 - list.length).forEach(f => list.push({ file: f, url: URL.createObjectURL(f) })); draw(); }) }, icon('image'), 'اختار صور');
    const preview = h('button', { class: 'btn outline', type: 'button', onclick: async () => {
      if (!list.length) { alert(box, 'اختار صورة واحدة على الأقل.'); return; }
      busy(preview, true); alert(box, 'بنجهز الملف على جهازك…', 'info');
      try {
        const imgs = [];
        for (const x of list) imgs.push(await ImgPdf.toJpeg(x.file));
        built = ImgPdf.build(imgs, name.value);
        const pages = imgs.map((im, i) => { const L = ImgPdf.layout(im.w, im.h); return h('div', { class: 'page-mini' + (L.page[0] > L.page[1] ? ' wide' : '') }, h('img', { src: list[i].url, alt: '' }), h('span', { class: 'num', text: String(i + 1) })); });
        const blobUrl = URL.createObjectURL(built);
        prev.replaceChildren(h('p', { class: 'alert', 'data-type': 'success', text: `دي المعاينة: ${imgs.length} صفحة · ${MB(built.size)}. لو الترتيب مظبوط دوس «ارفع الملف».` }), h('div', { class: 'pages-mini' }, pages), h('a', { class: 'btn outline small', href: blobUrl, target: '_blank', rel: 'noopener' }, icon('pdf'), 'افتح المعاينة كملف PDF'));
        prev.hidden = false; up.disabled = false; alert(box, '');
      } catch { alert(box, 'تعذر تجهيز الصور. جرّب صور تانية.'); }
      busy(preview, false);
    } }, icon('eye'), 'معاينة');
    const up = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: async () => {
      if (!built) return;
      const title = name.value.trim() || 'ملف صور';
      busy(up, true);
      const f = await runUpload(new File([built], title + '.pdf', { type: 'application/pdf' }), 'pdf', queue, onUploaded);
      busy(up, false);
      if (f) { alert(box, 'اترفع الملف كـ PDF.', 'success'); list.splice(0).forEach(x => URL.revokeObjectURL(x.url)); draw(); if (back) back(f); }
    } }, icon('upload'), 'ارفع الملف');
    openDialog('صور ← ملف PDF', [h('p', { class: 'alert', 'data-type': 'info', text: 'الصور هتتجمع بالترتيب ده في ملف PDF واحد على جهازك، وبعد ما تشوف المعاينة وتوافق بيترفع الملف بس.' }), field('اسم الملف', name), h('div', { class: 'toolbar' }, add, count), thumbs, prev, queue, box], [up, preview, h('span', { class: 'spacer' }), h('button', { class: 'btn outline', type: 'button', onclick: () => (back ? back(null) : dlg.close()) }, back ? 'رجوع' : 'إغلاق')]);
    draw();
  }
  function lectureLabel(l) { return l.title + (l.price ? ' · ' + l.price + ' ج' : ''); }
  function audienceText(c) {
    const centers = c.audience === 'center' ? (c.centers.length ? c.centers.map(id => (data.centers.find(x => x.id === id) || {}).name).filter(Boolean).join('، ') : 'كل السناتر') : '';
    return [c.grades.join('، '), AUD[c.audience] + (centers ? ' (' + centers + ')' : '')].join(' · ');
  }
  async function courses() {
    const r = await load();
    if (!r.ok) return failed(r, courses);
    const msg = note('success');
    const list = h('div', { class: 'list' });
    const lecBox = h('div', { class: 'list' });
    const lq = h('input', { type: 'search', placeholder: 'دوّر على محاضرة', maxlength: 60 });
    lq.addEventListener('input', () => drawLectures());
    function drawCourses() {
      if (!data.courses.length) { list.replaceChildren(h('p', { class: 'empty', text: 'لسه مفيش دورات. ابدأ بـ «دورة جديدة».' })); return; }
      list.replaceChildren(...data.courses.map((c, i) => h('div', { class: 'row-item course-row' },
        c.image ? h('img', { class: 'course-thumb', src: c.image, alt: '' }) : h('span', { class: 'course-thumb empty-thumb' }, icon('book')),
        h('div', { class: 'course-info' }, h('b', { text: c.title }), h('small', { class: 'muted', text: audienceText(c) }), h('small', { text: c.lectures.length + ' محاضرة' + (c.free ? '' : c.price ? ' · الدورة كاملة ' + c.price + ' جنيه' : '') })),
        h('div', { class: 'actions' }, tone(c.free ? 'مجانية' : 'مدفوعة', c.free ? 'ok' : 'warn'), tone(c.active ? 'ظاهرة' : 'مخفية', c.active ? 'ok' : 'bad'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: e => order(e.currentTarget, i, -1) }, icon('up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === data.courses.length - 1, onclick: e => order(e.currentTarget, i, 1) }, icon('down')),
          h('button', { class: 'btn outline small', type: 'button', onclick: () => courseDialog(c) }, icon('edit'), 'تعديل'),
          confirmButton('حذف', 'danger small', async btn => { busy(btn, true); const x = await call('admin.courseDelete', { id: c.id }); busy(btn, false); if (!x.ok) { alert(msg, message(x.code), 'error'); return; } data = x; alert(msg, 'اتحذفت الدورة. المحاضرات اللي جواها لسه موجودة.', 'success'); drawAll(); })))));
    }
    async function order(btn, i, d) {
      const ids = data.courses.map(c => c.id);
      [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
      busy(btn, true);
      const x = await call('admin.coursesOrder', { ids });
      if (!x.ok) { busy(btn, false); alert(msg, message(x.code), 'error'); return; }
      data = x; drawAll();
    }
    function drawLectures() {
      const q = lq.value.trim();
      const shown = data.lectures.filter(l => !q || l.title.includes(q));
      if (!shown.length) { lecBox.replaceChildren(h('p', { class: 'empty', text: data.lectures.length ? 'مفيش محاضرة بالاسم ده.' : 'لسه مفيش محاضرات.' })); return; }
      lecBox.replaceChildren(...shown.map(l => {
        const inCourses = data.courses.filter(c => c.lectures.includes(l.id)).map(c => c.title);
        return h('div', { class: 'row-item course-row' },
          h('div', { class: 'course-info' }, h('b', { text: l.title }), h('small', { class: 'muted', text: l.items.length ? l.items.map(x => (x.kind === 'video' ? 'فيديو: ' : 'PDF: ') + x.title).join(' · ') : 'لسه مفيهاش فيديو أو ملف' }), h('small', { text: inCourses.length ? 'في: ' + inCourses.join('، ') : 'مش مضافة لأي دورة' })),
          h('div', { class: 'actions' }, tone(l.price ? l.price + ' جنيه' : 'مجانية', l.price ? 'warn' : 'ok'), l.active ? null : tone('مخفية', 'bad'),
            h('button', { class: 'btn outline small', type: 'button', onclick: () => lectureDialog(l, () => { dlg.close(); drawAll(); }) }, icon('edit'), 'تعديل'),
            confirmButton('حذف', 'danger small', async btn => { busy(btn, true); const x = await call('admin.lectureDelete', { id: l.id }); busy(btn, false); if (!x.ok) { alert(msg, message(x.code), 'error'); return; } data = x; alert(msg, 'اتحذفت المحاضرة من كل الدورات.', 'success'); drawAll(); })));
      }));
    }
    function drawAll() { drawCourses(); drawLectures(); }
    drawAll();
    const steps = h('ol', { class: 'steps-guide' }, h('li', { text: 'اعمل الدورة وحدد تظهر لمين: السنة الدراسية، وأونلاين ولا سنتر، ومجانية ولا مدفوعة.' }), h('li', { text: 'ضيف جواها المحاضرات بالترتيب. المحاضرة الواحدة ممكن تحطها في أكتر من دورة.' }), h('li', { text: 'في كل محاضرة اختار الفيديو أو الـ PDF من الملفات اللي رفعتها، أو ارفعه من نفس المكان.' }));
    setView(
      card('الدورات', 'الطالب بيشوف الدورات اللي اتحددت لسنته وطريقة حضوره بس.', h('button', { class: 'btn primary', type: 'button', onclick: () => courseDialog(null) }, icon('plus'), 'دورة جديدة'), steps, msg, list),
      card('كل المحاضرات', 'محاضرة بتتعمل مرة وتتحط في أي دورة.', [field('بحث', lq), h('button', { class: 'btn outline', type: 'button', onclick: () => lectureDialog(null, () => { dlg.close(); drawAll(); }) }, icon('plus'), 'محاضرة جديدة')], lecBox));
    K._redraw = drawAll;
  }
  function courseDialog(c, draft) {
    const d = draft || (c ? { ...c, grades: c.grades.slice(), centers: c.centers.slice(), lectures: c.lectures.slice() } : { id: '', title: '', description: '', image: '', grades: [], audience: 'all', centers: [], free: true, price: 0, lectures: [], active: true });
    const box = note();
    const f = {
      title: h('input', { value: d.title, maxlength: 100, placeholder: 'مثال: 3 ثانوي سنتر سمارت' }),
      description: h('textarea', { value: d.description, maxlength: 600, rows: 3 }),
      audience: select([['all', 'أونلاين وسنتر'], ['online', 'أونلاين بس'], ['center', 'السنتر بس']], d.audience),
      price: h('input', { type: 'number', min: 0, max: 100000, dir: 'ltr', value: String(d.price || 0) })
    };
    ['title', 'description'].forEach(k => f[k].addEventListener('input', () => { d[k] = f[k].value; }));
    f.audience.addEventListener('change', () => { d.audience = f.audience.value; centersBox.hidden = d.audience !== 'center'; });
    f.price.addEventListener('input', () => { d.price = Math.max(0, parseInt(f.price.value, 10) || 0); });
    const grades = data.grades.map(g => { const x = check(g, d.grades.includes(g)); x.box.addEventListener('change', () => { d.grades = data.grades.filter((n, i) => grades[i].box.checked); }); return x; });
    const centers = data.centers.map(cn => { const x = check(cn.name, d.centers.includes(cn.id)); x.box.addEventListener('change', () => { d.centers = data.centers.filter((n, i) => centers[i].box.checked).map(n => n.id); }); return x; });
    const centersBox = h('div', { class: 'field wide', hidden: d.audience !== 'center' }, h('span', { class: 'label', text: 'سناتر معينة' }), data.centers.length ? h('div', { class: 'perm-grid' }, centers.map(x => x.el)) : h('p', { class: 'muted', text: 'لسه مفيش سناتر. ضيفها من «السناتر والمواعيد».' }), h('span', { class: 'hint', text: 'سيبها كلها فاضية علشان الدورة تظهر لطلاب كل السناتر.' }));
    const free = check('مجانية: كل المحاضرات جواها مجانية للطلاب دول من غير كود', d.free);
    const priceBox = field('سعر الدورة كاملة (اختياري)', f.price, 'لو حطيت سعر، الطالب يقدر يفتح الدورة كلها مرة واحدة بالمحفظة. سيبه 0 علشان يشتري كل محاضرة لوحدها.');
    priceBox.hidden = d.free;
    free.box.addEventListener('change', () => { d.free = free.box.checked; priceBox.hidden = d.free; });
    const active = check('ظاهرة للطلاب', d.active);
    active.box.addEventListener('change', () => { d.active = active.box.checked; });
    const img = h('div', { class: 'image-pick' });
    function drawImg() {
      img.replaceChildren(d.image ? h('img', { src: d.image, alt: 'صورة الدورة' }) : h('span', { class: 'empty-thumb' }, icon('image')),
        h('div', { class: 'toolbar' }, h('button', { class: 'btn outline small', type: 'button', onclick: e => { const b = e.currentTarget; picker('image/jpeg,image/png,image/webp', false, async ([file]) => { busy(b, true); try { const data64 = await compress(file); const x = await call('admin.courseImage', { image: data64.split(',')[1] }); if (!x.ok) alert(box, message(x.code)); else { d.image = x.url; drawImg(); } } catch { alert(box, 'تعذر قراءة الصورة.'); } busy(b, false); }); } }, icon('upload'), d.image ? 'غيّر الصورة' : 'ارفع صورة'), d.image ? h('button', { class: 'btn outline small', type: 'button', onclick: () => { d.image = ''; drawImg(); } }, 'شيل الصورة') : null));
    }
    drawImg();
    const lecs = h('div', { class: 'list' });
    const addSel = h('select', {});
    function drawLecs() {
      lecs.replaceChildren(...(d.lectures.length ? d.lectures.map((id, i) => {
        const l = data.lectures.find(x => x.id === id);
        if (!l) return null;
        return h('div', { class: 'row-item' }, h('span', {}, h('b', { class: 'num', text: String(i + 1).padStart(2, '0') }), ' ', l.title, ' ', h('small', { class: 'muted', text: '· ' + l.items.length + ' عنصر' + (d.free ? '' : l.price ? ' · ' + l.price + ' ج' : ' · مجانية') })),
          h('div', { class: 'actions' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: () => { [d.lectures[i - 1], d.lectures[i]] = [d.lectures[i], d.lectures[i - 1]]; drawLecs(); } }, icon('up')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === d.lectures.length - 1, onclick: () => { [d.lectures[i + 1], d.lectures[i]] = [d.lectures[i], d.lectures[i + 1]]; drawLecs(); } }, icon('down')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'تعديل المحاضرة', onclick: () => lectureDialog(l, () => courseDialog(c, d), () => courseDialog(c, d)) }, icon('edit')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'شيلها من الدورة', onclick: () => { d.lectures.splice(i, 1); drawLecs(); } }, icon('x'))));
      }).filter(Boolean) : [h('p', { class: 'muted', text: 'لسه مفيش محاضرات في الدورة.' })]));
      addSel.replaceChildren(h('option', { value: '', text: 'ضيف محاضرة موجودة…' }), ...data.lectures.filter(l => !d.lectures.includes(l.id)).map(l => h('option', { value: l.id, text: lectureLabel(l) })));
    }
    addSel.addEventListener('change', () => { if (addSel.value) { d.lectures.push(addSel.value); drawLecs(); } });
    drawLecs();
    const newLec = h('button', { class: 'btn outline', type: 'button', onclick: () => lectureDialog(null, id => { if (id && !d.lectures.includes(id)) d.lectures.push(id); courseDialog(c, d); }, () => courseDialog(c, d)) }, icon('plus'), 'محاضرة جديدة');
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const payload = { id: d.id, title: f.title.value.trim(), description: f.description.value.trim(), image: d.image, grades: d.grades, audience: d.audience, centers: d.audience === 'center' ? d.centers : [], free: d.free, price: d.free ? 0 : d.price, lectures: d.lectures, active: d.active };
      if (payload.title.length < 2) { alert(box, 'اكتب اسم الدورة.'); f.title.focus(); return; }
      if (!payload.grades.length) { alert(box, 'اختار سنة دراسية واحدة على الأقل.'); return; }
      busy(save, true);
      const x = await call('admin.courseSave', { course: payload });
      busy(save, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      data = x; dlg.close(); if (K._redraw) K._redraw();
    } }, icon('check'), d.id ? 'حفظ الدورة' : 'إنشاء الدورة');
    openDialog(d.id ? 'تعديل الدورة' : 'دورة جديدة', [
      h('div', { class: 'form-grid' }, field('اسم الدورة', f.title, '', true), field('وصف', f.description, 'اختياري', true), h('div', { class: 'field wide' }, h('span', { class: 'label', text: 'صورة الدورة' }), img)),
      h('div', { class: 'field' }, h('span', { class: 'label', text: 'السنة الدراسية' }), h('div', { class: 'perm-grid' }, grades.map(x => x.el))),
      h('div', { class: 'form-grid' }, field('تظهر لمين', f.audience, 'أونلاين بس أو السنتر بس أو الاتنين.'), centersBox),
      h('div', { class: 'list' }, free.el, priceBox, active.el),
      h('div', { class: 'field' }, h('span', { class: 'label', text: 'المحاضرات بالترتيب' }), lecs, h('div', { class: 'toolbar' }, h('div', { class: 'field' }, addSel), newLec)), box
    ], [save, h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إلغاء')]);
  }
  function lectureDialog(l, onSaved, onBack) {
    const d = l ? { ...l, items: l.items.map(x => ({ ...x })) } : { id: '', title: '', description: '', price: 0, active: true, items: [] };
    const box = note();
    const queue = h('div', { class: 'list' });
    const f = { title: h('input', { value: d.title, maxlength: 120, placeholder: 'مثال: المحاضرة الأولى' }), description: h('textarea', { value: d.description, maxlength: 600, rows: 2 }), price: h('input', { type: 'number', min: 0, max: 100000, dir: 'ltr', value: String(d.price || 0) }) };
    const active = check('ظاهرة للطلاب', d.active);
    const items = h('div', { class: 'list' });
    const files = kind => data.files.filter(x => x.kind === kind);
    function drawItems() {
      items.replaceChildren(...(d.items.length ? d.items.map((it, i) => {
        const title = h('input', { value: it.title, maxlength: 100, placeholder: it.kind === 'video' ? 'مثال: شرح المحاضرة' : 'مثال: الواجب', 'aria-label': 'اسم العنصر' });
        title.addEventListener('input', () => { it.title = title.value; });
        const sel = h('select', { 'aria-label': 'الملف' }, h('option', { value: '', text: files(it.kind).length ? 'اختار الملف…' : 'لسه مفيش ملفات، ارفع واحد' }), ...files(it.kind).map(x => h('option', { value: x.id, selected: x.id === it.file, text: x.name + ' · ' + MB(x.size) })));
        sel.addEventListener('change', () => { it.file = sel.value; if (!it.title.trim()) { const fl = data.files.find(x => x.id === sel.value); if (fl) { it.title = fl.name; title.value = fl.name; } } });
        const upBtn = h('button', { class: 'btn outline small', type: 'button', disabled: !K.can('media.upload') }, icon('upload'), 'ارفع');
        upBtn.addEventListener('click', () => picker(it.kind === 'video' ? 'video/*' : 'application/pdf', false, async ([file]) => { busy(upBtn, true); const fl = await runUpload(file, it.kind, queue); busy(upBtn, false); if (fl) { it.file = fl.id; if (!it.title.trim()) it.title = fl.name; drawItems(); } }));
        const imgBtn = it.kind === 'pdf' && K.can('media.upload') ? h('button', { class: 'btn outline small', type: 'button', onclick: () => { const keep = { d, i }; imagesDialog(null, fl => { if (fl) { keep.d.items[keep.i].file = fl.id; if (!keep.d.items[keep.i].title.trim()) keep.d.items[keep.i].title = fl.name; } reopen(); }); } }, icon('image'), 'من صور') : null;
        return h('div', { class: 'item-row' }, h('span', { class: 'kind' }, icon(it.kind === 'video' ? 'video' : 'pdf')), title, sel, h('div', { class: 'actions' }, upBtn, imgBtn,
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: () => { [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; drawItems(); } }, icon('up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === d.items.length - 1, onclick: () => { [d.items[i + 1], d.items[i]] = [d.items[i], d.items[i + 1]]; drawItems(); } }, icon('down')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'حذف العنصر', onclick: () => { d.items.splice(i, 1); drawItems(); } }, icon('trash'))));
      }) : [h('p', { class: 'muted', text: 'ضيف فيديو أو PDF. مثال: فيديو الشرح، ثم ملزمة PDF، ثم فيديو حل الواجب.' })]));
    }
    const addVideo = h('button', { class: 'btn outline', type: 'button', onclick: () => { if (d.items.length >= 20) return; d.items.push({ id: '', kind: 'video', title: '', file: '' }); drawItems(); } }, icon('video'), 'فيديو');
    const addPdf = h('button', { class: 'btn outline', type: 'button', onclick: () => { if (d.items.length >= 20) return; d.items.push({ id: '', kind: 'pdf', title: '', file: '' }); drawItems(); } }, icon('pdf'), 'PDF');
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      d.title = f.title.value.trim(); d.description = f.description.value.trim(); d.price = Math.max(0, parseInt(f.price.value, 10) || 0); d.active = active.box.checked;
      if (d.title.length < 2) { alert(box, 'اكتب اسم المحاضرة.'); return; }
      const bad = d.items.findIndex(x => !x.file || !x.title.trim());
      if (bad !== -1) { alert(box, `العنصر رقم ${bad + 1} محتاج اسم وملف.`); return; }
      busy(save, true);
      const x = await call('admin.lectureSave', { lecture: { id: d.id, title: d.title, description: d.description, price: d.price, active: d.active, items: d.items.map(it => ({ id: it.id, kind: it.kind, title: it.title.trim(), file: it.file })) } });
      busy(save, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      data = x;
      if (onSaved) onSaved(x.saved);
    } }, icon('check'), d.id ? 'حفظ المحاضرة' : 'إنشاء المحاضرة');
    function reopen() {
      openDialog(d.id ? 'تعديل المحاضرة' : 'محاضرة جديدة', [
        h('div', { class: 'form-grid' }, field('اسم المحاضرة', f.title, '', true), field('وصف', f.description, 'اختياري', true), field('السعر بالجنيه', f.price, '0 = مجانية. في الدورات المجانية المحاضرة بتبقى مجانية تلقائي.'), h('div', { class: 'field' }, h('span', { class: 'label', text: 'الحالة' }), active.el)),
        h('div', { class: 'field' }, h('span', { class: 'label', text: 'محتوى المحاضرة بالترتيب' }), items, h('div', { class: 'toolbar' }, h('span', { class: 'muted', text: 'ضيف:' }), addVideo, addPdf)), queue, box
      ], [save, h('button', { class: 'btn outline', type: 'button', onclick: () => (onBack ? onBack() : dlg.close()) }, onBack ? 'رجوع للدورة' : 'إلغاء')]);
      drawItems();
    }
    reopen();
  }
  let mediaQueue = null;
  async function media() {
    const r = await call('admin.media');
    if (!r.ok) return failed(r, media);
    if (data) data.files = r.files; else { const x = await load(); if (!x.ok) data = { files: r.files, courses: [], lectures: [], grades: [], centers: [] }; }
    const used = {};
    (data.lectures || []).forEach(l => l.items.forEach(x => { used[x.file] = (used[x.file] || 0) + 1; }));
    const msg = note();
    const queue = mediaQueue || (mediaQueue = h('div', { class: 'list' }));
    const warn = [];
    if (!r.drive.folder) warn.push('أضف GOOGLE_DRIVE_FOLDER_ID في Script Properties علشان الرفع يشتغل.');
    if (!r.drive.service && r.drive.auth !== 'owner') warn.push('مفاتيح حساب الخدمة ناقصة؛ الرفع هيتم بحساب صاحب السكريبت.');
    const kind = select([['', 'كل الأنواع'], ['video', 'فيديو'], ['pdf', 'PDF']], '');
    const tableBox = h('div');
    function draw() {
      const list = r.files.filter(f => !kind.value || f.kind === kind.value);
      tableBox.replaceChildren(grid(['الملف', 'النوع', 'الحجم', 'مستخدم في', 'اترفع', ''], list.map(f => [h('b', { text: f.name }), tone(f.kind === 'video' ? 'فيديو' : 'PDF', f.kind === 'video' ? 'ok' : 'warn'), h('span', { class: 'num', text: MB(f.size) }), (used[f.id] || 0) + ' محاضرة', h('small', { text: date(f.createdAt, true) + (f.createdBy ? ' · ' + f.createdBy : '') }),
        used[f.id] ? '' : confirmButton('حذف', 'danger small', async btn => { busy(btn, true); const x = await call('admin.fileDelete', { id: f.id }); busy(btn, false); if (!x.ok) { alert(msg, message(x.code)); return; } r.files = x.files; draw(); })]), 'لسه مفيش ملفات مرفوعة.'));
    }
    kind.addEventListener('change', draw);
    draw();
    const after = () => media();
    const vBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => picker('video/*', true, files => files.forEach(file => runUpload(file, 'video', queue, after))) }, icon('video'), 'رفع فيديو');
    const pBtn = h('button', { class: 'btn outline', type: 'button', onclick: () => picker('application/pdf', true, files => files.forEach(file => runUpload(file, 'pdf', queue, after))) }, icon('pdf'), 'رفع PDF');
    const iBtn = h('button', { class: 'btn outline', type: 'button', onclick: () => imagesDialog(() => { if (location.hash === '#media') media(); }, null) }, icon('image'), 'صور ← PDF');
    setView(card('الفيديوهات والملفات', 'بتترفع على جوجل درايف بتاعك، والطالب بيشوفها من خلال الوركر بس.', [vBtn, pBtn, iBtn],
      warn.length ? h('div', { class: 'list' }, warn.map(t => h('p', { class: 'alert', 'data-type': 'warn', text: t }))) : null,
      h('p', { class: 'alert', 'data-type': 'info', text: 'الفيديو بيترفع على أجزاء، فلو النت قطع بيكمل لوحده. سيب الصفحة مفتوحة لحد ما يخلص. بعد الرفع اختار الملف من جوه المحاضرة.' }),
      queue, msg, h('div', { class: 'toolbar' }, field('النوع', kind)), tableBox));
  }
  async function centers() {
    const r = await call('admin.centers');
    if (!r.ok) return failed(r, centers);
    const list = r.centers.map(c => ({ ...c, schedules: c.schedules.map(s => ({ ...s })) }));
    const msg = note();
    const box = h('div', { class: 'list' });
    function draw() {
      box.replaceChildren(...(list.length ? list.map((c, i) => {
        const name = h('input', { value: c.name, maxlength: 80, placeholder: 'اسم السنتر', 'aria-label': 'اسم السنتر' });
        const addr = h('input', { value: c.address, maxlength: 160, placeholder: 'العنوان أو المنطقة (اختياري)', 'aria-label': 'العنوان' });
        name.addEventListener('input', () => { c.name = name.value; });
        addr.addEventListener('input', () => { c.address = addr.value; });
        const act = check('متاح في التسجيل', c.active); act.box.addEventListener('change', () => { c.active = act.box.checked; });
        const rows = h('div', { class: 'list' }, ...c.schedules.map((s, j) => {
          const g = select([['', 'كل المراحل'], ...r.grades.map(x => [x, x])], s.grade);
          g.addEventListener('change', () => { s.grade = g.value; });
          const lab = h('input', { value: s.label, maxlength: 60, placeholder: 'مثال: السبت والثلاثاء 4 العصر', 'aria-label': 'الميعاد' });
          lab.addEventListener('input', () => { s.label = lab.value; });
          return h('div', { class: 'sched-row' }, g, lab, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'حذف الميعاد', onclick: () => { c.schedules.splice(j, 1); draw(); } }, icon('trash')));
        }));
        return h('section', { class: 'center-card' }, h('div', { class: 'form-grid' }, field('السنتر', name), field('العنوان', addr)), h('span', { class: 'label', text: 'المواعيد' }), rows,
          h('div', { class: 'toolbar' }, h('button', { class: 'btn outline small', type: 'button', onclick: () => { c.schedules.push({ id: '', grade: '', label: '' }); draw(); } }, icon('plus'), 'ميعاد'), act.el, h('span', { class: 'spacer' }), confirmButton('حذف السنتر', 'danger small', () => { list.splice(i, 1); draw(); })));
      }) : [h('p', { class: 'empty', text: 'لسه مفيش سناتر. الطلاب هيقدروا يسجلوا أونلاين بس.' })]));
    }
    draw();
    const add = h('button', { class: 'btn outline', type: 'button', onclick: () => { list.push({ id: '', name: '', address: '', active: true, schedules: [{ id: '', grade: '', label: '' }] }); draw(); box.lastChild.querySelector('input').focus(); } }, icon('plus'), 'سنتر جديد');
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const bad = list.findIndex(c => c.name.trim().length < 2 || c.schedules.some(s => s.label.trim().length < 2));
      if (bad !== -1) { alert(msg, `راجع السنتر رقم ${bad + 1}: الاسم والمواعيد حرفين على الأقل.`); return; }
      busy(save, true);
      const x = await call('admin.centersSave', { centers: list.map(c => ({ id: c.id, name: c.name.trim(), address: c.address.trim(), active: !!c.active, schedules: c.schedules.map(s => ({ id: s.id, grade: s.grade, label: s.label.trim() })) })) });
      busy(save, false);
      if (!x.ok) { alert(msg, message(x.code)); return; }
      alert(msg, 'اتحفظت السناتر، وهتظهر للطلاب في التسجيل.', 'success');
      list.splice(0, list.length, ...x.centers.map(c => ({ ...c, schedules: c.schedules.map(s => ({ ...s })) })));
      draw();
    } }, icon('check'), 'حفظ السناتر');
    setView(card('السناتر والمواعيد', 'الطالب اللي بيختار «سنتر» وقت التسجيل بيختار السنتر والميعاد من هنا. الميعاد ممكن يكون لمرحلة معينة أو لكل المراحل.', [add, save], msg, box));
  }
  return { courses, media, centers, upload };
})();
