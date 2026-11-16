window.PanelCodes = (() => {
  const K = window.Kit;
  const { h, icon, call, setView, failed, tone, note, card, field, select, check, grid, confirmButton, pager, openDialog, dlg, busy, alert, message, date, num } = K;
  const ACTIONS = { register: 'إنشاء حساب', login: 'تسجيل دخول', logout: 'تسجيل خروج', profile: 'تعديل البريد', fix: 'تصحيح بيانات مرفوضة', forgot: 'طلب كود استعادة', forgotVerify: 'تأكيد كود الاستعادة', forgotReset: 'تغيير كلمة المرور', open: 'فتح محتوى', buy: 'شراء بالمحفظة', redeem: 'استخدام كود', flag: 'محاولة فتح أدوات المطور', 'flag.attack': 'طلب هجوم على الخادم', 'admin.login': 'دخول اللوحة' };
  const RESULTS = { ok: ['تم', 'ok'], invalid: ['بيانات غلط', 'bad'], locked: ['مقفول', 'bad'], blocked: ['محظور', 'bad'], wait: ['تحت المراجعة', 'warn'], ban: ['موقوف', 'bad'], reject: ['مرفوض', 'warn'], session: ['جلسة منتهية', 'warn'], code_invalid: ['كود غلط', 'bad'], code_used: ['كود مستخدم', 'warn'], code_expired: ['كود منتهي', 'warn'], code_mine: ['استخدمه قبل كده', 'warn'], redeem_locked: ['محاولات كتير', 'bad'], balance: ['رصيد مش كفاية', 'warn'], locked_content: ['محتوى مقفول', 'warn'], mismatch: ['بيانات مش مطابقة', 'bad'], validation: ['بيانات مش صحيحة', 'bad'], maintenance: ['صيانة', 'warn'], disabled: ['حساب موقوف', 'bad'] };
  const csv = rows => '\uFEFF' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  function download(name, text, type = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const state = { q: '', offset: 0 };
  async function codes() {
    const r = await call('admin.codes', { q: state.q, offset: state.offset });
    if (!r.ok) return failed(r, codes);
    const msg = note('success');
    const q = h('input', { type: 'search', value: state.q, placeholder: 'رقم الدفعة أو آخر 4 حروف أو الملاحظة', maxlength: 60 });
    const search = h('form', { class: 'toolbar', role: 'search', onsubmit: e => { e.preventDefault(); state.q = q.value.trim(); state.offset = 0; K.loading(); codes(); } }, field('بحث', q), h('button', { class: 'btn outline', type: 'submit' }, icon('search'), 'بحث'));
    const rows = r.codes.map(c => [
      h('div', {}, h('b', { class: 'num', text: c.hint }), h('div', { class: 'muted small', text: 'دفعة ' + c.batch + (c.note ? ' · ' + c.note : '') })),
      c.kind === 'wallet' ? tone('شحن ' + c.amount + ' ج', 'ok') : h('small', { text: 'يفتح: ' + c.targets.join('، ') }),
      h('span', { class: 'num', text: c.uses + ' / ' + c.maxUses }),
      c.expiresAt ? date(c.expiresAt, true) : '—',
      !c.active ? tone('موقوف', 'bad') : c.uses >= c.maxUses ? tone('مستخدم', 'warn') : c.expiresAt && Date.parse(c.expiresAt) < Date.now() ? tone('منتهي', 'warn') : tone('شغال', 'ok'),
      h('small', { text: date(c.createdAt) + ' · ' + c.createdBy }),
      h('button', { class: 'btn outline small', type: 'button', onclick: async e => { busy(e.currentTarget, true); const x = await call('admin.codeToggle', { id: c.id, active: !c.active, q: state.q }); if (!x.ok) { busy(e.currentTarget, false); alert(msg, message(x.code), 'error'); return; } codes(); } }, c.active ? 'إيقاف' : 'تفعيل')
    ]);
    const create = h('button', { class: 'btn primary', type: 'button', onclick: () => createDialog(r) }, icon('plus'), 'أكواد جديدة');
    setView(card('الأكواد', `${r.total} كود. الكود بيظهر كامل مرة واحدة بس وقت إنشائه، فحمّله أو انسخه ساعتها.`, create,
      h('ol', { class: 'steps-guide' }, h('li', { text: 'كود شحن: بيضيف رصيد لمحفظة الطالب، وبيشتري بيه أي محاضرة أو دورة مدفوعة.' }), h('li', { text: 'كود مخصوص: بيفتح دورات أو محاضرات محددة مباشرة، وممكن يفتح أكتر من حاجة مرة واحدة.' })),
      msg, search, grid(['الكود', 'النوع', 'الاستخدام', 'ينتهي', 'الحالة', 'اتعمل', ''], rows, 'لسه مفيش أكواد.'), pager(r.total, r.offset, 100, o => { state.offset = o; K.loading(); codes(); })));
  }
  function createDialog(r) {
    const box = note();
    const kind = select([['wallet', 'شحن محفظة'], ['unlock', 'كود مخصوص يفتح محتوى']], 'wallet');
    const amount = h('input', { type: 'number', min: 1, max: 100000, dir: 'ltr', value: '100' });
    const count = h('input', { type: 'number', min: 1, max: 200, dir: 'ltr', value: '10' });
    const uses = h('input', { type: 'number', min: 1, max: 1000, dir: 'ltr', value: '1' });
    const expires = h('input', { type: 'datetime-local', dir: 'ltr' });
    const memo = h('input', { maxlength: 100, placeholder: 'مثال: سنتر سمارت · شهر نوفمبر' });
    const filter = h('input', { type: 'search', placeholder: 'دوّر', maxlength: 60 });
    const picks = [...r.courses.map(c => ({ t: 'course', id: c.id, label: 'دورة: ' + c.title })), ...r.lectures.map(l => ({ t: 'lecture', id: l.id, label: 'محاضرة: ' + l.title + (l.price ? ' · ' + l.price + ' ج' : '') }))].map(x => ({ ...x, ...check(x.label, false) }));
    const pickBox = h('div', { class: 'perm-grid pick-list' }, picks.map(x => x.el));
    filter.addEventListener('input', () => picks.forEach(x => { x.el.hidden = !!filter.value && !x.label.includes(filter.value.trim()); }));
    const amountBox = field('المبلغ بالجنيه', amount);
    const targetBox = h('div', { class: 'field wide', hidden: true }, h('span', { class: 'label', text: 'الكود يفتح إيه' }), filter, pickBox, h('span', { class: 'hint', text: 'اختار دورة أو أكتر، أو محاضرات معينة.' }));
    kind.addEventListener('change', () => { amountBox.hidden = kind.value !== 'wallet'; targetBox.hidden = kind.value !== 'unlock'; });
    const go = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const payload = { kind: kind.value, amount: kind.value === 'wallet' ? parseInt(amount.value, 10) || 0 : 0, count: parseInt(count.value, 10) || 0, maxUses: parseInt(uses.value, 10) || 0, targets: kind.value === 'unlock' ? picks.filter(x => x.box.checked).map(x => ({ t: x.t, id: x.id })) : [], expiresAt: expires.value ? new Date(expires.value).toISOString() : '', note: memo.value.trim() };
      if (payload.kind === 'wallet' && (payload.amount < 1 || payload.amount > 100000)) { alert(box, 'المبلغ من 1 لـ 100000 جنيه.'); return; }
      if (payload.kind === 'unlock' && !payload.targets.length) { alert(box, 'اختار المحتوى اللي الكود هيفتحه.'); return; }
      if (payload.count < 1 || payload.count > 200) { alert(box, 'عدد الأكواد من 1 لـ 200 في المرة.'); return; }
      if (payload.maxUses < 1 || payload.maxUses > 1000) { alert(box, 'عدد مرات الاستخدام من 1 لـ 1000.'); return; }
      busy(go, true);
      const x = await call('admin.codesCreate', payload);
      busy(go, false);
      if (!x.ok) { alert(box, message(x.code)); return; }
      showCodes(x, payload);
    } }, icon('ticket'), 'إنشاء الأكواد');
    openDialog('أكواد جديدة', [h('div', { class: 'form-grid' }, field('نوع الكود', kind), amountBox, targetBox, field('عدد الأكواد', count, 'لحد 200 في المرة.'), field('كل كود يتستخدم كام مرة', uses, 'كل طالب يستخدم الكود مرة واحدة بس.'), field('ينتهي في', expires, 'اختياري'), field('ملاحظة', memo, 'تساعدك تعرف الدفعة دي بعدين.')), box], [go, h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إلغاء')]);
  }
  function showCodes(x, p) {
    const text = x.codes.join('\n');
    const copy = h('button', { class: 'btn outline', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(text); copy.lastChild.textContent = 'اتنسخ'; } catch { copy.lastChild.textContent = 'انسخ يدوي'; } } }, icon('copy'), 'نسخ الكل');
    const file = h('button', { class: 'btn primary', type: 'button', onclick: () => download('codes-' + x.batch + '.csv', csv([['الكود', 'النوع', 'القيمة', 'الدفعة', 'الملاحظة'], ...x.codes.map(c => [c, x.kind === 'wallet' ? 'شحن' : 'مخصوص', x.kind === 'wallet' ? x.amount + ' جنيه' : p.targets.length + ' محتوى', x.batch, p.note])])) }, icon('download'), 'تحميل CSV');
    openDialog('اتعمل ' + x.codes.length + ' كود', [h('p', { class: 'alert', 'data-type': 'warn', text: 'الأكواد دي مش هتظهر كاملة تاني. حمّلها أو انسخها دلوقتي وخزّنها في مكان آمن.' }), h('div', { class: 'secret codes-box', dir: 'ltr', text: text })], [file, copy, h('span', { class: 'spacer' }), h('button', { class: 'btn outline', type: 'button', onclick: () => { dlg.close(); codes(); } }, 'خلصت')]);
  }
  async function money(s) {
    openDialog('محفظة ' + s.name, [h('p', { class: 'loading-view', text: 'جاري التحميل…' })], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]);
    const r = await call('admin.studentMoney', { id: s.id });
    if (!r.ok) { openDialog('محفظة ' + s.name, [h('p', { class: 'alert', text: message(r.code) })], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]); return; }
    const KIND = { charge: 'شحن بكود', buy: 'شراء', admin: 'من الإدارة' };
    openDialog('محفظة ' + s.name, [
      h('div', { class: 'stats' }, h('div', { class: 'stat', 'data-tone': 'ok' }, h('b', { text: String(r.balance) }), h('span', { text: 'جنيه رصيد' })), h('div', { class: 'stat' }, h('b', { text: String(r.owned.length) }), h('span', { text: 'محتوى مفتوح' }))),
      h('span', { class: 'label', text: 'المحتوى المفتوح' }), r.owned.length ? h('div', { class: 'list' }, r.owned.map(o => h('div', { class: 'row-item' }, h('span', { text: o.title }), tone(o.kind === 'course' ? 'دورة' : 'محاضرة', 'ok')))) : h('p', { class: 'muted', text: 'مفيش.' }),
      h('span', { class: 'label', text: 'العمليات' }), grid(['العملية', 'المبلغ', 'الوقت'], r.history.map(x => [(KIND[x.kind] || x.kind) + (x.note ? ' · ' + x.note : ''), h('span', { class: 'num', text: (x.amount > 0 ? '+' : '') + x.amount }), date(x.at, true)]), 'مفيش عمليات.')
    ], [h('button', { class: 'btn outline', type: 'button', onclick: () => dlg.close() }, 'إغلاق')]);
  }
  const lq = { q: '', offset: 0 };
  async function logs() {
    const r = await call('admin.events', lq);
    if (!r.ok) return failed(r, logs);
    const msg = note('success');
    const q = h('input', { type: 'search', value: lq.q, placeholder: 'IP أو رقم أو عملية', maxlength: 60, dir: 'auto' });
    const search = h('form', { class: 'toolbar', role: 'search', onsubmit: e => { e.preventDefault(); lq.q = q.value.trim(); lq.offset = 0; K.loading(); logs(); } }, field('بحث', q), h('button', { class: 'btn outline', type: 'submit' }, icon('search'), 'بحث'));
    const rows = r.events.map(e => { const res = RESULTS[e.result] || [e.result || '—', e.result === 'ok' ? 'ok' : 'warn']; return [h('span', { class: 'num', text: date(e.time, true) }), e.ip ? h('button', { class: 'link-btn num', type: 'button', onclick: () => { lq.q = e.ip; lq.offset = 0; K.loading(); logs(); } }, e.ip) : h('span', { class: 'muted', text: '—' }), h('span', { class: 'num muted', text: e.device || '—' }), e.phone ? h('span', { class: 'num', text: e.phone }) : '—', ACTIONS[e.action] || e.action, tone(res[0], res[1]), h('small', { text: e.detail || '' })]; });
    const exp = h('button', { class: 'btn outline small', type: 'button', onclick: async () => { busy(exp, true); const x = await call('admin.eventsExport'); busy(exp, false); if (!x.ok) { alert(msg, message(x.code), 'error'); return; } download('security-log-' + stamp() + '.csv', csv([['الوقت', 'IP', 'الجهاز', 'الرقم', 'العملية', 'النتيجة', 'تفاصيل'], ...x.events.map(e => [e.time, e.ip, e.device, e.phone, ACTIONS[e.action] || e.action, (RESULTS[e.result] || [e.result])[0], e.detail])])); } }, icon('download'), 'تحميل السجل');
    const clear = K.can('security.manage') ? confirmButton('مسح السجل', 'danger small', async btn => { busy(btn, true); const x = await call('admin.eventsClear'); busy(btn, false); if (!x.ok) { alert(msg, message(x.code), 'error'); return; } lq.offset = 0; await logs(); }) : null;
    setView(card('سجل الأمان', `${r.total} عملية · بيتمسح تلقائي اللي أقدم من ${r.hours} ساعة`, [h('button', { class: 'btn outline small', type: 'button', onclick: () => { K.loading(); logs(); } }, icon('refresh'), 'تحديث'), exp, clear],
      h('p', { class: 'alert', 'data-type': 'info', text: 'كل عملية مهمة على المنصة بتتسجل هنا بعنوان الـ IP ومعرّف الجهاز. دوس على أي IP علشان تشوف كل اللي جه منه.' }),
      msg, search, grid(['الوقت', 'IP', 'الجهاز', 'الرقم', 'العملية', 'النتيجة', 'تفاصيل'], rows, 'السجل فاضي.'), pager(r.total, r.offset, 200, o => { lq.offset = o; K.loading(); logs(); })));
  }
  return { codes, logs, money, csv };
})();
