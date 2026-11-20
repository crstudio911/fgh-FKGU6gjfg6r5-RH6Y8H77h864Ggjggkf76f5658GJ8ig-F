window.PANEL_CONFIG = Object.freeze({
  api: 'https://smartchemistry.mahmoudmomajeed.workers.dev/api'
});
const Panel = (() => {
  const KEY = 'sc-panel-token';
  const THEME = 'sc-panel-theme';
  const root = document.documentElement;
  const session = {
    get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, v); } catch {} },
    del() { try { sessionStorage.removeItem(KEY); } catch {} }
  };
  const local = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const messages = {
    network: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول تاني.',
    invalid: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    locked: 'محاولات كتير غلط. الحساب اتقفل ربع ساعة.',
    disabled: 'الحساب ده موقوف. كلّم المسؤول عنك.',
    session: 'انتهت الجلسة. سجّل دخولك تاني.',
    forbidden: 'مش عندك صلاحية للعملية دي.',
    validation: 'في بيانات مش صحيحة. راجعها وحاول تاني.',
    not_found: 'العنصر ده مش موجود أو اتحذف.',
    exists: 'رقم الطالب ده مستخدم في حساب تاني.',
    email_exists: 'البريد ده مستخدم في حساب تاني.',
    username_exists: 'اسم المستخدم ده موجود قبل كده.',
    duplicate: 'في مرحلتين بنفس الاسم.',
    confirm: 'كلمة التأكيد غير صحيحة.',
    wrong_password: 'كلمة المرور الحالية غلط.',
    reason_required: 'لازم تحدد سبب الرفض أو تكتبه.',
    note_required: 'اخترت «سبب تاني»، اكتب السبب في الملاحظة.',
    audience: 'حدد المراحل أو الأرقام اللي الإشعار هيظهر لها.',
    dates: 'ميعاد الانتهاء لازم يكون بعد ميعاد البداية.',
    site_url: 'فحص الموقع غير جاهز. تواصل مع المسؤول عن إعداد المنصة.',
    manifest: 'تعذر قراءة قائمة ملفات الموقع. أعد رفع الموقع بالكامل أو تواصل مع المسؤول.',
    center: 'اختار السنتر والميعاد، أو خليه أونلاين.',
    file: 'في عنصر في المحاضرة من غير ملف أو الملف اتحذف. اختار ملف لكل عنصر.',
    file_used: 'الملف ده مستخدم في محاضرة. شيله من المحاضرة الأول.',
    drive_folder: 'فولدر حفظ الملفات غير جاهز. تواصل مع المسؤول عن إعداد المنصة.',
    drive_keys: 'إعدادات حساب رفع الملفات ناقصة. تواصل مع المسؤول.',
    drive_auth: 'تعذر الاتصال بحساب رفع الملفات. تواصل مع المسؤول.',
    drive_quota: 'مساحة حساب رفع الملفات غير متاحة. تواصل مع المسؤول لتغيير حساب التخزين.',
    drive_scope: 'صلاحيات رفع الملفات غير مكتملة. تواصل مع المسؤول لتفعيلها.',
    drive_access: 'حساب رفع الملفات لا يستطيع الوصول للفولدر. تواصل مع المسؤول.',
    drive: 'جوجل درايف رفض العملية. جرّب تاني أو راجع إعدادات الفولدر.',
    upload_expired: 'جلسة الرفع انتهت. ابدأ رفع الملف من الأول.',
    upload: 'تعذر رفع الصورة. حاول لاحقًا أو تواصل مع المسؤول.',
    exam_time: 'الامتحان لازم يكون له وقت (دقيقة على الأقل).',
    questions: 'كل سؤال محتاج نص، واختيارين على الأقل، وإجابة صح.',
    answers: 'حدد الإجابة الصح لكل صفحة.',
    too_long: 'الأسئلة طويلة أوي. قسّمها على أكتر من واجب.',
    slow: 'طلبات كتير ورا بعض. استنى دقيقة وحاول تاني.',
    server: 'حصلت مشكلة في الخادم. حاول تاني بعد شوية.'
  };
  const PERM_LABELS = {
    'students.view': 'عرض الطلاب وبياناتهم',
    'students.approve': 'تفعيل ورفض وإيقاف الطلاب',
    'students.edit': 'تعديل بيانات الطلاب',
    'students.password': 'تغيير كلمة مرور الطالب',
    'students.logout': 'خروج الطالب من أجهزته',
    'students.delete': 'حذف الطلاب',
    'stages.edit': 'المراحل الدراسية',
    'courses.edit': 'الدورات والمحاضرات',
    'centers.edit': 'السناتر والمواعيد',
    'notices.edit': 'إشعارات الطلاب',
    'assess.edit': 'إنشاء وتعديل الواجبات والامتحانات والإجابات',
    'results.view': 'عرض الدرجات',
    'results.manage': 'إعادة فتح الامتحان لطالب',
    'media.upload': 'رفع الفيديوهات والملفات',
    'media.delete': 'حذف الملفات المرفوعة',
    'codes.create': 'إنشاء الأكواد',
    'codes.manage': 'إيقاف وتفعيل الأكواد',
    'wallet.view': 'محافظ الطلاب ومشترياتهم',
    'settings.edit': 'إعدادات الموقع والصيانة والتسجيل',
    'contacts.edit': 'أرقام التواصل وصفحة «عن المنصة»',
    'staff.manage': 'إنشاء وإدارة الحسابات',
    'security.manage': 'الحماية والحظر',
    'logs.view': 'عرض سجل الأمان',
    'logs.clear': 'مسح سجل الأمان',
    'audit.view': 'عرض سجل العمليات',
    'audit.clear': 'مسح سجل العمليات',
    'data.view': 'عرض كل البيانات',
    'data.export': 'تحميل كل البيانات',
    'system.view': 'كشف الخادم والملفات',
    'system.run': 'تشغيل دوال الصيانة'
  };
  const GROUP_LABELS = { students: 'الطلاب', content: 'المحتوى', assess: 'الواجبات والامتحانات', media: 'الملفات', money: 'الأكواد والمحافظ', site: 'الموقع', team: 'الفريق', security: 'الأمان والسجلات', data: 'البيانات', system: 'الخادم' };
  const ROLE_LABELS = { developer: 'مطور', owner: 'مالك', staff: 'موظف' };
  const STATUS = { wait: ['تحت المراجعة', 'warn'], done: ['مفعّل', 'ok'], ban: ['موقوف', 'bad'], reject: ['مرفوض', 'bad'], active: ['نشط', 'ok'], disabled: ['موقوف', 'bad'] };
  function applyTheme(t) {
    root.dataset.theme = t;
    document.querySelectorAll('[data-theme-toggle] use').forEach(u => u.setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon'));
  }
  applyTheme(local.get(THEME) === 'light' ? 'light' : 'dark');
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t);
    local.set(THEME, t);
  });
  async function api(action, payload = {}) {
    let res;
    try {
      res = await fetch(window.PANEL_CONFIG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
        credentials: 'omit',
        signal: AbortSignal.timeout(60000)
      });
    } catch { return { ok: false, code: 'network' }; }
    try {
      const data = await res.json();
      return data && typeof data.ok === 'boolean' ? data : { ok: false, code: 'server' };
    } catch { return { ok: false, code: res.status === 403 ? 'forbidden' : 'server' }; }
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name); svg.append(use);
    return svg;
  }
  function date(v, withTime) {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ar-EG', withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function pill(status) { const s = STATUS[status] || [status || '—', '']; return h('span', { class: 'pill', 'data-tone': s[1], text: s[0] }); }
  function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.classList.toggle('loading', on); btn.setAttribute('aria-busy', String(on)); }
  function alert(el, text, type = 'error') { el.textContent = text || ''; el.dataset.type = type; el.hidden = !text; }
  const workerOrigin = () => new URL(window.PANEL_CONFIG.api).origin;
  return { workerOrigin, api, h, icon, date, pill, busy, alert, message: c => messages[c] || messages.server, PERM_LABELS, GROUP_LABELS, ROLE_LABELS, token: session.get, setToken: session.set, clearToken: session.del };
})();
