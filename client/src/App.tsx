import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { api } from './api';
import { Avatar, Spinner, timeAgo, LanguageToggle } from './components';
import type { Notification } from './types';

import AuthScreen from './pages/AuthScreen';
import Dashboard from './pages/Dashboard';
import Community from './pages/Community';
import Thread from './pages/Thread';
import Mentoring from './pages/Mentoring';
import QuestionDetail from './pages/QuestionDetail';
import Mentors from './pages/Mentors';
import Messages from './pages/Messages';
import Learning from './pages/Learning';
import Profile from './pages/Profile';
import Journey from './pages/Journey';
import CaseDetail from './pages/CaseDetail';
import EemProfile from './pages/EemProfile';
import Communities, { CommunityDetail } from './pages/Communities';
import Network from './pages/Network';
import Events from './pages/Events';
import Feedback from './pages/Feedback';
import Registrations from './pages/Registrations';

function NotificationBell() {
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const r = await api.get<{ notifications: Notification[]; unread: number }>('/notifications');
      setItems(r.notifications);
      setUnread(r.unread);
    } catch { /* offline: ignore */ }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // sanftes Polling (kein WebSocket noetig)
    return () => clearInterval(id);
  }, []);

  async function openItem(n: Notification) {
    if (!n.read_at) await api.post(`/notifications/${n.id}/read`);
    setOpen(false);
    await load();
    if (n.link) nav(n.link);
  }
  async function markAll() {
    await api.post('/notifications/read-all');
    load();
  }

  return (
    <div className="dropdown">
      <button className="btn-outline" onClick={() => setOpen((o) => !o)} aria-label={t('notif.title')}>
        🔔 {unread > 0 && <span className="badge badge-gold">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="backdrop" style={{ background: 'transparent' }} onClick={() => setOpen(false)} />
          <div className="dropdown-menu">
            <div className="flex items-center" style={{ padding: '.4rem .6rem' }}>
              <b>{t('notif.title')}</b>
              <button className="btn-ghost btn-sm right" onClick={markAll}>{t('notif.markAll')}</button>
            </div>
            {items.length === 0 && <p className="muted" style={{ padding: '.6rem' }}>{t('notif.empty')}</p>}
            {items.map((n) => (
              <div key={n.id} className={`notif-item ${n.read_at ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <div className="flex items-center gap-sm">
                  {!n.read_at && <span className="dot" />}
                  <b style={{ fontSize: '.88rem' }}>{n.title}</b>
                </div>
                {n.body && <div className="muted" style={{ fontSize: '.8rem' }}>{n.body}</div>}
                <small>{timeAgo(n.created_at, locale)}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const links = [
    { to: '/dashboard', ico: '▦', label: t('nav.dashboard') },
    { to: '/communities', ico: '◎', label: t('nav.communities') },
    { to: '/journey', ico: '➜', label: t('nav.journey') },
    { to: '/network', ico: '🤝', label: t('nav.network') },
    { to: '/events', ico: '📅', label: t('nav.events') },
    { to: '/community', ico: '💬', label: t('nav.community') },
    { to: '/mentoring', ico: '🎯', label: t('nav.mentoring') },
    { to: '/mentors', ico: '👥', label: t('nav.mentors') },
    { to: '/messages', ico: '✉', label: t('nav.messages') },
    { to: '/learning', ico: '🎓', label: t('nav.learning') },
    { to: '/profile', ico: '⚙', label: t('nav.profile') },
    { to: '/feedback', ico: '💡', label: t('nav.feedback') },
    ...(user!.role === 'admin' ? [{ to: '/registrations', ico: '✔', label: t('nav.registrations') }] : []),
  ];
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <span className="star">★</span>
        <b>stars</b>
      </div>
      <nav>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} onClick={onClose} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{l.ico}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot flex items-center gap-sm">
        <Avatar name={user!.name} seed={user!.avatar_seed} size="sm" />
        <div style={{ minWidth: 0 }}>
          <div className="clamp" style={{ color: '#fff', fontSize: '.85rem', fontWeight: 600 }}>{user!.name}</div>
          <small style={{ color: '#8fa6bd' }}>{t('role.' + user!.role)}</small>
        </div>
      </div>
    </aside>
  );
}

function Layout() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);

  return (
    <div className="app">
      {menu && <div className="backdrop" onClick={() => setMenu(false)} />}
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <div className="main">
        <header className="topbar">
          <button className="menu-btn btn-outline" onClick={() => setMenu(true)}>☰</button>
          <div className="spacer" />
          {location.pathname !== '/feedback' && (
            <NavLink className="btn btn-outline" to={`/feedback?from=${encodeURIComponent(location.pathname)}`} title={t('nav.feedback')}>💡 <span className="hide-sm">Feedback</span></NavLink>
          )}
          <LanguageToggle />
          <NotificationBell />
          <button className="btn-outline" onClick={logout}>{t('nav.logout')}</button>
        </header>
        <div className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/thread/:id" element={<Thread />} />
            <Route path="/mentoring" element={<Mentoring />} />
            <Route path="/mentoring/question/:id" element={<QuestionDetail />} />
            <Route path="/mentors" element={<Mentors />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/:id" element={<CommunityDetail />} />
            <Route path="/journey" element={<Journey />} />
            <Route path="/journey/profile" element={<EemProfile />} />
            <Route path="/journey/profile/:userId" element={<EemProfile />} />
            <Route path="/journey/:id" element={<CaseDetail />} />
            <Route path="/network" element={<Network />} />
            <Route path="/events" element={<Events />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/registrations" element={<Registrations />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <AuthScreen />;
  return <Layout />;
}
