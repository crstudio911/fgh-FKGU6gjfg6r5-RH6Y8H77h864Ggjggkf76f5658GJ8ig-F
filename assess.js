window.PanelAssess = (() => {
  const K = window.Kit;
  const { h, icon, call, setView, failed, tone, note, card, field, select, check, grid, confirmButton, openDialog, dlg, busy, alert, message, date } = K;
  const KIND = { homework: 'واجب', exam: 'امتحان' };
  const TYPE = { questions: 'أسئلة مكتوبة', pdf: 'ملف PDF، كل صفحة سؤال' };
  const LABELS = { abc: ['a', 'b', 'c', 'd', 'e', 'f'], ABC: ['A', 'B', 'C', 'D', 'E', 'F'], num: ['1', '2', '3', '4', '5', '6'], ar: ['أ', 'ب', 'ج', 'د', 'هـ', 'و'] };
  const LABEL_NAMES = { abc: 'a, b, c, d', ABC: 'A, B, C, D', num: '1, 2, 3, 4', ar: 'أ, ب, ج, د' };
  const REVIEW = { none: 'متظهرش للطالب', submit: 'تظهر بعد ما يسلّم على طول', close: 'تظهر بعد ميعاد القفل' };
  const STATUS = { open: ['لسه بيحل', 'warn'], done: ['سلّم', 'ok'], left: ['خرج من الامتحان', 'bad'], time: ['الوقت خلص', 'warn'] };
  const localPdf = new Map();
  let filter = 'all';
  let lib = null;
  function pdfjs() {
    if (!lib) lib = import(new URL('vendor/pdf.min.mjs', location.href).href).then(m => { m.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href; return m; }).catch(e => { lib = null; throw e; });
    return lib;
  }
  dlg.addEventListener('close', () => dlg.classList.remove('wide'));
  const wide = () => dlg.classList.add('wide');
  const toLocal = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocal = v => (v ? new Date(v).toISOString() : '');
  const span = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), x = s % 60; return m ? m + ' د' + (x ? ' ' + x + ' ث' : '') : x + ' ث'; };
  const windowText = a => [a.startsAt ? 'من ' + date(a.startsAt, true) : '', a.endsAt ? 'لحد ' + date(a.endsAt, true) : ''].filter(Boolean).join(' · ');

  async function list() {
    const r = await K.get('assess', () => call('admin.assess'));
    if (!r.ok) return failed(r, list);
    const msg = note('success');
    const box = h('div', { class: 'list' });
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'تصفية' }, [['all', 'الكل'], ['homework', 'الواجبات'], ['exam', 'الامتحانات']].map(([k, t]) => h('button', { class: 'chip' + (filter === k ? ' active' : ''), type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; list(); } }, t)));
    const shown = r.assessments.filter(a => filter === 'all' || a.kind === filter);
    box.replaceChildren(...(shown.length ? shown.map(a => h('div', { class: 'row-item course-row assess-row' },
      h('span', { class: 'assess-icon', 'data-kind': a.kind }, icon(a.kind === 'exam' ? 'timer' : 'clipboard')),
      h('div', { class: 'course-info' }, h('b', { text: a.title }),
        h('small', { class: 'muted', text: [a.count + ' سؤال', a.type === 'pdf' ? 'PDF' : 'أسئلة مكتوبة', a.minutes ? a.minutes + ' دقيقة' : 'بدون وقت', LABEL_NAMES[a.labels], windowText(a)].filter(Boolean).join(' · ') }),
        h('small', { text: a.lectures.length ? 'في: ' + a.lectures.join('، ') : 'مش مضاف لأي محاضرة لسه' })),
      h('div', { class: 'actions' }, tone(KIND[a.kind], a.kind === 'exam' ? 'bad' : 'ok'), a.active ? null : tone('مخفي', 'warn'), tone(a.attempts + ' طالب', ''),
        K.can('results.view') ? h('button', { class: 'btn outline small', type: 'button', onclick: () => results(a) }, icon('chart'), 'الدرجات') : null,
        K.can('assess.edit') ? h('button', { class: 'btn outline small', type: 'button', onclick: () => editor(a.id) }, icon('edit'), 'تعديل') : null,
        K.can('assess.edit') ? confirmButton('حذف', 'danger small', async btn => { busy(btn, true); const x = await call('admin.assessDelete', { id: a.id }); busy(btn, false); if (!x.ok) { alert(msg, message(x.code), 'error'); return; } K.put('assess', x); alert(msg, 'اتحذف، واتشال من كل المحاضرات. الدرجات القديمة لسه محفوظة في الشيت.', 'success'); list(); }) : null))) : [h('p', { class: 'empty', text: r.assessments.length ? 'مفيش حاجة هنا.' : 'لسه مفيش واجبات أو امتحانات. ابدأ بواحد جديد، وبعدين ضيفه جوه أي محاضرة.' })]));
    const add = K.can('assess.edit') ? [h('button', { class: 'btn primary', type: 'button', onclick: () => editor(null, 'homework') }, icon('clipboard'), 'واجب جديد'), h('button', { class: 'btn outline', type: 'button', onclick: () => editor(null, 'exam') }, icon('timer'), 'امتحان جديد')] : null;
    setView(card('الواجبات والامتحانات', 'اعمل الواجب أو الامتحان هنا، وبعدين ضيفه جوه المحاضرة من «الدورات والمحاضرات».', add,
      h('ol', { class: 'steps-guide' }, h('li', { text: 'نوعين: أسئلة تكتبها هنا وتختار الإجابة الصح، أو ملف PDF كل صفحة فيه سؤال وتحدد إجابة كل صفحة.' }), h('li', { text: 'الواجب ممكن يكون من غير وقت، والامتحان لازم له وقت. الطالب لو خرج من الامتحان مش بيقدر يكمل.' }), h('li', { text: 'الإجابات الصح مش بتوصل لجهاز الطالب غير بعد ما يسلّم، ولو انت سمحت بكده.' })),
      msg, chips, box));
  }

  async function editor(id, kind, back) {
    let a;
    if (id) {
      openDialog('جاري التحميل…', [h('p', { class: 'loading-view', text: 'جاري التحميل…' })], []);
      const r = await call('admin.assessGet', { id });
      if (!r.ok) { openDialog('تعذر الفتح', [h('p', { class: 'alert', text: message(r.code) })], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]); return; }
      a = r.assessment;
      a.questions = a.questions.map(q => ({ text: q.text, choices: q.choices.slice(), answer: q.answer }));
      a.answers = a.answers.slice();
    } else {
      const k = kind === 'exam' ? 'exam' : 'homework';
      a = { id: '', title: '', kind: k, type: 'questions', minutes: k === 'exam' ? 30 : 0, labels: 'abc', shuffle: false, review: k === 'exam' ? 'none' : 'submit', active: true, startsAt: '', endsAt: '', questions: [{ text: '', choices: ['', '', '', ''], answer: -1 }], file: '', pages: 0, choices: 4, answers: [] };
    }
    const meta = await K.get('assess', () => call('admin.assess'));
    const pdfFiles = () => (meta.ok ? meta.files : []);
    const box = note();
    const queue = h('div', { class: 'list' });
    const f = {
      title: h('input', { value: a.title, maxlength: 120, placeholder: a.kind === 'exam' ? 'مثال: امتحان الباب الأول' : 'مثال: واجب المحاضرة التالتة', autocomplete: 'off' }),
      minutes: h('input', { type: 'number', min: 0, max: 300, dir: 'ltr', value: String(a.minutes || 0) }),
      labels: select(Object.entries(LABEL_NAMES).map(([k, t]) => [k, t]), a.labels),
      review: select(Object.entries(REVIEW), a.review),
      starts: h('input', { type: 'datetime-local', dir: 'ltr', value: toLocal(a.startsAt) }),
      ends: h('input', { type: 'datetime-local', dir: 'ltr', value: toLocal(a.endsAt) })
    };
    const shuffle = check('ترتيب مختلف للأسئلة لكل طالب', a.shuffle);
    const active = check('ظاهر للطلاب', a.active);
    f.title.addEventListener('input', () => { a.title = f.title.value; });
    f.minutes.addEventListener('input', () => { a.minutes = Math.max(0, parseInt(f.minutes.value, 10) || 0); });
    f.labels.addEventListener('change', () => { a.labels = f.labels.value; drawBody(); });
    f.review.addEventListener('change', () => { a.review = f.review.value; });
    f.starts.addEventListener('change', () => { a.startsAt = fromLocal(f.starts.value); });
    f.ends.addEventListener('change', () => { a.endsAt = fromLocal(f.ends.value); });
    shuffle.box.addEventListener('change', () => { a.shuffle = shuffle.box.checked; });
    active.box.addEventListener('change', () => { a.active = active.box.checked; });
    const seg = (name, options, value, onPick) => h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name }, options.map(([v, t, ic]) => h('button', { type: 'button', class: 'seg-btn' + (v === value ? ' active' : ''), role: 'radio', 'aria-checked': String(v === value), onclick: () => onPick(v) }, ic ? icon(ic) : null, t)));
    const kindBox = h('div');
    const typeBox = h('div');
    const timeHint = h('span', { class: 'hint' });
    const body = h('div', { class: 'assess-body' });
    function drawHead() {
      kindBox.replaceChildren(seg('النوع', [['homework', 'واجب', 'clipboard'], ['exam', 'امتحان', 'timer']], a.kind, v => { a.kind = v; if (v === 'exam' && !a.minutes) { a.minutes = 30; f.minutes.value = '30'; } drawHead(); }));
      typeBox.replaceChildren(seg('شكل الأسئلة', [['questions', 'أسئلة مكتوبة', 'list'], ['pdf', 'ملف PDF', 'pdf']], a.type, v => { a.type = v; drawHead(); drawBody(); }));
      timeHint.textContent = a.kind === 'exam' ? 'إجباري للامتحان. لو الطالب خرج من الصفحة الامتحان بيتقفل على إجاباته.' : '0 = من غير وقت. الطالب يقدر يقفل ويرجع يكمل.';
    }
    const labelOf = i => LABELS[a.labels][i] || String(i + 1);
    function drawQuestions() {
      const qs = a.questions;
      const cards = qs.map((q, i) => {
        const text = h('textarea', { value: q.text, maxlength: 600, rows: 2, placeholder: 'نص السؤال', 'aria-label': 'نص السؤال ' + (i + 1) });
        text.addEventListener('input', () => { q.text = text.value; });
        const group = 'q' + i + '-' + Math.random().toString(36).slice(2, 6);
        const opts = q.choices.map((c, j) => {
          const radio = h('input', { type: 'radio', name: group, checked: q.answer === j, 'aria-label': 'الإجابة الصح ' + labelOf(j) });
          radio.addEventListener('change', () => { q.answer = j; cardEl.classList.remove('missing'); });
          const input = h('input', { value: c, maxlength: 200, placeholder: 'اختيار ' + labelOf(j), 'aria-label': 'اختيار ' + labelOf(j) });
          input.addEventListener('input', () => { q.choices[j] = input.value; });
          return h('div', { class: 'choice-row' + (q.answer === j ? ' right' : '') }, h('label', { class: 'choice-pick', title: 'الإجابة الصح' }, radio, h('b', { class: 'choice-label', text: labelOf(j) })), input,
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'شيل الاختيار', disabled: q.choices.length <= 2, onclick: () => { q.choices.splice(j, 1); if (q.answer === j) q.answer = -1; else if (q.answer > j) q.answer--; drawBody(); } }, icon('x')));
        });
        const cardEl = h('section', { class: 'q-card' + (q.answer < 0 ? ' missing' : '') },
          h('div', { class: 'q-head' }, h('b', { class: 'num', text: String(i + 1).padStart(2, '0') }), h('span', { class: 'muted', text: q.answer < 0 ? 'اختار الإجابة الصح' : 'الإجابة الصح: ' + labelOf(q.answer) }), h('span', { class: 'spacer' }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: () => { [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; drawBody(); } }, icon('up')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === qs.length - 1, onclick: () => { [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; drawBody(); } }, icon('down')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'نسخ السؤال', disabled: qs.length >= 100, onclick: () => { qs.splice(i + 1, 0, { text: q.text, choices: q.choices.slice(), answer: q.answer }); drawBody(); } }, icon('copy')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'حذف السؤال', disabled: qs.length <= 1, onclick: () => { qs.splice(i, 1); drawBody(); } }, icon('trash'))),
          text, h('div', { class: 'choices' }, opts),
          q.choices.length < 6 ? h('button', { class: 'btn outline small', type: 'button', onclick: () => { q.choices.push(''); drawBody(); } }, icon('plus'), 'اختيار') : null);
        return cardEl;
      });
      const add = h('button', { class: 'btn outline', type: 'button', disabled: qs.length >= 100, onclick: () => { qs.push({ text: '', choices: ['', '', '', ''], answer: -1 }); drawBody(); body.lastChild.previousSibling?.scrollIntoView({ block: 'center' }); } }, icon('plus'), 'سؤال جديد');
      body.replaceChildren(h('p', { class: 'muted', text: qs.length + ' سؤال · دوس على الحرف جنب الاختيار علشان تحدده إجابة صح.' }), ...cards, add);
    }
    let pdfDoc = null, pdfFor = '';
    async function openPdf(fileId, holder, info) {
      info.textContent = 'جاري فتح الملف…';
      try {
        const m = await pdfjs();
        let src;
        if (localPdf.has(fileId)) src = { data: new Uint8Array(await localPdf.get(fileId).arrayBuffer()) };
        else { const t = await call('admin.mediaTicket', { id: fileId }); if (!t.ok) throw new Error(t.code); src = { url: t.url, withCredentials: false }; }
        if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null; }
        pdfDoc = await m.getDocument({ ...src, isEvalSupported: false, disableAutoFetch: true, rangeChunkSize: 262144 }).promise;
        pdfFor = fileId;
        return pdfDoc;
      } catch (e) { info.textContent = 'تعذر فتح الملف للمعاينة. تقدر تكتب عدد الصفحات وتحدد الإجابات من غير معاينة.'; return null; }
    }
    function drawPdf() {
      const fileSel = h('select', { 'aria-label': 'ملف الأسئلة' }, h('option', { value: '', text: pdfFiles().length ? 'اختار ملف PDF…' : 'لسه مفيش ملفات PDF، ارفع واحد' }), ...pdfFiles().map(x => h('option', { value: x.id, selected: x.id === a.file, text: x.name + ' · ' + (window.PanelContent ? window.PanelContent.MB(x.size) : '') })));
      fileSel.addEventListener('change', () => { a.file = fileSel.value; a.pages = 0; a.answers = []; drawBody(); });
      const upBtn = K.can('media.upload') ? h('button', { class: 'btn outline small', type: 'button', onclick: () => window.PanelContent.picker('application/pdf', false, async ([file]) => { busy(upBtn, true); const fl = await window.PanelContent.runUpload(file, 'pdf', queue); busy(upBtn, false); if (fl) { localPdf.set(fl.id, file); K.drop('assess'); const m2 = await K.get('assess', () => call('admin.assess')); if (m2.ok) meta.files = m2.files; a.file = fl.id; a.pages = 0; a.answers = []; drawBody(); } }) }, icon('upload'), 'ارفع PDF') : null;
      const imgBtn = K.can('media.upload') ? h('button', { class: 'btn outline small', type: 'button', onclick: () => window.PanelContent.imagesDialog(null, async (fl, blob) => { if (fl) { if (blob) localPdf.set(fl.id, blob); K.drop('assess'); const m2 = await K.get('assess', () => call('admin.assess')); if (m2.ok) meta.files = m2.files; a.file = fl.id; a.pages = 0; a.answers = []; } reopen(); }) }, icon('image'), 'من صور على جهازك') : null;
      const choicesSel = select([2, 3, 4, 5, 6].map(n => [String(n), n + ' اختيارات']), String(a.choices || 4));
      choicesSel.addEventListener('change', () => { a.choices = Number(choicesSel.value); a.answers = a.answers.map(x => (x >= a.choices ? -1 : x)); drawBody(); });
      const pagesInput = h('input', { type: 'number', min: 1, max: 200, dir: 'ltr', value: String(a.pages || ''), placeholder: 'تلقائي' });
      pagesInput.addEventListener('change', () => { const n = Math.max(0, Math.min(200, parseInt(pagesInput.value, 10) || 0)); a.pages = n; a.answers = Array.from({ length: n }, (_, i) => (a.answers[i] >= 0 ? a.answers[i] : -1)); drawPages(); });
      const info = h('p', { class: 'muted' });
      const grid2 = h('div', { class: 'pages-grid' });
      const progress = h('span', { class: 'pill' });
      function drawPages() {
        const n = a.pages;
        progress.textContent = a.answers.filter(x => x >= 0).length + ' / ' + n + ' إجابة';
        progress.dataset.tone = n && a.answers.filter(x => x >= 0).length === n ? 'ok' : 'warn';
        const thumbs = [];
        grid2.replaceChildren(...Array.from({ length: n }, (_, i) => {
          const canvas = h('canvas', { class: 'page-canvas', width: 10, height: 14, 'aria-label': 'صفحة ' + (i + 1) });
          thumbs.push(canvas);
          const picks = Array.from({ length: a.choices }, (_, j) => h('button', { type: 'button', class: 'ans-btn' + (a.answers[i] === j ? ' on' : ''), 'aria-pressed': String(a.answers[i] === j), 'aria-label': 'صفحة ' + (i + 1) + ' الإجابة ' + labelOf(j), onclick: e => { a.answers[i] = j; e.currentTarget.parentNode.querySelectorAll('.ans-btn').forEach((b, k) => { b.classList.toggle('on', k === j); b.setAttribute('aria-pressed', String(k === j)); }); e.currentTarget.closest('.page-card').classList.remove('missing'); progress.textContent = a.answers.filter(x => x >= 0).length + ' / ' + n + ' إجابة'; progress.dataset.tone = a.answers.filter(x => x >= 0).length === n ? 'ok' : 'warn'; } }, labelOf(j)));
          return h('figure', { class: 'page-card' + (a.answers[i] >= 0 ? '' : ' missing') }, h('div', { class: 'page-thumb' }, canvas), h('figcaption', {}, h('b', { class: 'num', text: 'سؤال ' + (i + 1) }), h('div', { class: 'ans-row' }, picks)));
        }));
        if (pdfDoc && pdfFor === a.file) renderThumbs(thumbs);
      }
      async function renderThumbs(list) {
        for (let i = 0; i < list.length; i++) {
          if (!list[i].isConnected) return;
          try {
            const page = await pdfDoc.getPage(i + 1);
            const vp0 = page.getViewport({ scale: 1 });
            const vp = page.getViewport({ scale: 360 / vp0.width });
            list[i].width = Math.floor(vp.width); list[i].height = Math.floor(vp.height);
            await page.render({ canvasContext: list[i].getContext('2d'), viewport: vp }).promise;
          } catch { return; }
        }
      }
      const parts = [h('div', { class: 'toolbar' }, h('div', { class: 'field grow' }, h('label', { text: 'ملف الأسئلة' }), fileSel), upBtn, imgBtn), queue];
      if (a.file) {
        parts.push(h('div', { class: 'form-grid' }, field('عدد الاختيارات في كل سؤال', choicesSel), field('عدد الأسئلة (الصفحات)', pagesInput, 'بيتحسب لوحده من الملف.')), h('div', { class: 'toolbar' }, info, h('span', { class: 'spacer' }), progress), grid2);
        drawPages();
        if (!(pdfDoc && pdfFor === a.file)) openPdf(a.file, grid2, info).then(doc => {
          if (!doc || !grid2.isConnected) return;
          info.textContent = doc.numPages + ' صفحة في الملف. حدد الإجابة الصح تحت كل صفحة.';
          if (a.pages !== doc.numPages) { a.pages = Math.min(200, doc.numPages); a.answers = Array.from({ length: a.pages }, (_, i) => (a.answers[i] >= 0 && a.answers[i] < a.choices ? a.answers[i] : -1)); pagesInput.value = String(a.pages); }
          drawPages();
        });
        else info.textContent = pdfDoc.numPages + ' صفحة في الملف. حدد الإجابة الصح تحت كل صفحة.';
      } else parts.push(h('p', { class: 'empty', text: 'اختار ملف PDF مرفوع، أو ارفع واحد، أو اعمل واحد من صور على جهازك. الصور بتتجمع في ملف على جهازك الأول وبتشوف المعاينة قبل الرفع.' }));
      body.replaceChildren(...parts);
    }
    function drawBody() { if (a.type === 'pdf') drawPdf(); else drawQuestions(); }
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      a.title = f.title.value.trim().replace(/\s+/g, ' ');
      a.minutes = Math.max(0, parseInt(f.minutes.value, 10) || 0);
      if (a.title.length < 2) { alert(box, 'اكتب عنوان من حرفين على الأقل.'); f.title.focus(); return; }
      if (a.kind === 'exam' && a.minutes < 1) { alert(box, message('exam_time')); f.minutes.focus(); return; }
      if (a.minutes > 300) { alert(box, 'الوقت لحد 300 دقيقة.'); return; }
      if (a.startsAt && a.endsAt && Date.parse(a.endsAt) <= Date.parse(a.startsAt)) { alert(box, message('dates')); return; }
      const payload = { id: a.id, title: a.title, kind: a.kind, type: a.type, minutes: a.minutes, labels: a.labels, shuffle: a.shuffle, review: a.review, active: a.active, startsAt: a.startsAt, endsAt: a.endsAt };
      if (a.type === 'questions') {
        const bad = a.questions.findIndex(q => !q.text.trim() || q.choices.some(c => !c.trim()) || q.answer < 0 || q.answer >= q.choices.length);
        if (bad !== -1) { alert(box, `السؤال رقم ${bad + 1} محتاج نص، وكل اختياراته مكتوبة، وإجابة صح.`); body.querySelectorAll('.q-card')[bad]?.scrollIntoView({ block: 'center' }); return; }
        payload.questions = a.questions.map(q => ({ text: q.text.trim(), choices: q.choices.map(c => c.trim()), answer: q.answer }));
      } else {
        if (!a.file) { alert(box, 'اختار ملف الأسئلة.'); return; }
        if (!a.pages) { alert(box, 'اكتب عدد الأسئلة.'); return; }
        const miss = a.answers.findIndex(x => !(x >= 0));
        if (miss !== -1) { alert(box, `حدد الإجابة الصح للسؤال رقم ${miss + 1}.`); body.querySelectorAll('.page-card')[miss]?.scrollIntoView({ block: 'center' }); return; }
        Object.assign(payload, { file: a.file, pages: a.pages, choices: a.choices, answers: a.answers.slice(0, a.pages) });
      }
      busy(save, true);
      const x = await call('admin.assessSave', { assessment: payload });
      busy(save, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      K.put('assess', x);
      const saved = x.assessments.find(y => y.id === x.saved);
      if (back) { back(saved); return; }
      dlg.close();
      if (location.hash === '#assess') list();
    } }, icon('check'), a.id ? 'حفظ' : 'إنشاء');
    function reopen() {
      wide();
      openDialog(a.id ? 'تعديل ' + KIND[a.kind] : KIND[a.kind] + ' جديد', [
        h('div', { class: 'form-grid' }, field('العنوان', f.title, '', true), h('div', { class: 'field' }, h('span', { class: 'label', text: 'النوع' }), kindBox), field('الوقت بالدقايق', f.minutes, '', false), h('div', { class: 'field wide' }, timeHint),
          field('شكل حروف الاختيارات', f.labels), field('الإجابات الصح بعد التسليم', f.review, 'لو اخترت «بعد ميعاد القفل» لازم تحدد ميعاد القفل.'), field('يتفتح من', f.starts, 'اختياري'), field('يتقفل في', f.ends, 'اختياري. بعده محدش يقدر يبدأ.')),
        h('div', { class: 'list' }, shuffle.el, active.el),
        h('div', { class: 'field' }, h('span', { class: 'label', text: 'الأسئلة' }), typeBox), body, box
      ], [save, h('button', { class: 'btn outline', type: 'button', onclick: () => (back ? back(null) : dlg.close()) }, back ? 'رجوع للمحاضرة' : 'إلغاء')]);
      drawHead();
      drawBody();
    }
    reopen();
  }

  async function results(a) {
    wide();
    openDialog('درجات ' + a.title, [h('p', { class: 'loading-view', text: 'جاري التحميل…' })], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]);
    const r = await K.get('results:' + a.id, () => call('admin.results', { id: a.id }));
    if (!r.ok) { openDialog('درجات ' + a.title, [h('p', { class: 'alert', text: message(r.code) })], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]); return; }
    const st = r.stats;
    const q = h('input', { type: 'search', placeholder: 'اسم أو رقم', maxlength: 60 });
    const msg = note();
    const tableBox = h('div');
    const pct = x => (x.total ? Math.round((x.score || 0) * 100 / x.total) : 0);
    function draw() {
      const v = q.value.trim();
      const rows = r.attempts.filter(x => !v || x.name.includes(v) || x.phone.includes(v)).map(x => {
        const s = STATUS[x.status] || [x.status, ''];
        const meter = h('div', { class: 'meter' }, h('span', { class: 'meter-fill' }));
        meter.firstChild.style.setProperty('--p', pct(x) + '%');
        return [h('div', {}, h('b', { text: x.name || '—' }), h('div', { class: 'num muted', text: x.phone })), h('small', { text: [x.grade, x.mode === 'center' ? x.centerName || 'سنتر' : x.mode ? 'أونلاين' : ''].filter(Boolean).join(' · ') || '—' }), tone(s[0], s[1]),
          x.status === 'open' ? h('span', { class: 'muted', text: x.answered + ' / ' + x.total + ' متجاوب' }) : h('div', { class: 'score-cell' }, h('b', { class: 'num', text: (x.score ?? 0) + ' / ' + x.total }), meter, h('small', { class: 'num', text: pct(x) + '%' })),
          h('span', { text: x.seconds ? span(x.seconds) : '—' }), x.exits ? tone(String(x.exits), 'warn') : h('span', { class: 'muted', text: '0' }), h('small', { text: date(x.submittedAt || x.startedAt, true) }),
          K.can('results.manage') ? confirmButton('إعادة', 'outline small', async btn => { busy(btn, true); const y = await call('admin.resultReset', { id: x.id }); busy(btn, false); if (!y.ok) { alert(msg, message(y.code)); return; } r.attempts = r.attempts.filter(z => z.id !== x.id); K.drop('results'); alert(msg, 'اتمسحت محاولة ' + x.name + '، ويقدر يحل تاني.', 'success'); draw(); }) : ''];
      });
      tableBox.replaceChildren(grid(['الطالب', 'المرحلة', 'الحالة', 'الدرجة', 'المدة', 'خروج', 'الوقت', ''], rows, 'لسه محدش حل.'));
    }
    q.addEventListener('input', draw);
    draw();
    const exp = h('button', { class: 'btn outline', type: 'button', onclick: () => Xlsx.save('درجات-' + a.title.slice(0, 40), [{ name: a.title.slice(0, 31) || 'الدرجات', rows: [['الطالب', 'الرقم', 'المرحلة', 'السنتر', 'الحالة', 'الدرجة', 'من', 'النسبة', 'المدة بالثواني', 'مرات الخروج', 'بدأ', 'سلّم'], ...r.attempts.map(x => [x.name, x.phone, x.grade, x.mode === 'center' ? x.centerName : 'أونلاين', (STATUS[x.status] || [x.status])[0], x.score ?? '', x.total, x.status === 'open' ? '' : pct(x) / 100, x.seconds || '', x.exits, x.startedAt, x.submittedAt])] }]) }, icon('download'), 'تحميل Excel');
    const stat = (v, label, t) => h('div', { class: 'stat', 'data-tone': t }, h('b', { text: String(v), dir: 'ltr' }), h('span', { text: label }));
    openDialog('درجات ' + a.title, [
      h('div', { class: 'stats' }, stat(st.count, 'دخلوا'), stat(st.finished, 'خلصوا', 'ok'), stat(st.average + ' / ' + st.total, 'المتوسط'), stat(st.max, 'أعلى درجة', 'ok'), stat(st.min, 'أقل درجة', 'warn')),
      h('div', { class: 'toolbar' }, field('بحث', q), h('span', { class: 'spacer' }), exp), msg, tableBox
    ], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]);
  }
  return { list, editor, results };
})();
