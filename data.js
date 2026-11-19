window.PanelData = (() => {
  const K = window.Kit;
  const { h, icon, call, setView, failed, note, card, field, busy, alert, message, pager } = K;
  const NAMES = { users: 'الطلاب', sessions: 'جلسات الطلاب', grades: 'المراحل', settings: 'الإعدادات', staff: 'حسابات اللوحة', staff_sessions: 'جلسات اللوحة', audit: 'سجل العمليات', courses: 'الدورات', lectures: 'المحاضرات', files: 'الملفات', centers: 'السناتر', codes: 'الأكواد', redemptions: 'استخدام الأكواد', wallet: 'المحفظة', access: 'المحتوى المفتوح', events: 'سجل الأمان', notices: 'الإشعارات', resets: 'استعادة كلمة المرور', blocks: 'الحظر', assessments: 'الواجبات والامتحانات', attempts: 'الدرجات' };
  const state = { sheet: 'users', q: '', offset: 0 };
  const key = () => 'data:' + JSON.stringify([state.sheet, state.q, state.offset]);
  const prefetch = () => K.get(key(), () => call('admin.data', { sheet: state.sheet, q: state.q, offset: state.offset }));
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  function cellOf(v) {
    const s = v === null || v === undefined ? '' : String(v);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) { const d = new Date(s); if (!Number.isNaN(d.getTime())) return h('span', { class: 'num', title: s, text: d.toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }); }
    if (s === '••••') return h('span', { class: 'muted', title: 'مخفي للأمان', text: '••••' });
    const short = s.length > 70 ? s.slice(0, 70) + '…' : s;
    return h('span', { class: /^[\x20-\x7E]+$/.test(s) ? 'num' : '', title: s.length > 70 ? s.slice(0, 600) : null, text: short || '—' });
  }
  async function view() {
    const r = await prefetch();
    if (!r.ok) return failed(r, view);
    const msg = note();
    const tabs = h('div', { class: 'chips data-tabs', role: 'tablist', 'aria-label': 'الأوراق' }, r.sheets.map(s => h('button', { type: 'button', role: 'tab', class: 'chip' + (s.name === state.sheet ? ' active' : ''), 'aria-selected': String(s.name === state.sheet), onclick: () => { state.sheet = s.name; state.q = ''; state.offset = 0; K.rerender(); } }, NAMES[s.name] || s.name, h('small', { class: 'num', text: String(s.rows) }))));
    const q = h('input', { type: 'search', value: state.q, placeholder: 'دوّر في الورقة دي', maxlength: 60, dir: 'auto' });
    const search = h('form', { class: 'toolbar', role: 'search', onsubmit: e => { e.preventDefault(); state.q = q.value.trim(); state.offset = 0; K.rerender(); } }, field('بحث', q), h('button', { class: 'btn outline', type: 'submit' }, icon('search'), 'بحث'));
    const canExport = K.can('data.export');
    const one = canExport ? h('button', { class: 'btn outline small', type: 'button', onclick: async () => {
      busy(one, true);
      const x = await call('admin.dataExport', { sheet: state.sheet });
      busy(one, false);
      if (!x.ok) { alert(msg, message(x.code)); return; }
      Xlsx.save('smart-chemistry-' + state.sheet + '-' + stamp(), [{ name: NAMES[state.sheet] || state.sheet, rows: [x.headers, ...x.rows] }]);
      alert(msg, x.total > x.rows.length ? `اتحمل أول ${x.rows.length} صف من ${x.total}.` : `اتحمل ${x.rows.length} صف.`, 'success');
    } }, icon('download'), 'تحميل الورقة دي') : null;
    const all = canExport ? h('button', { class: 'btn primary small', type: 'button', onclick: async () => {
      busy(all, true);
      const sheets = [];
      for (const s of r.sheets) {
        alert(msg, `بنجهز «${NAMES[s.name] || s.name}» (${sheets.length + 1} من ${r.sheets.length})…`, 'info');
        const x = await call('admin.dataExport', { sheet: s.name });
        if (!x.ok) { busy(all, false); alert(msg, message(x.code)); return; }
        sheets.push({ name: NAMES[s.name] || s.name, rows: [x.headers, ...x.rows] });
      }
      Xlsx.save('smart-chemistry-all-data-' + stamp(), sheets);
      busy(all, false);
      alert(msg, 'اتحمل ملف Excel فيه كل الأوراق.', 'success');
    } }, icon('download'), 'تحميل كل البيانات') : null;
    const hidden = r.hidden && r.hidden.length ? h('p', { class: 'alert', 'data-type': 'info', text: 'الأعمدة دي مخفية للأمان ومش بتتحمل: ' + r.hidden.join('، ') + '. كلمات المرور والأكواد والإجابات الصح محفوظة مشفرة أو مخفية.' }) : null;
    const table = r.rows.length ? h('div', { class: 'table-wrap data-table' }, h('table', {}, h('thead', {}, h('tr', {}, r.headers.map(t => h('th', { scope: 'col', class: 'num', text: t })))), h('tbody', {}, r.rows.map(row => h('tr', {}, row.map(c => h('td', {}, cellOf(c)))))))) : h('p', { class: 'empty', text: state.q ? 'مفيش نتائج.' : 'الورقة دي فاضية.' });
    setView(card('كل البيانات', `${NAMES[state.sheet] || state.sheet} · ${r.total} صف · الأحدث فوق`, [one, all].filter(Boolean),
      tabs, msg, hidden, search, table, pager(r.total, r.offset, 100, o => { state.offset = o; K.rerender(); })));
  }
  return { view, prefetch };
})();
