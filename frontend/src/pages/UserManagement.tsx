import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus, RefreshCcw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { adminAudit, adminCreateUser, adminUpdateUser, adminUsers } from '../api/endpoints';
import type { Role, UserDto } from '../api/types';
import { validateEmail, validatePassword, PASSWORD_HINT } from '../auth/validation';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { Empty, ErrorState, Modal, Pagination, Spinner } from '../components/ui';
import { dateTime } from '../fmt';

const ROLE_INFO: [Role, string][] = [['ADMIN', 'Administrator (Full access)'], ['ANALYST', 'Analyst'], ['USER', 'User (Basic access)']];
const RoleChip = ({ r }: { r: string }) => <span className={`badge role role--${r.toLowerCase()}`} style={{ marginRight: 4 }}>{r}</span>;

function Drawer({ user, initialTab, onClose }: { user: UserDto; initialTab: 'overview' | 'roles'; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'roles' | 'activity'>(initialTab);
  const [roles, setRoles] = useState<string[]>(user.roles), [active, setActive] = useState(user.active), [notes, setNotes] = useState(user.notes ?? ''), [err, setErr] = useState<string | null>(null);
  useEffect(() => { setRoles(user.roles); setActive(user.active); setNotes(user.notes ?? ''); }, [user]);
  const activity = useQuery({ queryKey: ['audit', 'actor', user.id], queryFn: () => adminAudit({ actor: user.id, size: 10 }), enabled: tab === 'activity' });
  const save = useMutation({ mutationFn: () => adminUpdateUser(user.id, { roles, active, notes }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); }, onError: (e) => setErr(errorMessage(e)) });
  const toggle = (r: string) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  return (
    <aside className="drawer" aria-label="User details">
      <div className="head"><h2>User Details</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X /></button></div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '12px 0' }}><Avatar name={user.displayName} size={64} /><div><b style={{ fontSize: 20 }}>{user.displayName}</b> <span className={`status ${user.active ? 'status--completed' : 'status--failed'}`}>{user.active ? 'Active' : 'Inactive'}</span><div className="muted">{user.email}</div></div></div>
      <div className="tabs">{([['overview', 'Overview'], ['roles', 'Roles & Permissions'], ['activity', 'Activity']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'overview' && <dl className="info" style={{ marginTop: 10 }}><dt>User ID</dt><dd>{user.id}</dd><dt>Full Name</dt><dd>{user.displayName}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Phone</dt><dd>{user.phone || '—'}</dd><dt>Created At</dt><dd>{dateTime(user.createdAt)}</dd><dt>Last Login</dt><dd>{dateTime(user.lastLoginAt)}</dd></dl>}
      {tab === 'roles' && <><h3>Roles</h3>{ROLE_INFO.map(([r, l]) => <label key={r} className="check" style={{ marginBottom: 10 }}><input type="checkbox" checked={roles.includes(r)} disabled={r === 'USER'} onChange={() => toggle(r)} />{l}</label>)}</>}
      {tab === 'activity' && (activity.isLoading ? <Spinner /> : !activity.data?.items.length ? <Empty title="No recorded activity." /> : activity.data.items.map((a) => <div key={a.id} className="ev"><div className="ev__body"><b>{a.actionLabel ?? a.action}</b> <span className={a.outcome === 'SUCCESS' ? 'up' : 'down'}>{a.outcome}</span><div className="ev__meta">{dateTime(a.createdAt)}</div><div style={{ fontSize: 13 }}>{a.details}</div></div></div>))}
      <h3 style={{ marginTop: 18 }}>Account Status</h3>
      <label className="check"><button className="switch" role="switch" aria-checked={active} aria-label="Account active" onClick={() => setActive(!active)} />{active ? 'Active' : 'Inactive'}</label><div className="muted">Inactive users cannot sign in to the system.</div>
      <label className="lbl" htmlFor="un">Notes</label><textarea id="un" className="input" rows={3} maxLength={500} placeholder="Add internal notes about this user..." value={notes} onChange={(e) => setNotes(e.target.value)} /><div className="muted right">{notes.length}/500</div>
      {err && <div className="form-error" role="alert">{err}</div>}
      <div className="row-end"><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn btn--primary" disabled={save.isPending} onClick={() => save.mutate()}>Save Changes</button></div>
    </aside>
  );
}

function AddUser({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ displayName: '', email: '', password: '' }), [roles, setRoles] = useState<string[]>(['USER']), [err, setErr] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => adminCreateUser({ ...f, roles }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); }, onError: (e) => setErr(errorMessage(e)) });
  const submit = () => { const m = !f.displayName.trim() ? 'Name is required.' : validateEmail(f.email) ?? validatePassword(f.password); if (m) return setErr(m); setErr(null); create.mutate(); };
  return (
    <Modal title="Add User" onClose={onClose}>
      <label className="lbl" htmlFor="an">Full name</label><input id="an" className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
      <label className="lbl" htmlFor="ae">Email address</label><input id="ae" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label className="lbl" htmlFor="ap">Temporary password</label><input id="ap" className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><div className="muted" style={{ fontSize: 13 }}>{PASSWORD_HINT}</div>
      <div className="lbl">Roles</div>{ROLE_INFO.map(([r, l]) => <label key={r} className="check" style={{ marginBottom: 6 }}><input type="checkbox" checked={roles.includes(r)} disabled={r === 'USER'} onChange={() => setRoles((c) => (c.includes(r) ? c.filter((x) => x !== r) : [...c, r]))} />{l}</label>)}
      {err && <div className="form-error" role="alert">{err}</div>}
      <div className="row-end"><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn btn--primary" disabled={create.isPending} onClick={submit}>Create User</button></div>
    </Modal>
  );
}

export default function UserManagement() {
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(0), [sel, setSel] = useState<{ u: UserDto; tab: 'overview' | 'roles' } | null>(null), [adding, setAdding] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const qc = useQueryClient(), toast = useToast();
  const bulk = useMutation({ mutationFn: async (active: boolean) => { for (const id of checked) await adminUpdateUser(id, { active }); }, onSuccess: (_d, active) => { toast(`${checked.size} user(s) ${active ? 'activated' : 'deactivated'}.`, 'success'); setChecked(new Set()); qc.invalidateQueries({ queryKey: ['admin-users'] }); }, onError: (e) => { toast(errorMessage(e), 'error'); qc.invalidateQueries({ queryKey: ['admin-users'] }); } });
  const list = useQuery({ queryKey: ['admin-users', q, role, status, page], queryFn: () => adminUsers({ q, role, status, page, size: 8 }) });
  return (
    <>
      <div className="head"><div><h1 className="title">User Management</h1><p className="subtitle">Manage users and their roles</p></div><button className="btn btn--primary" onClick={() => setAdding(true)}><Plus size={16} /> Add User</button></div>
      <div className="card">
        <div className="toolbar"><div className="search grow" style={{ maxWidth: 'none' }}><Search size={18} /><input aria-label="Search users" placeholder="Search users by name or email..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
          <select className="input" aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}><option value="">All Roles</option><option>ADMIN</option><option>ANALYST</option><option>USER</option></select>
          <select className="input" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">All Statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
          <button className="btn btn--ghost" onClick={() => { setQ(''); setRole(''); setStatus(''); setPage(0); }}><RefreshCcw size={16} /> Reset</button></div>
        {checked.size > 0 && <div className="bulkbar" role="region" aria-label="Bulk actions"><b>{checked.size} selected</b><button className="btn btn--ghost" disabled={bulk.isPending} onClick={() => bulk.mutate(true)}>Activate</button><button className="btn btn--danger" disabled={bulk.isPending} onClick={() => bulk.mutate(false)}>Deactivate</button><button className="link-btn" onClick={() => setChecked(new Set())}>Clear</button></div>}
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Users could not be loaded (administrator access required)." onRetry={() => list.refetch()} /> : !list.data!.items.length ? <Empty title="No users match your filters." /> :
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th style={{ width: 36 }}><input type="checkbox" aria-label="Select all users on this page" checked={!!list.data && list.data.items.length > 0 && list.data.items.every((u) => checked.has(u.id))} onChange={(e) => setChecked(e.target.checked ? new Set(list.data!.items.map((u) => u.id)) : new Set())} /></th><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>
            {list.data!.items.map((u) => <tr key={u.id} style={sel?.u.id === u.id || checked.has(u.id) ? { background: 'rgba(47,140,255,.1)' } : {}}><td><input type="checkbox" aria-label={`Select ${u.displayName}`} checked={checked.has(u.id)} onChange={(e) => setChecked((c) => { const n = new Set(c); e.target.checked ? n.add(u.id) : n.delete(u.id); return n; })} /></td><td><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Avatar name={u.displayName} /><b>{u.displayName}</b></span></td><td>{u.email}</td><td>{u.roles.map((r) => <RoleChip key={r} r={r} />)}</td>
              <td><span className={`status ${u.active ? 'status--completed' : 'status--failed'}`}>{u.active ? 'Active' : 'Inactive'}</span></td><td>{dateTime(u.createdAt)}</td><td><span style={{ display: 'flex', gap: 8 }}><button className="btn btn--ghost tbl-btn" onClick={() => setSel({ u, tab: 'roles' })}><Pencil size={14} /> Edit</button><button className="btn btn--ghost tbl-btn" onClick={() => setSel({ u, tab: 'overview' })}><Eye size={14} /> View</button></span></td></tr>)}
          </tbody></table></div>}
        {list.data && <Pagination page={page} size={8} total={list.data.total} onPage={setPage} label="users" />}</div>
      {sel && <Drawer key={sel.u.id + sel.tab} user={sel.u} initialTab={sel.tab} onClose={() => setSel(null)} />}{adding && <AddUser onClose={() => setAdding(false)} />}
    </>
  );
}
