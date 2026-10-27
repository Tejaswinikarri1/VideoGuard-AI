import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, Check, Info, KeyRound, Lock, Monitor, Moon, Palette, ShieldCheck, Sun, User as UserIcon, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { changePassword, systemStatus, updateProfile } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { Spinner } from '../components/ui';
import { dateTime } from '../fmt';
import { usePref } from '../prefs';
import { useTheme, type ThemeChoice } from '../theme/ThemeContext';

type Tab = 'profile' | 'security' | 'notifications' | 'appearance' | 'about';
const TABS: { k: Tab; label: string; icon: ReactNode; sub: string }[] = [
  { k: 'profile', label: 'Profile', icon: <UserIcon size={18} />, sub: 'Name, contact details' }, { k: 'security', label: 'Security', icon: <KeyRound size={18} />, sub: 'Password and sign-in' },
  { k: 'notifications', label: 'Notifications', icon: <Bell size={18} />, sub: 'Alerts on this device' }, { k: 'appearance', label: 'Appearance', icon: <Palette size={18} />, sub: 'Theme' },
  { k: 'about', label: 'About & privacy', icon: <Info size={18} />, sub: 'Version, data handling' },
];

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return <section className="card set-sec"><h2>{title}</h2>{desc && <p className="muted set-desc">{desc}</p>}{children}</section>;
}
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="set-row"><div><b>{label}</b>{hint && <small className="muted">{hint}</small>}</div><div className="set-ctl">{children}</div></div>;
}
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

/** The form copies the user into local state, so it must only mount once the user has been restored (page refresh). */
function Profile() {
  const { user } = useAuth();
  return user ? <ProfileForm key={user.id} /> : <Spinner />;
}

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.displayName ?? ''), [phone, setPhone] = useState(user?.phone ?? '');
  const dirty = name.trim() !== (user?.displayName ?? '') || phone.trim() !== (user?.phone ?? '');
  const save = useMutation({ mutationFn: () => updateProfile({ displayName: name.trim(), phone: phone.trim() }), onSuccess: (u) => { updateUser(u); toast('Profile updated.', 'success'); }, onError: (e) => toast(errorMessage(e), 'error') });
  return (
    <>
      <Section title="Profile" desc="This information is shown to other reviewers and in the audit log.">
        <div className="set-hero"><Avatar name={user?.displayName} size={72} /><div><b style={{ fontSize: 20 }}>{user?.displayName}</b><div className="muted">{user?.email}</div><div style={{ marginTop: 8 }}>{user?.roles.map((r) => <span key={r} className={`badge role role--${r.toLowerCase()}`} style={{ marginRight: 6 }}>{r}</span>)}</div></div></div>
        <div className="set-grid">
          <div><label className="lbl" htmlFor="pn">Full name</label><input id="pn" className="input" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="pe">Email address</label><div className="input-lock"><input id="pe" className="input" value={user?.email ?? ''} disabled /><Lock size={16} /></div><small className="muted">Email is your sign-in and can only be changed by an administrator.</small></div>
          <div><label className="lbl" htmlFor="pp">Phone (optional)</label><input id="pp" className="input" maxLength={40} placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="row-end"><button className="btn btn--ghost" disabled={!dirty} onClick={() => { setName(user?.displayName ?? ''); setPhone(user?.phone ?? ''); }}>Reset</button>
          <button className="btn btn--primary" disabled={!dirty || !name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save changes'}</button></div>
      </Section>
      <Section title="Account"><dl className="info" style={{ gridTemplateColumns: '180px 1fr' }}><dt>User ID</dt><dd>{user?.id}</dd><dt>Member since</dt><dd>{dateTime(user?.createdAt)}</dd><dt>Last sign-in</dt><dd>{dateTime(user?.lastLoginAt)}</dd></dl></Section>
    </>
  );
}

const RULES: [string, (p: string) => boolean][] = [['At least 10 characters', (p) => p.length >= 10], ['One uppercase letter', (p) => /[A-Z]/.test(p)], ['One lowercase letter', (p) => /[a-z]/.test(p)], ['One number', (p) => /[0-9]/.test(p)]];

function Security() {
  const { signOut } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState(''), [nw, setNw] = useState(''), [conf, setConf] = useState(''), [err, setErr] = useState<string | null>(null);
  const met = RULES.filter(([, f]) => f(nw)).length;
  const ok = met === RULES.length && nw === conf && cur.length > 0 && nw !== cur;
  const m = useMutation({ mutationFn: () => changePassword({ currentPassword: cur, newPassword: nw }), onSuccess: () => { setCur(''); setNw(''); setConf(''); setErr(null); toast('Password changed.', 'success'); }, onError: (e) => setErr(errorMessage(e)) });
  return (
    <>
      <Section title="Change password" desc="Use a password you do not use anywhere else. Changing it is recorded in the audit log.">
        <div className="set-grid set-grid--1">
          <div><label className="lbl" htmlFor="cp">Current password</label><input id="cp" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="np">New password</label><input id="np" className="input" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} />
            <div className="strength" aria-hidden><i style={{ width: `${(met / RULES.length) * 100}%`, background: met < 3 ? 'var(--danger)' : met < 4 ? 'var(--warning)' : 'var(--success)' }} /></div>
            <ul className="rules">{RULES.map(([t, f]) => <li key={t} className={f(nw) ? 'ok' : ''}>{f(nw) ? <Check size={14} /> : <X size={14} />} {t}</li>)}</ul></div>
          <div><label className="lbl" htmlFor="cf">Confirm new password</label><input id="cf" className="input" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />{conf && nw !== conf && <small className="down">Passwords do not match.</small>}</div>
        </div>
        {err && <div className="form-error" role="alert">{err}</div>}
        <div className="row-end"><button className="btn btn--primary" disabled={!ok || m.isPending} onClick={() => { setErr(null); m.mutate(); }}>{m.isPending ? 'Updating…' : 'Update password'}</button></div>
      </Section>
      <Section title="Sessions" desc="Sign-in sessions are short-lived (about 15 minutes) and end automatically; you will be asked to sign in again.">
        <Row label="This device" hint="Signed in now"><button className="btn btn--ghost" onClick={signOut}>Sign out</button></Row>
      </Section>
    </>
  );
}

function Notifications() {
  const [onAnalysis, setOnAnalysis] = usePref('notifyAnalysis', true), [badge, setBadge] = usePref('showPendingBadge', true);
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');
  return (
    <>
      <Section title="Notifications" desc="Preferences are stored on this device only.">
        <Row label="Analysis finished or failed" hint="Show an in-app message when one of your analyses completes or fails."><Switch on={onAnalysis} onChange={setOnAnalysis} label="Analysis notifications" /></Row>
        <Row label="Pending-review counter" hint="Show the number of events awaiting review next to “Pending Reviews”."><Switch on={badge} onChange={setBadge} label="Pending review counter" /></Row>
      </Section>
      <Section title="Browser notifications" desc="Also alert you while this tab is in the background.">
        <Row label="Permission" hint={!supported ? 'This browser does not support notifications.' : perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Blocked in browser settings' : 'Not requested yet'}>
          <button className="btn btn--ghost" disabled={!supported || perm !== 'default'} onClick={() => void Notification.requestPermission().then(setPerm)}>Enable browser notifications</button></Row>
      </Section>
    </>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const opts: { k: ThemeChoice; label: string; icon: ReactNode; sw: string }[] = [
    { k: 'dark', label: 'Dark', icon: <Moon size={18} />, sw: 'linear-gradient(135deg,#050b1a 55%,#0b63f6)' }, { k: 'light', label: 'Light', icon: <Sun size={18} />, sw: 'linear-gradient(135deg,#f2f6fd 55%,#0b63f6)' },
    { k: 'system', label: 'System', icon: <Monitor size={18} />, sw: 'linear-gradient(135deg,#050b1a 50%,#f2f6fd 50%)' }];
  return (
    <Section title="Theme" desc="Choose how VideoGuard AI looks. “System” follows your operating system setting.">
      <div className="theme-cards" role="radiogroup" aria-label="Theme">
        {opts.map((o) => <button key={o.k} role="radio" aria-checked={theme === o.k} className={`theme-card ${theme === o.k ? 'on' : ''}`} onClick={() => setTheme(o.k)}><span className="theme-card__sw" style={{ background: o.sw }} /><span className="cellrow">{o.icon}<b>{o.label}</b></span>{theme === o.k && <Check size={16} className="theme-card__tick" />}</button>)}
      </div>
    </Section>
  );
}

function About() {
  const { has } = useAuth();
  const st = useQuery({ queryKey: ['sys-status'], queryFn: systemStatus, retry: 0 });
  const badge = (s?: string) => <span className={`status ${s === 'UP' ? 'status--completed' : s ? 'status--failed' : 'status--neutral'}`}>{s === 'UP' ? '● Operational' : s === 'DEGRADED' ? 'Degraded' : s ? 'Unavailable' : 'Checking…'}</span>;
  return (
    <>
      <Section title="About VideoGuard AI"><dl className="info" style={{ gridTemplateColumns: '200px 1fr' }}><dt>Version</dt><dd>{st.data?.version ?? '1.0.0'}</dd><dt>Backend</dt><dd>{badge(st.isError ? 'DOWN' : st.data?.backend)}</dd><dt>AI service</dt><dd>{badge(st.isError ? undefined : st.data?.aiService)}</dd></dl>
        {has('ADMIN') && <p style={{ marginBottom: 0 }}><Link to="/admin/system">Open System Operations →</Link></p>}</Section>
      <Section title="Data & privacy" desc="How this system treats your footage and results.">
        <ul className="plain">
          <li><ShieldCheck size={16} /> Videos and evidence are stored privately and only reachable with short-lived, resource-scoped links.</li>
          <li><ShieldCheck size={16} /> Every AI-detected event starts as <b>Pending</b>. Only a human reviewer can confirm, reject or mark it uncertain.</li>
          <li><ShieldCheck size={16} /> AI results can include false positives and false negatives. Severity is a prioritisation aid, not a verdict.</li>
          <li><ShieldCheck size={16} /> No facial recognition or identity matching is performed; track numbers are not identities.</li>
          <li><ShieldCheck size={16} /> Sensitive actions (sign-ins, uploads, reviews, role changes) are recorded in the audit log.</li>
        </ul>
      </Section>
    </>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <>
      <h1 className="title">Settings</h1><p className="subtitle">Manage your account, security and preferences</p>
      <div className="set-layout">
        <nav className="set-nav" aria-label="Settings sections">
          {TABS.map((t) => <button key={t.k} className={tab === t.k ? 'on' : ''} aria-current={tab === t.k ? 'page' : undefined} onClick={() => setTab(t.k)}>{t.icon}<span><b>{t.label}</b><small>{t.sub}</small></span></button>)}
        </nav>
        <div className="set-body">{tab === 'profile' ? <Profile /> : tab === 'security' ? <Security /> : tab === 'notifications' ? <Notifications /> : tab === 'appearance' ? <Appearance /> : <About />}</div>
      </div>
    </>
  );
}
