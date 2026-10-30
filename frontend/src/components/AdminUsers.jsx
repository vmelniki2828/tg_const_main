import React, { useEffect, useState } from 'react';
import { authRequest, jsonBody } from '../api';

export default function AdminUsers({ currentUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', login: '', password: '', role: 'admin' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  async function load() { setUsers((await authRequest('admin-users')).users); }
  useEffect(() => {
    let active = true;
    authRequest('admin-users').then(data => { if (active) setUsers(data.users); })
      .catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function perform(action, success) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); setNotice(success); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function create(event) {
    event.preventDefault();
    perform(async () => {
      await authRequest('admin-users', jsonBody('POST', form));
      setForm({ name: '', login: '', password: '', role: 'admin' });
    }, 'Користувача створено. Передайте йому логін і тимчасовий пароль безпечним способом. При вході він змінить пароль.');
  }
  function access(user) {
    if (!window.confirm(user.isActive ? `Відкликати доступ для @${user.login}? Усі його сесії буде завершено.` : `Відновити доступ для @${user.login}?`)) return;
    perform(() => authRequest(`admin-users/${user.id}`, jsonBody('PATCH', { isActive: !user.isActive })),
      user.isActive ? 'Доступ відкликано. Активні сесії більше не працюють.' : 'Доступ відновлено. Користувач має увійти заново.');
  }
  function role(user, value) {
    if (!window.confirm(`Змінити роль @${user.login}? Його активні сесії буде завершено.`)) return;
    perform(() => authRequest(`admin-users/${user.id}`, jsonBody('PATCH', { role: value })), 'Роль оновлено. Потрібен повторний вхід.');
  }
  function reset(event) {
    event.preventDefault();
    perform(async () => {
      await authRequest(`admin-users/${resetUser.id}/reset-password`, jsonBody('POST', { password: resetPassword }));
      setResetPassword(''); setResetUser(null);
    }, 'Тимчасовий пароль оновлено. Старі сесії завершено. При вході користувач змінить пароль.');
  }
  return <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Користувачі та доступ">
    <section className="admin-users-panel">
      <header className="auth-panel-heading"><div><h1>Користувачі та доступ</h1><p>Адміністратори керують ботами. Суперадміністратори також керують доступом.</p></div>
        <button type="button" className="auth-secondary" onClick={onClose}>Закрити</button></header>
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <form className="admin-create-form" onSubmit={create}>
        <h2>Додати користувача</h2>
        <label>Ім’я<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={100} /></label>
        <label>Логін або email<input autoComplete="off" autoCapitalize="none" value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} required minLength={3} maxLength={254} /></label>
        <label>Тимчасовий пароль<input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={12} maxLength={128} /></label>
        <label>Роль<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="admin">Адміністратор</option><option value="superadmin">Суперадміністратор</option></select></label>
        <button disabled={busy}>Створити користувача</button>
      </form>
      {loading ? <p role="status">Завантажуємо користувачів…</p> : <div className="admin-users-table"><table>
        <thead><tr><th>Користувач</th><th>Роль</th><th>Доступ</th><th>Дії</th></tr></thead>
        <tbody>{users.map(user => {
          const self = currentUser.id === user.id;
          return <tr key={user.id}><td><strong>{user.name}</strong><div>@{user.login}{self ? ' (ви)' : ''}</div></td>
            <td><select aria-label={`Роль ${user.login}`} disabled={busy || self} value={user.role} onChange={e => role(user, e.target.value)}>
              <option value="admin">Адміністратор</option><option value="superadmin">Суперадміністратор</option></select></td>
            <td><span className={user.isActive ? 'auth-active' : 'auth-revoked'}>{user.isActive ? 'Активний' : 'Відкликано'}</span>
              {user.mustChangePassword && <div className="auth-hint">Потрібна зміна пароля</div>}</td>
            <td><div className="auth-actions"><button className={user.isActive ? 'auth-danger' : ''} disabled={busy || self} onClick={() => access(user)}>{user.isActive ? 'Відкликати доступ' : 'Відновити доступ'}</button>
              <button className="auth-secondary" disabled={busy || self} onClick={() => { setResetUser(user); setResetPassword(''); }}>Скинути пароль</button></div></td></tr>;
        })}</tbody></table></div>}
      {resetUser && <form className="admin-reset-form" onSubmit={reset}>
        <h2>Новий тимчасовий пароль для @{resetUser.login}</h2>
        <label>Тимчасовий пароль<input type="password" autoComplete="new-password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} required minLength={12} maxLength={128} /></label>
        <div className="auth-actions"><button disabled={busy}>Зберегти тимчасовий пароль</button><button className="auth-secondary" type="button" disabled={busy} onClick={() => setResetUser(null)}>Скасувати</button></div>
      </form>}
    </section>
  </div>;
}
