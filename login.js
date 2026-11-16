(() => {
  const $ = s => document.querySelector(s);
  if (Panel.token()) location.replace('panel.html');
  const box = $('#login-alert');
  const notice = new URLSearchParams(location.search).get('notice');
  if (notice) Panel.alert(box, notice === 'logout' ? 'تم تسجيل الخروج.' : Panel.message(notice), notice === 'logout' ? 'success' : 'error');
  $('#toggle-pass').addEventListener('click', () => {
    const p = $('#password'), show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#toggle-pass').setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    $('#toggle-pass use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
  });
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('#username').value.trim().toLowerCase(), password = $('#password').value;
    if (!/^[a-z0-9_.]{3,32}$/.test(username) || !password) { Panel.alert(box, 'اكتب اسم المستخدم (حروف إنجليزي وأرقام) وكلمة المرور.'); return; }
    Panel.alert(box, '');
    const btn = $('#login-btn');
    Panel.busy(btn, true);
    const r = await Panel.api('admin.login', { username, password });
    Panel.busy(btn, false);
    if (!r.ok || !r.token) { Panel.alert(box, Panel.message(r.code)); $('#password').select(); return; }
    Panel.setToken(r.token);
    location.replace('panel.html');
  });
})();
