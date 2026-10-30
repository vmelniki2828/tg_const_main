import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authRequest, jsonBody, setCsrfToken } from '../api';
import AdminUsers from './AdminUsers';
import './AdminAuth.css';

export function PasswordForm({ required, onSuccess, onCancel }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (newPassword !== confirmation) { setError('Нові паролі не збігаються.'); return; }
    setBusy(true);
    try { onSuccess(await authRequest('auth/password', jsonBody('POST', { currentPassword, newPassword }))); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="auth-card" onSubmit={submit}>
    <h1>{required ? 'Змініть тимчасовий пароль' : 'Зміна пароля'}</h1>
    {required && <p>Створіть власний пароль, щоб відкрити адмінпанель.</p>}
    <label>Поточний пароль<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} required maxLength={128} /></label>
    <label>Новий пароль<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} required minLength={12} maxLength={128} /></label>
    <label>Повторіть новий пароль<input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={12} maxLength={128} /></label>
    <p className="auth-hint">Від 12 до 128 символів. Інші активні сесії буде завершено.</p>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <div className="auth-actions"><button disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти пароль'}</button>
      {!required && <button type="button" className="auth-secondary" disabled={busy} onClick={onCancel}>Скасувати</button>}</div>
  </form>;
}

export default function AdminShell({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const epoch = useRef(0);
  const accept = data => { setCsrfToken(data.csrfToken); setUser(data.user); setError(''); };
  const refresh = useCallback(async (initial = false) => {
    const version = epoch.current;
    try {
      const data = await authRequest('auth/me', { suppressAuthEvent: initial === true });
      if (version === epoch.current) { setCsrfToken(data.csrfToken); setUser(data.user); setError(''); }
    } catch (err) { if (version === epoch.current && !(initial === true && err.status === 401)) setError(err.message); }
  }, []);
  useEffect(() => {
    let active = true;
    refresh(true).finally(() => { if (active) setLoading(false); });
    const expired = () => {
      epoch.current++; setCsrfToken(null); setUser(null); setShowUsers(false); setShowPassword(false);
      setError('Сесію завершено або доступ відкликано. Увійдіть знову.');
    };
    window.addEventListener('admin-session-expired', expired);
    window.addEventListener('admin-password-required', refresh);
    return () => { active = false; window.removeEventListener('admin-session-expired', expired); window.removeEventListener('admin-password-required', refresh); };
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user, refresh]);
  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError(''); epoch.current++;
    try { accept(await authRequest('auth/login', jsonBody('POST', { login, password }))); setPassword(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError(''); epoch.current++;
    try {
      await authRequest('auth/logout', { method: 'POST' });
      setCsrfToken(null); setUser(null); setShowUsers(false); setShowPassword(false); setPassword('');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (loading) return <main className="auth-page"><p role="status">Перевіряємо сесію…</p></main>;
  if (!user) return <main className="auth-page"><form className="auth-card" onSubmit={signIn}>
    <div className="auth-eyebrow">КЕРУВАННЯ БОТАМИ</div><h1>Вхід в адмінпанель</h1>
    <p>Увійдіть з обліковим записом, який надав суперадміністратор.</p>
    <label>Логін або email<input autoComplete="username" autoCapitalize="none" value={login} onChange={e => setLogin(e.target.value)} required maxLength={254} /></label>
    <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} /></label>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <button disabled={busy}>{busy ? 'Входимо…' : 'Увійти'}</button>
  </form></main>;
  return <div className="admin-shell">
    <header className="admin-account-bar">
      <div><strong>{user.name}</strong> <span>@{user.login} · {user.role === 'superadmin' ? 'Суперадміністратор' : 'Адміністратор'}</span></div>
      <nav aria-label="Обліковий запис">
        {!user.mustChangePassword && user.role === 'superadmin' && <button onClick={() => setShowUsers(true)}>Користувачі та доступ</button>}
        {!user.mustChangePassword && <button onClick={() => setShowPassword(true)}>Змінити пароль</button>}
        <button disabled={busy} onClick={logout}>Вийти</button>
      </nav>
    </header>
    {error && <div role="alert" className="auth-banner">{error}</div>}
    {user.mustChangePassword ? <main className="auth-page"><PasswordForm required onSuccess={accept} /></main> :
      <div className="admin-workspace">{children}</div>}
    {!user.mustChangePassword && showUsers && user.role === 'superadmin' && <AdminUsers currentUser={user} onClose={() => setShowUsers(false)} />}
    {!user.mustChangePassword && showPassword && <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Зміна пароля">
      <PasswordForm onSuccess={data => { epoch.current++; accept(data); setShowPassword(false); }} onCancel={() => setShowPassword(false)} />
    </div>}
  </div>;
}
