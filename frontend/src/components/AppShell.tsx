import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardCheck, CloudUpload, FileText, Gauge, LayoutDashboard, LogOut, Moon, PlaySquare, Search, Server, Settings, Sun, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { dashboard, pendingCount, systemStatus } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { useAnalysisNotifier } from '../hooks/useAnalysisNotifier';
import { usePref } from '../prefs';
import { bytes } from '../fmt';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from './Avatar';
import { ShieldLogo } from './Logo';
import { NotificationsMenu } from './NotificationsMenu';
import { useClickOutside } from './useClickOutside';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { to: '/videos', label: 'Video Library', icon: PlaySquare, end: true },
  { to: '/videos/upload', label: 'Upload Video', icon: CloudUpload }, { to: '/analyses', label: 'Analyses & Events', icon: BarChart3 },
  { to: '/reviews', label: 'Pending Reviews', icon: ClipboardCheck, badge: true }, { to: '/settings', label: 'Settings', icon: Settings },
];
const ADMIN = [{ to: '/admin/users', label: 'User Management', icon: Users }, { to: '/admin/audit-logs', label: 'Audit Logs', icon: FileText }, { to: '/admin/system', label: 'System Operations', icon: Server }];
const KEY = 'vg.sidebar.collapsed';

export function AppShell() {
  const { user, signOut, has } = useAuth();
  const { resolved, setTheme } = useTheme();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const menuRef = useRef<HTMLDivElement>(null), searchRef = useRef<HTMLInputElement>(null);
  useClickOutside(menuRef, () => setMenu(false), menu);
  useAnalysisNotifier();
  const [showBadge] = usePref('showPendingBadge', true);
  useEffect(() => { // Ctrl/Cmd+K focuses search
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);
  const pending = useQuery({ queryKey: ['pending-count'], queryFn: pendingCount, refetchInterval: 30000 });
  const dash = useQuery({ queryKey: ['dashboard', 30], queryFn: () => dashboard(30), staleTime: 60000 });
  const status = useQuery({ queryKey: ['sys-status'], queryFn: systemStatus, refetchInterval: 30000, retry: 0 });
  const role = has('ADMIN') ? 'Administrator' : has('ANALYST') ? 'Analyst' : 'User';
  const st = dash.data?.storage;
  const used = st ? Math.min(100, Math.round((st.usedBytes / st.quotaBytes) * 100)) : 0;
  const sys = status.isError ? { cls: 'down', text: 'Backend unreachable' } : status.data?.aiService === 'UP' ? { cls: 'up', text: 'All Systems Operational' } : status.data ? { cls: 'warn', text: 'AI service unavailable' } : { cls: 'warn', text: 'Checking…' };
  const toggleCollapse = () => { const v = !collapsed; setCollapsed(v); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ } };
  const link = (n: (typeof NAV)[number]) => (
    <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false} title={collapsed ? n.label : undefined} className={({ isActive }) => `nav__link ${isActive ? 'on' : ''}`}>
      <n.icon size={20} /><span className="nav__txt">{n.label}</span>{'badge' in n && n.badge && showBadge && !!pending.data && <b className="nav__badge" aria-label={`${pending.data} pending`}>{pending.data}</b>}
    </NavLink>
  );
  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__brand"><ShieldLogo size={38} /><div className="sidebar__brandtxt"><div className="brand-name">VideoGuard <span className="brand-ai">AI</span></div><small>Smarter Surveillance<br />Safer Spaces</small></div>
          <button className="collapse-btn" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleCollapse}>{collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}</button></div>
        <nav>
          <div className="nav__sec nav__sec--first">MAIN</div>{NAV.map(link)}
          {has('ADMIN') && <><div className="nav__sec">ADMIN</div>{ADMIN.map((n) => link(n as never))}</>}
        </nav>
        <div className="sidebar__foot">
          {st && <div className="storage"><div className="storage__row"><Gauge size={16} /><span className="nav__txt">Storage Usage</span></div><div className="bar"><i style={{ width: `${used}%` }} /></div><small className="nav__txt">{bytes(st.usedBytes)} / {bytes(st.quotaBytes)} · {used}%</small></div>}
          <div className="sysstat" role="status"><i className={`dot dot--${sys.cls}`} /><span className="nav__txt"><b>System Status</b><small>{sys.text}</small></span></div>
          <div className="sidebar__user"><Avatar name={user?.displayName} /><div className="nav__txt"><b>{user?.displayName}</b><small>{role}</small></div></div>
          <div className="sidebar__actions">
            <button onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}>{resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span className="nav__txt">{resolved === 'dark' ? 'Light Mode' : 'Dark Mode'}</span></button>
            <button onClick={signOut} title="Logout"><LogOut size={16} /><span className="nav__txt">Logout</span></button>
          </div>
          <small className="ver nav__txt">v{status.data?.version ?? '1.0.0'}</small>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/videos?q=${encodeURIComponent(q)}`); }}>
            <Search size={18} /><input ref={searchRef} aria-label="Search videos" placeholder="Search videos, analyses, events..." value={q} onChange={(e) => setQ(e.target.value)} /><kbd className="kbd">Ctrl + K</kbd>
          </form>
          <button className="icon-btn" aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>{resolved === 'dark' ? <Sun size={21} color="#f5c542" /> : <Moon size={21} />}</button>
          <NotificationsMenu />
          <div className="usermenu" ref={menuRef}>
            <button className="usermenu__btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Avatar name={user?.displayName} size={40} /><span className="usermenu__name"><b>{user?.displayName}</b><small>{role}</small></span><ChevronDown size={16} /></button>
            {menu && <div className="usermenu__list" role="menu">
              <div className="usermenu__who"><Avatar name={user?.displayName} size={44} /><div><b>{user?.displayName}</b><small>{user?.email}</small></div></div>
              <button role="menuitem" onClick={() => { setMenu(false); nav('/settings'); }}><Settings size={16} /> Profile &amp; settings</button>
              <button role="menuitem" onClick={signOut}><LogOut size={16} /> Sign out</button></div>}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
