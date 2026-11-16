(() => {
  const { api, h, icon, date, pill, busy, alert, message, PERM_LABELS, ROLE_LABELS } = Panel;
  const $ = s => document.querySelector(s);
  const token = Panel.token();
  if (!token) { location.replace('index.html'); return; }
  const view = $('#view'), dlg = $('#dlg');
  let me = null;
  const ACTION_LABELS = { login: 'تسجيل دخول', password: 'تغيير كلمة المرور', 'student.edit': 'تعديل طالب', 'student.password': 'كلمة مرور مؤقتة لطالب', 'student.logout': 'خروج طالب من أجهزته', 'student.delete': 'حذف طالب', 'stages.save': 'حفظ المراحل', 'courses.save': 'حفظ الدورات', 'settings.save': 'حفظ الإعدادات', 'staff.create': 'إنشاء حساب', 'staff.edit': 'تعديل حساب', 'staff.delete': 'حذف حساب', 'student.reject': 'رفض طالب', 'notices.save': 'حفظ الإشعارات', 'security.unblock': 'رفع حظر' };
  const SECTIONS = [
    { id: 'overview', title: 'نظرة عامة', icon: 'home', perm: '', render: overview },
    { id: 'students', title: 'الطلاب', icon: 'users', perm: 'students.view', render: students },
    { id: 'stages', title: 'المراحل', icon: 'layers', perm: 'content.edit', render: stages },
    { id: 'courses', title: 'الدورات', icon: 'book', perm: 'content.edit', render: courses },
    { id: 'notices', title: 'الإشعارات', icon: 'bell', perm: 'content.edit', render: notices },
    { id: 'settings', title: 'إعدادات الموقع', icon: 'settings', perm: 'settings.edit', render: settings },
    { id: 'staff', title: 'الحسابات والصلاحيات', icon: 'shield', perm: 'staff.manage', render: staff },
    { id: 'security', title: 'الحماية', icon: 'lock', perm: 'security.manage', render: security },
    { id: 'audit', title: 'سجل العمليات', icon: 'list', perm: 'audit.view', render: audit },
    { id: 'system', title: 'الخادم والملفات', icon: 'server', perm: 'system.view', render: system },
    { id: 'account', title: 'حسابي', icon: 'user', perm: '', render: account }
  ];
  const sq = { q: '', status: '', offset: 0 };
  let auditOffset = 0;
  const can = p => !p || me.role === 'developer' || me.permissions.includes(p);
  async function call(action, payload = {}) {
    const r = await api(action, { token, ...payload });
    if (!r.ok && (r.code === 'session' || r.code === 'disabled')) { Panel.clearToken(); location.replace('index.html?notice=' + r.code); }
    return r;
  }
  const setView = (...nodes) => view.replaceChildren(...nodes);
  const loading = () => setView(h('p', { class: 'loading-view', text: 'جاري التحميل…' }));
  const failed = (r, retry) => setView(h('section', { class: 'card' }, h('p', { class: 'alert', text: message(r.code) }), h('div', {}, h('button', { class: 'btn outline', type: 'button', onclick: () => { loading(); retry(); } }, icon('refresh'), 'إعادة المحاولة'))));
  const tone = (text, t) => h('span', { class: 'pill', 'data-tone': t, text });
  const note = (type = 'error') => h('p', { class: 'alert', role: 'status', 'data-type': type, hidden: true });
  const num = v => h('span', { class: 'num', text: String(v ?? '—') });
  function card(title, sub, actions, ...body) {
    return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: title }), sub ? h('p', { text: sub }) : null), actions ? h('div', { class: 'toolbar' }, actions) : null), ...body);
  }
  function field(label, control, hint, wide) {
    const id = control.id || ('f' + Math.random().toString(36).slice(2, 9));
    control.id = id;
    return h('div', { class: 'field' + (wide ? ' wide' : '') }, h('label', { for: id, text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null);
  }
  function select(options, value) { return h('select', {}, options.map(([v, t]) => h('option', { value: v, selected: v === value, text: t }))); }
  function check(label, checked, disabled) {
    const box = h('input', { type: 'checkbox', checked, disabled });
    return { box, el: h('label', { class: 'check' + (disabled ? ' disabled' : '') }, box, label) };
  }
  function grid(headers, rows, empty) {
    if (!rows.length) return h('p', { class: 'empty', text: empty || 'مفيش بيانات.' });
    return h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, headers.map(t => h('th', { scope: 'col', text: t })))), h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));
  }
  function confirmButton(label, cls, run) {
    let armed = false, timer = 0;
    const btn = h('button', { class: 'btn ' + cls, type: 'button' }, label);
    btn.addEventListener('click', () => {
      if (!armed) { armed = true; btn.textContent = 'اضغط تاني للتأكيد'; timer = setTimeout(() => { armed = false; btn.textContent = label; }, 4000); return; }
      clearTimeout(timer); armed = false; btn.textContent = label; run(btn);
    });
    return btn;
  }
  function pager(total, offset, size, go) {
    if (total <= size) return null;
    const from = offset + 1, to = Math.min(offset + size, total);
    return h('div', { class: 'toolbar' }, h('span', { class: 'muted', text: `${from}–${to} من ${total}` }), h('button', { class: 'btn outline small', type: 'button', disabled: offset === 0, onclick: () => go(Math.max(0, offset - size)) }, 'السابق'), h('button', { class: 'btn outline small', type: 'button', disabled: to >= total, onclick: () => go(offset + size) }, 'التالي'));
  }
  function openDialog(title, body, buttons) {
    $('#dlg-title').textContent = title;
    $('#dlg-body').replaceChildren(...body);
    $('#dlg-foot').replaceChildren(...buttons);
    if (!dlg.open) dlg.showModal();
  }
  $('#dlg-close').addEventListener('click', () => dlg.close());
  $('#dlg-form').addEventListener('submit', e => e.preventDefault());
  function setSide(open) { $('#side').classList.toggle('open', open); $('#scrim').hidden = !open; $('#menu').setAttribute('aria-expanded', String(open)); }
  $('#menu').addEventListener('click', () => setSide(!$('#side').classList.contains('open')));
  $('#scrim').addEventListener('click', () => setSide(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSide(false); });
  function route() {
    const id = location.hash.slice(1) || 'overview';
    const sec = SECTIONS.find(s => s.id === id && can(s.perm)) || SECTIONS[0];
    document.querySelectorAll('#nav a').forEach(a => { const on = a.dataset.id === sec.id; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#title').textContent = sec.title;
    document.title = sec.title + ' | لوحة التحكم';
    setSide(false);
    if (dlg.open) dlg.close();
    loading();
    sec.render();
  }
  function go(id) { if (location.hash === '#' + id) route(); else location.hash = id; }

  async function overview() {
    const r = await call('admin.overview');
    if (!r.ok) return failed(r, overview);
    const st = r.students, s = r.settings || {};
    const stat = (v, label, t) => h('div', { class: 'stat', 'data-tone': t }, h('b', { text: String(v) }), h('span', { text: label }));
    const row = (label, value) => h('div', { class: 'row-item' }, h('span', { text: label }), value);
    const quick = [];
    if (can('students.view') && st.wait) quick.push(h('button', { class: 'btn primary', type: 'button', onclick: () => { sq.status = 'wait'; sq.q = ''; sq.offset = 0; go('students'); } }, icon('users'), `مراجعة ${st.wait} طالب`));
    if (can('content.edit')) quick.push(h('a', { class: 'btn outline', href: '#stages' }, icon('layers'), 'تعديل المراحل'), h('a', { class: 'btn outline', href: '#courses' }, icon('book'), 'الدورات'));
    if (can('system.view')) quick.push(h('a', { class: 'btn outline', href: '#system' }, icon('server'), 'كشف الخادم'));
    if (can('content.edit')) quick.push(h('a', { class: 'btn outline', href: '#notices' }, icon('bell'), 'الإشعارات'));
    if (can('staff.manage')) quick.push(h('a', { class: 'btn outline', href: '#staff' }, icon('shield'), 'الحسابات'));
    if (can('security.manage')) quick.push(h('a', { class: 'btn outline', href: '#security' }, icon('lock'), 'الحماية'));
    setView(
      h('div', { class: 'stats' }, stat(st.total, 'إجمالي الطلاب'), stat(st.wait, 'تحت المراجعة', 'warn'), stat(st.done, 'حساب مفعّل', 'ok'), stat(st.ban, 'موقوف', 'bad'), stat(st.reject ?? 0, 'مرفوض', 'bad'), stat(r.sessions, 'جلسات طلاب نشطة'), stat(r.stages, 'المراحل'), stat(r.courses ?? 0, 'الدورات'), r.staff !== undefined ? stat(r.staff, 'حسابات اللوحة') : null),
      h('div', { class: 'grid-2' },
        card('حالة الموقع', 'تتغير من إعدادات الموقع.', can('settings.edit') ? h('a', { class: 'btn outline small', href: '#settings' }, icon('edit'), 'تعديل') : null,
          h('div', { class: 'list' }, row('التسجيل', tone(s.registration_open ? 'مفتوح' : 'مقفول', s.registration_open ? 'ok' : 'bad')), row('وضع الصيانة', tone(s.maintenance ? 'مفعّل' : 'متوقف', s.maintenance ? 'warn' : 'ok')), row('الإعلان', h('small', { text: s.announcement || '—' })))),
        card('مهام سريعة', `أهلًا ${me.name}`, null, quick.length ? h('div', { class: 'toolbar' }, quick) : h('p', { class: 'muted', text: 'مفيش مهام متاحة لصلاحياتك.' }))),
      r.recent ? card('آخر العمليات', '', h('a', { class: 'btn outline small', href: '#audit' }, 'السجل كامل'), h('div', { class: 'list' }, r.recent.length ? r.recent.map(e => h('div', { class: 'row-item' }, h('span', {}, h('b', { text: e.actor }), ' · ', actionLabel(e.action), e.target ? ' · ' + e.target : ''), h('small', { text: date(e.time, true) }))) : h('p', { class: 'empty', text: 'لسه مفيش عمليات.' }))) : null
    );
  }
  const actionLabel = a => ACTION_LABELS[a] || (a.startsWith('run.') ? 'تشغيل دالة ' + a.slice(4) : a);

  async function students() {
    const r = await call('admin.students', { q: sq.q, status: sq.status, offset: sq.offset });
    if (!r.ok) return failed(r, students);
    const q = h('input', { type: 'search', value: sq.q, placeholder: 'الاسم أو الهاتف أو البريد', maxlength: 60 });
    const status = select([['', 'كل الحالات'], ['wait', 'تحت المراجعة'], ['done', 'مفعّل'], ['reject', 'مرفوض'], ['ban', 'موقوف']], sq.status);
    const form = h('form', { class: 'toolbar', role: 'search', onsubmit: e => { e.preventDefault(); sq.q = q.value.trim(); sq.status = status.value; sq.offset = 0; loading(); students(); } }, field('بحث', q), field('الحالة', status), h('button', { class: 'btn primary', type: 'submit' }, icon('search'), 'بحث'));
    const msg = note('success');
    const rows = r.students.map(s => {
      const actions = h('div', { class: 'actions' });
      if (can('students.edit') && s.status === 'wait') actions.append(h('button', { class: 'btn primary small', type: 'button', onclick: async e => {
        busy(e.currentTarget, true);
        const x = await call('admin.studentSave', { id: s.id, name: s.name, studentPhone: s.studentPhone, parentPhone: s.parentPhone, email: s.email, grade: s.grade, status: 'done' });
        if (!x.ok) { busy(e.currentTarget, false); alert(msg, message(x.code)); return; }
        students();
      } }, icon('check'), 'تفعيل'));
      if (can('students.edit') && s.status === 'wait') actions.append(h('button', { class: 'btn outline small', type: 'button', onclick: () => studentDialog(s, r.grades, r.reasons, 'reject') }, icon('x'), 'رفض'));
      actions.append(h('button', { class: 'btn outline small', type: 'button', onclick: () => studentDialog(s, r.grades, r.reasons) }, icon(can('students.edit') ? 'edit' : 'eye'), can('students.edit') ? 'تعديل' : 'عرض'));
      return [h('div', {}, h('b', { text: s.name }), s.locked ? h('small', { class: 'muted', text: ' · مقفول مؤقتًا' }) : null, s.status === 'reject' ? h('div', { class: 'muted reject-summary', text: rejectSummary(s.reject) }) : null), num(s.studentPhone), s.grade || '—', pill(s.status), date(s.createdAt), actions];
    });
    setView(card('الطلاب', `${r.total} نتيجة`, null, form, msg, grid(['الاسم', 'رقم الطالب', 'المرحلة', 'الحالة', 'التسجيل', ''], rows, 'مفيش طلاب مطابقين.'), pager(r.total, r.offset, 50, o => { sq.offset = o; loading(); students(); })));
  }
  function rejectSummary(rj) { if (!rj) return ''; return (rj.list || []).map(x => x.label).concat(rj.note ? [rj.note] : []).join(' · '); }
  function studentDialog(s, grades, reasons, preset) {
    const box = note();
    const photo = /^https:\/\/i\.ibb\.co\//.test(s.photo) ? h('img', { src: s.photo, alt: 'صورة ' + s.name, width: 72, height: 72, class: 'avatar' }) : null;
    const info = h('dl', { class: 'kv' }, h('dt', { text: 'النوع' }), h('dd', { text: s.gender || '—' }), h('dt', { text: 'تاريخ الميلاد' }), h('dd', { text: s.birthDate || '—', dir: 'ltr' }), h('dt', { text: 'تاريخ التسجيل' }), h('dd', { text: date(s.createdAt, true) }), h('dt', { text: 'آخر دخول' }), h('dd', { text: date(s.lastLogin, true) }));
    if (!can('students.edit')) {
      info.prepend(h('dt', { text: 'الاسم' }), h('dd', { text: s.name }), h('dt', { text: 'رقم الطالب' }), h('dd', {}, num(s.studentPhone)), h('dt', { text: 'ولي الأمر' }), h('dd', {}, num(s.parentPhone)), h('dt', { text: 'البريد' }), h('dd', { text: s.email || '—' }), h('dt', { text: 'المرحلة' }), h('dd', { text: s.grade }), h('dt', { text: 'الحالة' }), h('dd', {}, pill(s.status)));
      if (s.status === 'reject') info.append(h('dt', { text: 'سبب الرفض' }), h('dd', { text: rejectSummary(s.reject) || '—' }));
      openDialog(s.name, [photo, info].filter(Boolean), [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]);
      return;
    }
    const f = {
      name: h('input', { value: s.name, maxlength: 60, autocomplete: 'off' }),
      studentPhone: h('input', { value: s.studentPhone, dir: 'ltr', inputmode: 'numeric', maxlength: 11 }),
      parentPhone: h('input', { value: s.parentPhone, dir: 'ltr', inputmode: 'numeric', maxlength: 11 }),
      email: h('input', { value: s.email, dir: 'ltr', type: 'email', maxlength: 100 }),
      grade: select([...new Set([...grades, s.grade].filter(Boolean))].map(g => [g, g]), s.grade),
      status: select([['wait', 'تحت المراجعة'], ['done', 'مفعّل'], ['reject', 'مرفوض'], ['ban', 'موقوف']], preset || s.status)
    };
    const had = s.reject || { codes: [], note: '' };
    const picks = Object.entries(reasons || {}).map(([code, label]) => ({ code, ...check(label, (had.codes || []).includes(code)) }));
    const rnote = h('textarea', { maxlength: 300, rows: 2, value: had.note || '', placeholder: 'مثال: اتصلنا برقم ولي الأمر ومحدش رد أكتر من مرة.' });
    const rbox = h('div', { class: 'field wide reject-fields', hidden: f.status.value !== 'reject' }, h('span', { class: 'label', text: 'أسباب الرفض' }), h('div', { class: 'perm-grid' }, picks.map(x => x.el)), field('ملاحظة للطالب', rnote, 'بتظهر للطالب مع الأسباب، وإجبارية لو اخترت «سبب تاني». الطالب هيقدر يصحح بياناته ويرجع للمراجعة.', true));
    f.status.addEventListener('change', () => { rbox.hidden = f.status.value !== 'reject'; });
    const body = [photo, h('div', { class: 'form-grid' }, field('الاسم', f.name, '', true), field('رقم الطالب', f.studentPhone), field('رقم ولي الأمر', f.parentPhone), field('البريد', f.email, 'اختياري', true), field('المرحلة', f.grade), field('الحالة', f.status, 'الإيقاف أو الرفض أو المراجعة يخرج الطالب من أجهزته.')), rbox, info, box].filter(Boolean);
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const rejecting = f.status.value === 'reject';
      const codes = rejecting ? picks.filter(x => x.box.checked).map(x => x.code) : [];
      const noteText = rejecting ? rnote.value.trim() : '';
      if (rejecting && !codes.length && !noteText) { alert(box, message('reason_required')); return; }
      if (rejecting && codes.includes('other') && !noteText) { alert(box, message('note_required')); rnote.focus(); return; }
      busy(save, true);
      const x = await call('admin.studentSave', { id: s.id, name: f.name.value.trim(), studentPhone: f.studentPhone.value.trim(), parentPhone: f.parentPhone.value.trim(), email: f.email.value.trim().toLowerCase(), grade: f.grade.value, status: f.status.value, reasons: codes, note: noteText });
      busy(save, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      Object.assign(s, x.student);
      alert(box, 'تم حفظ بيانات الطالب.', 'success');
      students();
    } }, icon('check'), 'حفظ');
    const temp = confirmButton('كلمة مرور مؤقتة', 'outline', async btn => {
      busy(btn, true);
      const x = await call('admin.studentPassword', { id: s.id });
      busy(btn, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      alert(box, '', 'info');
      const secret = h('div', { class: 'secret', text: x.password });
      $('#dlg-body').append(h('p', { class: 'alert', 'data-type': 'warn', text: 'ابعت كلمة المرور دي للطالب بنفسك. مش هتظهر تاني، والطالب اتخرج من كل أجهزته.' }), secret);
    });
    const out = confirmButton('خروج من الأجهزة', 'outline', async btn => {
      busy(btn, true);
      const x = await call('admin.studentLogout', { id: s.id });
      busy(btn, false);
      alert(box, x.ok ? `تم إنهاء ${x.count} جلسة.` : message(x.code), x.ok ? 'success' : 'error');
    });
    const del = can('students.delete') ? confirmButton('حذف الطالب', 'danger', async btn => {
      busy(btn, true);
      const x = await call('admin.studentDelete', { id: s.id });
      busy(btn, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      dlg.close(); students();
    }) : null;
    openDialog(s.name, body, [save, temp, out, h('span', { class: 'spacer' }), del].filter(Boolean));
    if (preset === 'reject') picks[0]?.box.focus();
  }

  async function stages() {
    const r = await call('admin.stages');
    if (!r.ok) return failed(r, stages);
    const list = r.stages.map(s => ({ name: s.name, description: s.description, symbol: s.symbol, number: s.number, element: s.element, active: s.active }));
    const box = h('div', { class: 'list' });
    const msg = note();
    function draw() {
      box.replaceChildren(h('div', { class: 'stage-row stage-head', 'aria-hidden': 'true' }, ['اسم المرحلة', 'الوصف', 'الرمز', 'العدد الذري', 'اسم العنصر', 'التحكم'].map(t => h('span', { text: t }))), ...list.map((s, i) => {
        const bind = (el, key, fn) => { el.addEventListener('input', () => { s[key] = fn ? fn(el) : el.value; }); return el; };
        const active = h('input', { type: 'checkbox', checked: s.active });
        active.addEventListener('change', () => { s.active = active.checked; });
        return h('div', { class: 'stage-row' },
          bind(h('input', { value: s.name, maxlength: 80, placeholder: 'اسم المرحلة', 'aria-label': 'اسم المرحلة' }), 'name'),
          bind(h('input', { value: s.description, maxlength: 160, placeholder: 'وصف قصير', 'aria-label': 'الوصف', class: 'wide' }), 'description'),
          bind(h('input', { value: s.symbol, maxlength: 3, dir: 'ltr', placeholder: 'H', 'aria-label': 'رمز العنصر' }), 'symbol'),
          bind(h('input', { value: String(s.number || ''), type: 'number', min: 0, max: 118, dir: 'ltr', placeholder: '1', 'aria-label': 'العدد الذري' }), 'number', el => parseInt(el.value, 10) || 0),
          bind(h('input', { value: s.element, maxlength: 20, dir: 'ltr', placeholder: 'HYDROGEN', 'aria-label': 'اسم العنصر' }), 'element', el => el.value.toUpperCase()),
          h('div', { class: 'ctrl' }, h('label', { class: 'check', title: 'ظاهرة' }, active, 'ظاهرة'),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); } }, icon('up')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); } }, icon('down')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'حذف المرحلة', disabled: list.length === 1, onclick: () => { list.splice(i, 1); draw(); } }, icon('trash'))));
      }));
    }
    draw();
    const add = h('button', { class: 'btn outline', type: 'button', onclick: () => { if (list.length >= 20) return; list.push({ name: '', description: '', symbol: '', number: 0, element: '', active: true }); draw(); box.lastChild.querySelector('input').focus(); } }, icon('plus'), 'إضافة مرحلة');
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const clean = list.map(s => ({ name: s.name.trim(), description: s.description.trim(), symbol: s.symbol.trim(), number: Number(s.number) || 0, element: s.element.trim().toUpperCase(), active: !!s.active }));
      const bad = clean.findIndex(s => s.name.length < 2 || (s.symbol && !/^[A-Z][a-z]{0,2}$/.test(s.symbol)) || s.number < 0 || s.number > 118 || !/^[A-Z ]{0,20}$/.test(s.element));
      if (bad !== -1) { alert(msg, `راجع المرحلة رقم ${bad + 1}: الاسم حرفين على الأقل، والرمز مثل H أو Na، واسم العنصر بحروف إنجليزي.`); return; }
      if (!clean.some(s => s.active)) { alert(msg, 'لازم مرحلة واحدة على الأقل تكون ظاهرة.'); return; }
      busy(save, true);
      const x = await call('admin.stagesSave', { stages: clean });
      busy(save, false);
      alert(msg, x.ok ? 'تم حفظ المراحل، وهتظهر في الصفحة الأولى وصفحة التسجيل.' : message(x.code), x.ok ? 'success' : 'error');
    } }, icon('check'), 'حفظ المراحل');
    setView(card('المراحل الدراسية', 'تظهر في الصفحة الأولى واختيار السنة وقت التسجيل.', [add, save], h('p', { class: 'alert', 'data-type': 'info', text: 'تغيير اسم مرحلة مش بيغيّر مرحلة الطلاب المسجلين قبل كده؛ عدّلهم من صفحة الطلاب لو محتاج.' }), msg, box));
  }

  async function courses() {
    const r = await call('admin.courses');
    if (!r.ok) return failed(r, courses);
    let list = r.courses.map(c => ({ id: c.id, grade: c.grade, title: c.title, description: c.description, lessons: c.lessons.slice(), active: c.active }));
    const grades = r.grades;
    const msg = note();
    const box = h('div', { class: 'list' });
    const filter = select([['', 'كل المراحل'], ...grades.map(g => [g, g])], '');
    filter.addEventListener('change', draw);
    async function persist(next, done) {
      const x = await call('admin.coursesSave', { courses: next });
      if (!x.ok) { alert(msg, message(x.code)); return false; }
      list = x.courses.map(c => ({ id: c.id, grade: c.grade, title: c.title, description: c.description, lessons: c.lessons.slice(), active: c.active }));
      alert(msg, done, 'success');
      draw();
      return true;
    }
    function draw() {
      const shown = list.map((c, i) => [c, i]).filter(([c]) => !filter.value || c.grade === filter.value);
      if (!shown.length) { box.replaceChildren(h('p', { class: 'empty', text: list.length ? 'مفيش دورات للمرحلة دي.' : 'لسه مفيش دورات. ابدأ بإضافة أول دورة.' })); return; }
      box.replaceChildren(...shown.map(([c, i]) => h('div', { class: 'row-item course-row' },
        h('div', { class: 'course-info' }, h('b', { text: c.title }), h('small', { class: 'muted', text: `${c.grade} · ${c.lessons.length} درس` }), c.description ? h('small', { text: c.description }) : null),
        h('div', { class: 'actions' }, tone(c.active ? 'ظاهرة' : 'مخفية', c.active ? 'ok' : 'warn'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: e => { const n = list.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; busy(e.currentTarget, true); persist(n, 'تم تغيير الترتيب.'); } }, icon('up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === list.length - 1, onclick: e => { const n = list.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; busy(e.currentTarget, true); persist(n, 'تم تغيير الترتيب.'); } }, icon('down')),
          h('button', { class: 'btn outline small', type: 'button', onclick: () => edit(i) }, icon('edit'), 'تعديل'),
          confirmButton('حذف', 'danger small', btn => { busy(btn, true); persist(list.filter((_, n) => n !== i), 'تم حذف الدورة.'); })))));
    }
    function edit(i) {
      const c = i === -1 ? { id: '', grade: filter.value || grades[0] || '', title: '', description: '', lessons: [], active: true } : list[i];
      const box2 = note();
      const f = {
        grade: select([...new Set([...grades, c.grade].filter(Boolean))].map(g => [g, g]), c.grade),
        title: h('input', { value: c.title, maxlength: 100, autocomplete: 'off', placeholder: 'مثال: الباب الأول — الكيمياء الكهربية' }),
        description: h('textarea', { maxlength: 300, value: c.description, rows: 2 }),
        lessons: h('textarea', { value: c.lessons.join('\n'), rows: 8, placeholder: 'كل درس في سطر لوحده' })
      };
      const active = check('ظاهرة للطلاب', c.active);
      const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const lessons = f.lessons.value.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(Boolean);
        const x = { id: c.id, grade: f.grade.value, title: f.title.value.trim(), description: f.description.value.trim(), lessons, active: active.box.checked };
        if (!x.grade) { alert(box2, 'أضف مرحلة دراسية الأول من صفحة المراحل.'); return; }
        if (x.title.length < 2) { alert(box2, 'اسم الدورة حرفين على الأقل.'); return; }
        if (!lessons.length || lessons.length > 40 || lessons.some(l => l.length > 120)) { alert(box2, 'اكتب من درس لـ 40 درس، كل درس في سطر وأقل من 120 حرف.'); return; }
        const n = list.slice();
        if (i === -1) n.push(x); else n[i] = x;
        busy(save, true);
        const ok = await persist(n, i === -1 ? 'تمت إضافة الدورة، وهتظهر لطلاب المرحلة.' : 'تم حفظ الدورة.');
        busy(save, false);
        if (ok) dlg.close(); else alert(box2, msg.textContent);
      } }, icon('check'), 'حفظ');
      openDialog(i === -1 ? 'دورة جديدة' : c.title, [h('div', { class: 'form-grid' }, field('المرحلة', f.grade), field('اسم الدورة', f.title, '', true), field('وصف قصير', f.description, 'اختياري', true), field('الدروس', f.lessons, 'كل درس في سطر. تقدم الطالب بيتحسب من الدروس اللي يعلّم عليها.', true)), active.el, box2], [save, h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إلغاء')]);
    }
    draw();
    const add = h('button', { class: 'btn primary', type: 'button', disabled: list.length >= 50, onclick: () => edit(-1) }, icon('plus'), 'إضافة دورة');
    setView(card('الدورات', 'كل مرحلة ليها دوراتها، والطالب بيشوف دورات مرحلته بس.', [field('المرحلة', filter), add], h('p', { class: 'alert', 'data-type': 'info', text: 'تقدم الطلاب بيتحفظ على أجهزتهم. لو غيّرت اسم درس، علامة الإنجاز بتاعته بتتشال عند الطلاب.' }), msg, box));
  }

  async function notices() {
    const r = await call('admin.notices');
    if (!r.ok) return failed(r, notices);
    const grades = r.grades;
    const copy = n => ({ id: n.id, title: n.title, body: n.body, level: n.level, audience: n.audience, grades: n.grades.slice(), phones: n.phones.slice(), exclude: n.exclude.slice(), gender: n.gender, startsAt: n.startsAt, endsAt: n.endsAt, active: n.active });
    let list = r.notices.map(copy);
    const msg = note();
    const box = h('div', { class: 'list' });
    const LEVELS = { info: ['معلومة', 'ok'], warn: ['تنبيه', 'warn'], important: ['مهم', 'bad'] };
    const toLocal = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    const fromLocal = v => (v ? new Date(v).toISOString() : '');
    const phoneList = v => [...new Set(v.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660)).split(/[\s,،]+/).filter(Boolean))];
    function state(n) {
      const now = Date.now();
      if (!n.active) return ['متوقف', 'warn'];
      if (n.endsAt && Date.parse(n.endsAt) <= now) return ['انتهى', 'bad'];
      if (n.startsAt && Date.parse(n.startsAt) > now) return ['مجدول', 'warn'];
      return ['ظاهر للطلاب', 'ok'];
    }
    function target(n) {
      const parts = [n.audience === 'grades' ? n.grades.join('، ') : n.audience === 'phones' ? `${n.phones.length} طالب محدد` : 'كل الطلاب'];
      if (n.gender) parts.push(n.gender === 'ذكر' ? 'الطلاب بس' : 'الطالبات بس');
      if (n.exclude.length) parts.push(`ما عدا ${n.exclude.length} طالب`);
      if (n.startsAt) parts.push('من ' + date(n.startsAt, true));
      if (n.endsAt) parts.push('لحد ' + date(n.endsAt, true));
      return parts.join(' · ');
    }
    async function persist(next, done) {
      const x = await call('admin.noticesSave', { notices: next });
      if (!x.ok) { alert(msg, message(x.code)); return false; }
      list = x.notices.map(copy);
      alert(msg, done, 'success');
      draw();
      return true;
    }
    function draw() {
      if (!list.length) { box.replaceChildren(h('p', { class: 'empty', text: 'لسه مفيش إشعارات. الإشعار بيفضل ظاهر فوق عند الطالب لحد ما يقفله.' })); return; }
      box.replaceChildren(...list.map((n, i) => { const st = state(n); return h('div', { class: 'row-item course-row' },
        h('div', { class: 'course-info' }, h('b', { text: n.title }), h('small', { class: 'muted', text: target(n) }), n.body ? h('small', { text: n.body.length > 140 ? n.body.slice(0, 140) + '…' : n.body }) : null),
        h('div', { class: 'actions' }, tone(LEVELS[n.level][0], LEVELS[n.level][1]), tone(st[0], st[1]),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأعلى', disabled: i === 0, onclick: e => { const x = list.slice(); [x[i - 1], x[i]] = [x[i], x[i - 1]]; busy(e.currentTarget, true); persist(x, 'تم تغيير الترتيب.'); } }, icon('up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'لأسفل', disabled: i === list.length - 1, onclick: e => { const x = list.slice(); [x[i + 1], x[i]] = [x[i], x[i + 1]]; busy(e.currentTarget, true); persist(x, 'تم تغيير الترتيب.'); } }, icon('down')),
          h('button', { class: 'btn outline small', type: 'button', onclick: () => edit(i) }, icon('edit'), 'تعديل'),
          confirmButton('حذف', 'danger small', btn => { busy(btn, true); persist(list.filter((_, k) => k !== i), 'تم حذف الإشعار.'); }))); }));
    }
    function edit(i) {
      const n = i === -1 ? { id: '', title: '', body: '', level: 'info', audience: 'all', grades: [], phones: [], exclude: [], gender: '', startsAt: '', endsAt: '', active: true } : list[i];
      const box2 = note();
      const f = {
        title: h('input', { value: n.title, maxlength: 100, autocomplete: 'off', placeholder: 'مثال: امتحان الباب الأول يوم الخميس' }),
        body: h('textarea', { value: n.body, maxlength: 600, rows: 3, placeholder: 'تفاصيل الإشعار (اختياري)' }),
        level: select([['info', 'معلومة'], ['warn', 'تنبيه'], ['important', 'مهم']], n.level),
        audience: select([['all', 'كل الطلاب'], ['grades', 'مراحل محددة'], ['phones', 'طلاب محددين بالرقم']], n.audience),
        gender: select([['', 'الكل'], ['ذكر', 'الطلاب بس'], ['أنثى', 'الطالبات بس']], n.gender),
        phones: h('textarea', { value: n.phones.join('\n'), rows: 3, dir: 'ltr', placeholder: '01xxxxxxxxx' }),
        exclude: h('textarea', { value: n.exclude.join('\n'), rows: 2, dir: 'ltr', placeholder: '01xxxxxxxxx' }),
        starts: h('input', { type: 'datetime-local', value: toLocal(n.startsAt), dir: 'ltr' }),
        ends: h('input', { type: 'datetime-local', value: toLocal(n.endsAt), dir: 'ltr' })
      };
      const gradeChecks = grades.map(g => ({ g, ...check(g, n.grades.includes(g)) }));
      const active = check('الإشعار شغال', n.active);
      const gradesBox = h('div', { class: 'field wide' }, h('span', { class: 'label', text: 'المراحل' }), h('div', { class: 'perm-grid' }, gradeChecks.map(x => x.el)));
      const phonesBox = field('أرقام الطلاب', f.phones, 'كل رقم في سطر. الإشعار هيظهر للأرقام دي بس.', true);
      const sync = () => { gradesBox.hidden = f.audience.value !== 'grades'; phonesBox.hidden = f.audience.value !== 'phones'; };
      f.audience.addEventListener('change', sync); sync();
      const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const x = { id: n.id, title: f.title.value.trim().replace(/\s+/g, ' '), body: f.body.value.trim(), level: f.level.value, audience: f.audience.value, grades: f.audience.value === 'grades' ? gradeChecks.filter(c => c.box.checked).map(c => c.g) : [], phones: f.audience.value === 'phones' ? phoneList(f.phones.value) : [], exclude: phoneList(f.exclude.value), gender: f.gender.value, startsAt: fromLocal(f.starts.value), endsAt: fromLocal(f.ends.value), active: active.box.checked };
        const badPhone = x.phones.concat(x.exclude).find(p => !/^01[0125][0-9]{8}$/.test(p));
        if (x.title.length < 2) { alert(box2, 'اكتب عنوان للإشعار من حرفين على الأقل.'); return; }
        if (badPhone) { alert(box2, `الرقم ${badPhone} مش رقم موبايل مصري صحيح.`); return; }
        if ((x.audience === 'grades' && !x.grades.length) || (x.audience === 'phones' && !x.phones.length)) { alert(box2, message('audience')); return; }
        if (x.startsAt && x.endsAt && Date.parse(x.endsAt) <= Date.parse(x.startsAt)) { alert(box2, message('dates')); return; }
        const next = list.slice();
        if (i === -1) next.unshift(x); else next[i] = x;
        busy(save, true);
        const ok = await persist(next, i === -1 ? 'تم نشر الإشعار، وهيظهر للطلاب المحددين أول ما يفتحوا المنصة.' : 'تم حفظ الإشعار. لو غيّرت العنوان أو النص هيظهر تاني حتى للي قفلوه.');
        busy(save, false);
        if (ok) dlg.close(); else alert(box2, msg.textContent);
      } }, icon('check'), i === -1 ? 'نشر الإشعار' : 'حفظ');
      openDialog(i === -1 ? 'إشعار جديد' : n.title, [h('div', { class: 'form-grid' }, field('العنوان', f.title, '', true), field('النص', f.body, 'لحد 600 حرف.', true), field('الأهمية', f.level), field('يظهر لمين', f.audience), gradesBox, phonesBox, field('النوع', f.gender), field('ما عدا الأرقام دي', f.exclude, 'اختياري، كل رقم في سطر.', true), field('يبدأ من', f.starts, 'اختياري'), field('ينتهي في', f.ends, 'اختياري')), active.el, box2], [save, h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إلغاء')]);
    }
    draw();
    const add = h('button', { class: 'btn primary', type: 'button', disabled: list.length >= 30, onclick: () => edit(-1) }, icon('plus'), 'إشعار جديد');
    setView(card('الإشعارات', 'بتظهر فوق في صفحات الطالب لحد ما يدوس إغلاق.', add, msg, box));
  }

  async function security(data) {
    const r = data && data.blocks ? data : await call('admin.blocks');
    if (!r.ok) return failed(r, security);
    const REASON = { devtools: 'فتح أدوات المطور', source: 'عرض كود الصفحة', tamper: 'تلاعب بالصفحة', attack: 'طلبات هجوم على الخادم' };
    const msg = note();
    const active = r.blocks.filter(b => b.active).length;
    const rows = r.blocks.map(b => [
      h('div', {}, h('b', { text: b.kind === 'ip' ? 'عنوان IP' : 'جهاز' }), h('div', { class: 'num muted', text: b.label })),
      REASON[b.reason] || b.reason,
      b.detail ? h('small', { class: 'num', text: b.detail }) : '—',
      num(b.hits),
      date(b.createdAt, true),
      b.active ? date(b.expiresAt, true) : tone('انتهى', 'ok'),
      b.active ? confirmButton('رفع الحظر', 'outline small', async btn => { busy(btn, true); const x = await call('admin.unblock', { id: b.id }); busy(btn, false); if (!x.ok) { alert(msg, message(x.code)); return; } security(x); }) : ''
    ]);
    setView(card('الحماية', `${active} حظر ساري · حظر الأجهزة ${r.hours} ساعة`, h('button', { class: 'btn outline small', type: 'button', onclick: () => { loading(); security(); } }, icon('refresh'), 'تحديث'),
      h('p', { class: 'alert', 'data-type': 'info', text: 'المنصة بتحظر الجهاز اللي يحاول يفتح أدوات المطور أو يشوف كود الصفحة، وبتحظر عنوان الـ IP لمدة ساعة لو الخادم رصد طلبات هجوم. عناوين الـ IP في مصر ممكن تكون مشتركة بين ناس كتير، علشان كده حظرها قصير. مدة حظر الأجهزة بتتغير من إعدادات الموقع.' }),
      msg, grid(['المحظور', 'السبب', 'التفاصيل', 'المرات', 'البداية', 'النهاية', ''], rows, 'مفيش أي حظر لحد دلوقتي.')));
  }

  async function settings() {
    const r = await call('admin.settings');
    if (!r.ok) return failed(r, settings);
    const s = r.settings;
    const reg = check('التسجيل مفتوح للطلاب الجدد', s.registration_open === 'true');
    const maint = check('وضع الصيانة: إيقاف دخول الطلاب مؤقتًا', s.maintenance === 'true');
    const mm = h('textarea', { maxlength: 300, value: s.maintenance_message });
    const ann = h('textarea', { maxlength: 300, value: s.announcement });
    const phones = h('textarea', { rows: 3, dir: 'ltr', value: String(s.support_phones || '').split(/\s+/).filter(Boolean).join('\n'), placeholder: '01xxxxxxxxx' });
    const hours = h('input', { type: 'number', min: 1, max: 720, dir: 'ltr', value: s.block_hours || '24' });
    const msg = note();
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const digits = v => v.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660));
      const list = [...new Set(digits(phones.value).split(/[\s,،]+/).filter(Boolean))];
      if (list.length > 5 || list.some(p => !/^01[0125][0-9]{8}$/.test(p))) { alert(msg, 'أرقام الدعم لحد 5 أرقام، وكل رقم موبايل مصري صحيح في سطر لوحده.'); return; }
      const h2 = Number(hours.value);
      if (!Number.isInteger(h2) || h2 < 1 || h2 > 720) { alert(msg, 'مدة الحظر من ساعة لـ 720 ساعة.'); return; }
      busy(save, true);
      const x = await call('admin.settingsSave', { settings: { registration_open: reg.box.checked, maintenance: maint.box.checked, maintenance_message: mm.value.trim(), announcement: ann.value.trim(), support_phones: list, block_hours: h2 } });
      busy(save, false);
      alert(msg, x.ok ? 'تم حفظ الإعدادات وتطبيقها على الموقع.' : message(x.code), x.ok ? 'success' : 'error');
    } }, icon('check'), 'حفظ الإعدادات');
    setView(card('إعدادات الموقع', 'التغييرات بتتطبق فورًا على الموقع.', save, msg,
      h('div', { class: 'list' }, reg.el, maint.el),
      h('div', { class: 'form-grid' }, field('رسالة الصيانة', mm, 'تظهر في صفحة الصيانة. وقت الصيانة محدش من الطلاب يقدر يفتح المنصة.', true), field('إعلان عام', ann, 'يظهر أعلى الصفحة الأولى وفي الرئيسية للطلاب. سيبه فاضي لإخفائه.', true), field('أرقام دعم المنصة', phones, 'لحد 5 أرقام، كل رقم في سطر. بتظهر للطلاب في «نسيت كلمة المرور» كزر واتساب، وهي مختلفة عن رقم المستر.', true), field('مدة حظر الجهاز (بالساعات)', hours, 'لما طالب يحاول يفتح أدوات المطور أو كود الصفحة.'))));
  }

  async function staff(data) {
    const r = data && data.staff ? data : await call('admin.staff');
    if (!r.ok) return failed(r, staff);
    const rows = r.staff.map(a => [h('div', {}, h('b', { text: a.name }), h('div', { class: 'num muted', text: a.username })), h('span', { class: 'role', 'data-role': a.role, text: ROLE_LABELS[a.role] }), pill(a.status), h('small', { text: a.permissions.length ? a.permissions.map(p => PERM_LABELS[p]).join('، ') : 'بدون صلاحيات' }), date(a.lastLogin, true), a.createdByName || '—', h('button', { class: 'btn outline small', type: 'button', onclick: () => staffDialog(a, r) }, icon('edit'), 'تعديل')]);
    const add = r.roles.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => staffDialog(null, r) }, icon('plus'), 'حساب جديد') : null;
    const sub = me.role === 'developer' ? 'المطور يقدر ينشئ ملاك وموظفين ويدي أي صلاحية.' : 'تقدر تنشئ موظفين وتديهم من صلاحياتك بس.';
    setView(card('الحسابات والصلاحيات', sub, add, grid(['الحساب', 'الدور', 'الحالة', 'الصلاحيات', 'آخر دخول', 'أنشأه', ''], rows, 'لسه مفيش حسابات.')));
  }
  function staffDialog(a, r) {
    const box = note();
    const f = {
      name: h('input', { value: a ? a.name : '', maxlength: 60 }),
      username: h('input', { value: a ? a.username : '', dir: 'ltr', maxlength: 32, autocapitalize: 'none', spellcheck: 'false', autocomplete: 'off' }),
      role: select(r.roles.map(x => [x, ROLE_LABELS[x]]), a ? a.role : r.roles[r.roles.length - 1]),
      status: select([['active', 'نشط'], ['disabled', 'موقوف']], a ? a.status : 'active'),
      password: h('input', { type: 'password', dir: 'ltr', maxlength: 64, autocomplete: 'new-password' })
    };
    const perms = r.grantable.map(p => ({ p, ...check(PERM_LABELS[p], a ? a.permissions.includes(p) : false) }));
    const sync = () => perms.forEach(x => { if (x.p !== 'staff.manage') return; const off = f.role.value === 'staff'; x.box.disabled = off; if (off) x.box.checked = false; x.el.classList.toggle('disabled', off); });
    f.role.addEventListener('change', sync); sync();
    const body = [h('div', { class: 'form-grid' }, field('الاسم', f.name), field('اسم المستخدم', f.username, 'حروف إنجليزي صغيرة وأرقام و . و _'), field('الدور', f.role), field('الحالة', f.status), field(a ? 'كلمة مرور جديدة' : 'كلمة المرور', f.password, a ? 'سيبها فاضية لو مش عايز تغيّرها.' : '6 حروف على الأقل.', true)), h('div', { class: 'field' }, h('span', { class: 'label', text: 'الصلاحيات' }), h('div', { class: 'perm-grid' }, perms.map(x => x.el)), h('span', { class: 'hint', text: 'إدارة الحسابات للمالك بس. الموظف مش بيقدر ينشئ حسابات.' })), box];
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const payload = { id: a ? a.id : '', name: f.name.value.trim(), username: f.username.value.trim().toLowerCase(), role: f.role.value, status: f.status.value, password: f.password.value, permissions: perms.filter(x => x.box.checked).map(x => x.p) };
      if (payload.name.length < 2 || !/^[a-z0-9_.]{3,32}$/.test(payload.username)) { alert(box, 'اكتب اسم واسم مستخدم صحيح.'); return; }
      if ((!a || payload.password) && !/^[\x21-\x7E]{6,64}$/.test(payload.password)) { alert(box, 'كلمة المرور من 6 لـ 64 حرف إنجليزي أو رقم أو رمز، من غير مسافات.'); return; }
      busy(save, true);
      const x = await call('admin.staffSave', payload);
      busy(save, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      dlg.close(); staff(x);
    } }, icon('check'), a ? 'حفظ' : 'إنشاء الحساب');
    const del = a ? confirmButton('حذف الحساب', 'danger', async btn => {
      busy(btn, true);
      const x = await call('admin.staffDelete', { id: a.id });
      busy(btn, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      dlg.close(); staff(x);
    }) : null;
    openDialog(a ? 'تعديل ' + a.name : 'حساب جديد', body, [save, h('span', { class: 'spacer' }), del].filter(Boolean));
  }

  async function audit() {
    const r = await call('admin.audit', { offset: auditOffset });
    if (!r.ok) return failed(r, audit);
    const rows = r.entries.map(e => [h('span', { class: 'num', text: date(e.time, true) }), h('div', {}, h('b', { text: e.actor }), ' ', h('span', { class: 'role', 'data-role': e.role, text: ROLE_LABELS[e.role] || e.role })), actionLabel(e.action), e.target || '—', h('small', { text: e.detail || '' }), num(e.ip || '—')]);
    setView(card('سجل العمليات', `${r.total} عملية مسجلة. أي تعديل في اللوحة بيتسجل هنا باسم صاحبه.`, h('button', { class: 'btn outline small', type: 'button', onclick: () => { loading(); audit(); } }, icon('refresh'), 'تحديث'), grid(['الوقت', 'الحساب', 'العملية', 'على', 'تفاصيل', 'IP'], rows, 'لسه مفيش عمليات.'), pager(r.total, r.offset, 100, o => { auditOffset = o; loading(); audit(); })));
  }

  async function system() {
    const r = await call('admin.health');
    if (!r.ok) return failed(r, system);
    const w = r.worker || {}, s = r.script || {};
    const yes = (v, a = 'موجود', b = 'ناقص') => tone(v ? a : b, v ? 'ok' : 'bad');
    const kv = pairs => h('dl', { class: 'kv' }, pairs.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', {}, v)]));
    const warn = [];
    if (w.version && s.version && w.version !== s.version) warn.push(`إصدار الوركر ${w.version} مختلف عن إصدار الشيت ${s.version}. ارفع آخر نسخة من الاتنين.`);
    if (!s.properties?.IMG_API) warn.push('مفتاح IMG-API مش موجود؛ تسجيل الطلاب الجدد هيفشل في رفع الصورة.');
    const missing = (s.sheets || []).filter(x => !x.exists || x.missing.length);
    if (missing.length) warn.push('في أوراق أو أعمدة ناقصة. شغّل دالة «تحديث أعمدة الشيت».');
    if (!s.properties?.OTP_API || !s.properties?.OTP_FROM) warn.push('OTP-API-1 أو OTP-FROM مش موجودين في Script Properties؛ «نسيت كلمة المرور» مش هتقدر تبعت الكود على البريد.');
    if (!w.env?.SITE_URL) warn.push('SITE_URL مش متضاف في الوركر، ففحص ملفات الموقع مش هيشتغل.');
    const sheets = grid(['الورقة', 'الحالة', 'الصفوف', 'الأعمدة'], (s.sheets || []).map(x => [h('span', { class: 'num', text: x.name }), yes(x.exists), num(x.rows), x.missing.length ? h('small', { class: 'num', text: 'ناقص: ' + x.missing.join(', ') }) : tone('كاملة', 'ok')]));
    const filesBox = h('div', { class: 'list' });
    const filesBtn = h('button', { class: 'btn outline', type: 'button', onclick: async () => {
      busy(filesBtn, true);
      const x = await call('admin.files');
      busy(filesBtn, false);
      if (!x.ok) { filesBox.replaceChildren(h('p', { class: 'alert', text: message(x.code) })); return; }
      const good = x.files.filter(f => f.status >= 200 && f.status < 300).length;
      const size = x.files.reduce((a, f) => a + f.bytes, 0);
      filesBox.replaceChildren(h('p', { class: 'alert', 'data-type': good === x.files.length ? 'success' : 'warn', text: `${good} من ${x.files.length} ملف شغال · الحجم ${(size / 1024).toFixed(0)} KB · ${x.site}` }), grid(['الملف', 'الحالة', 'الحجم', 'النوع', 'الزمن'], x.files.map(f => [h('span', { class: 'num', text: f.path }), tone(String(f.status || 'خطأ'), f.status >= 200 && f.status < 300 ? 'ok' : 'bad'), num((f.bytes / 1024).toFixed(1) + ' KB'), h('small', { class: 'num', text: f.type || '—' }), num(f.ms + ' ms')])));
    } }, icon('file'), 'فحص ملفات الموقع');
    const fnBox = note();
    const fns = (s.functions || []).filter(f => !f.developer || me.role === 'developer');
    const runFn = async (f, confirmText, btn) => {
      busy(btn, true);
      const x = await call('admin.run', { fn: f.id, confirm: confirmText || '' });
      busy(btn, false);
      alert(fnBox, x.ok ? `تم تشغيل «${x.result.label}» · العدد المتأثر: ${x.result.count}` : message(x.code), x.ok ? 'success' : 'error');
    };
    const fnRows = fns.map(f => h('div', { class: 'row-item' }, h('div', {}, h('b', { text: f.label }), h('div', { class: 'num muted', text: f.id + '()' })), f.confirm ? h('button', { class: 'btn danger small', type: 'button', onclick: () => {
      const input = h('input', { dir: 'ltr', autocomplete: 'off' });
      const box = note();
      const go = h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (input.value !== f.confirm) { alert(box, message('confirm')); return; } await runFn(f, input.value, go); dlg.close(); } }, icon('play'), 'تشغيل');
      openDialog(f.label, [h('p', { class: 'alert', text: 'العملية دي مش بترجع. كل حسابات الطلاب وجلساتهم هتتمسح.' }), field(`اكتب ${f.confirm} للتأكيد`, input), box], [go]);
    } }, icon('play'), 'تشغيل') : confirmButton('تشغيل', 'outline small', btn => runFn(f, '', btn))));
    setView(
      warn.length ? h('div', { class: 'list' }, warn.map(t => h('p', { class: 'alert', 'data-type': 'warn', text: t }))) : h('p', { class: 'alert', 'data-type': 'success', text: 'كل الفحوصات الأساسية سليمة.' }),
      h('div', { class: 'grid-2' },
        card('Cloudflare Worker', 'السيرفر اللي بيستقبل طلبات الموقع واللوحة.', h('button', { class: 'btn outline small', type: 'button', onclick: () => { loading(); system(); } }, icon('refresh'), 'إعادة الفحص'),
          kv([['الإصدار', num(w.version)], ['زمن الرد من الشيت', num((w.ms ?? '—') + ' ms')], ['مركز البيانات', num(w.colo || '—')], ['SEC', yes(w.env?.SEC)], ['SCRIPT_URL', yes(w.env?.SCRIPT_URL)], ['SITE_URL', yes(w.env?.SITE_URL)], ['روابط الموقع ALLOW', h('small', { class: 'num', text: (w.origins?.site || []).join(' · ') || '—' })], ['روابط اللوحة PANEL', h('small', { class: 'num', text: (w.origins?.panel || []).join(' · ') || '—' })]])),
        card('Google Apps Script', 'قاعدة البيانات على Google Sheets.', null,
          kv([['الإصدار', num(s.version)], ['الشيت', s.spreadsheet || '—'], ['المنطقة الزمنية', num(s.timezone)], ['وقت الخادم', date(s.time, true)], ['SEC', yes(s.properties?.SEC)], ['IMG-API', yes(s.properties?.IMG_API)], ['OTP-API-1', yes(s.properties?.OTP_API)], ['OTP-FROM', yes(s.properties?.OTP_FROM)], ['حساب المطور', yes(s.developer)], ['جلسات طلاب منتهية', num(s.expiredSessions)], ['جلسات لوحة منتهية', num(s.expiredStaffSessions)], ['زمن التنفيذ', num(s.ms + ' ms')]]))),
      card('أوراق الشيت', (s.extra || []).length ? 'أوراق إضافية مش مستخدمة: ' + s.extra.join('، ') : 'كل الأوراق المطلوبة وأعمدتها.', null, sheets),
      card('ملفات الموقع', 'بيفحص كل ملف في files.json على رابط الموقع المنشور.', filesBtn, filesBox),
      can('system.run') ? card('تشغيل الدوال', 'دوال صيانة آمنة على الشيت. كل تشغيل بيتسجل في السجل.', null, fnBox, h('div', { class: 'list' }, fnRows)) : null
    );
  }

  function account() {
    const cur = h('input', { type: 'password', dir: 'ltr', autocomplete: 'current-password', maxlength: 64 });
    const next = h('input', { type: 'password', dir: 'ltr', autocomplete: 'new-password', maxlength: 64 });
    const again = h('input', { type: 'password', dir: 'ltr', autocomplete: 'new-password', maxlength: 64 });
    const msg = note();
    const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      if (!/^[\x21-\x7E]{6,64}$/.test(next.value)) { alert(msg, 'كلمة المرور الجديدة من 6 لـ 64 حرف إنجليزي أو رقم أو رمز.'); return; }
      if (next.value !== again.value) { alert(msg, 'تأكيد كلمة المرور مش مطابق.'); return; }
      busy(save, true);
      const x = await call('admin.password', { current: cur.value, next: next.value });
      busy(save, false);
      if (x.ok) { cur.value = next.value = again.value = ''; }
      alert(msg, x.ok ? 'تم تغيير كلمة المرور، وكل الأجهزة التانية اتخرجت.' : message(x.code), x.ok ? 'success' : 'error');
    } }, icon('key'), 'تغيير كلمة المرور');
    const perms = me.role === 'developer' ? 'كل الصلاحيات' : (me.permissions.map(p => PERM_LABELS[p]).join('، ') || 'بدون صلاحيات');
    setView(h('div', { class: 'grid-2' },
      card('بيانات الحساب', '', null, h('dl', { class: 'kv' }, h('dt', { text: 'الاسم' }), h('dd', { text: me.name }), h('dt', { text: 'اسم المستخدم' }), h('dd', {}, num(me.username)), h('dt', { text: 'الدور' }), h('dd', {}, h('span', { class: 'role', 'data-role': me.role, text: ROLE_LABELS[me.role] })), h('dt', { text: 'الصلاحيات' }), h('dd', { text: perms }), h('dt', { text: 'آخر دخول' }), h('dd', { text: date(me.lastLogin, true) }))),
      card('كلمة المرور', '', null, msg, field('كلمة المرور الحالية', cur), field('كلمة المرور الجديدة', next), field('تأكيد كلمة المرور', again), h('div', {}, save))));
  }

  $('#logout').addEventListener('click', async e => {
    busy(e.currentTarget, true);
    await api('admin.logout', { token });
    Panel.clearToken();
    location.replace('index.html?notice=logout');
  });
  (async () => {
    const r = await call('admin.me');
    if (!r.ok) { if (r.code !== 'session' && r.code !== 'disabled') failed(r, () => location.reload()); return; }
    me = r.staff;
    $('#me-name').textContent = me.name;
    $('#me-user').textContent = me.username;
    $('#me-role').textContent = ROLE_LABELS[me.role];
    $('#me-role').dataset.role = me.role;
    $('#nav').replaceChildren(...SECTIONS.filter(s => can(s.perm)).map(s => h('a', { href: '#' + s.id, 'data-id': s.id }, icon(s.icon), s.title)));
    window.addEventListener('hashchange', route);
    route();
  })();
})();
