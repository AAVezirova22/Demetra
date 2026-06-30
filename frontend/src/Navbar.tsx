import { useState, useEffect } from 'react';
import {
  getStoredAuth,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AuthUser,
  type NotificationRecord,
} from './api';

type AppView = 'home' | 'register' | 'login' | 'events' | 'dashboard' | 'instruments' | 'join';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
  onOpenInvitation: (token: string) => void;
}

function getInviteToken(notification: NotificationRecord) {
  if (notification.type !== 'OrganizationInvite' || !notification.metadata || typeof notification.metadata !== 'object') return '';
  const token = (notification.metadata as { token?: unknown }).token;
  return typeof token === 'string' ? token : '';
}

export default function Navbar({ onNavigate, currentView, currentUser, onLogout, onOpenInvitation }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const loadNotifications = () => {
      const auth = getStoredAuth();
      if (!auth) return;
      listNotifications(auth.token)
        .then(({ notifications, unreadCount }) => {
          setNotifications(notifications);
          setUnreadCount(unreadCount);
        })
        .catch(() => undefined);
    };

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  const markRead = (id: string) => {
    const auth = getStoredAuth();
    if (!auth) return;
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, status: 'READ', readAt: item.readAt ?? new Date().toISOString() } : item));
    setUnreadCount(count => Math.max(0, count - 1));
    markNotificationRead(auth.token, id).catch(() => undefined);
  };

  const markAllRead = () => {
    const auth = getStoredAuth();
    if (!auth) return;
    setNotifications(prev => prev.map(item => ({ ...item, status: 'READ', readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    markAllNotificationsRead(auth.token).catch(() => undefined);
  };

  const openNotification = (notification: NotificationRecord) => {
    if (notification.status === 'UNREAD') markRead(notification.id);
    const inviteToken = getInviteToken(notification);
    if (inviteToken) {
      setNotificationsOpen(false);
      onOpenInvitation(inviteToken);
    }
  };

  const isFormView = currentView === 'register' || currentView === 'login' || currentView === 'join';

  return (
    <nav className={`nav-container ${isScrolled || isFormView ? 'scrolled' : ''}`}>
      {/* Left */}
      <div className="nav-left">
        <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
          DEMETRA
        </div>
      </div>

      {/* Center */}
      <div className="nav-center">
        <a
          href="#events"
          className="nav-link"
          onClick={(e) => { e.preventDefault(); onNavigate('events'); }}
        >
          Events
        </a>
        <a href="#instruments" className="nav-link" onClick={(e) => { e.preventDefault(); onNavigate('instruments'); }}>Instruments</a>
        {currentUser?.organization && (
          <a
            href="#dashboard"
            className="nav-link"
            onClick={(e) => { e.preventDefault(); onNavigate('dashboard'); }}
          >
            Dashboard
          </a>
        )}
      </div>

      {/* Right */}
      <div className="nav-right">
        {currentUser ? (
          <>
            <div className="nav-profile">
              <button
                type="button"
                className="nav-notification-btn"
                onClick={() => setNotificationsOpen(open => !open)}
                aria-label="Notifications"
              >
                <span className="nav-bell">!</span>
                {unreadCount > 0 && <span className="nav-notification-badge">{unreadCount}</span>}
              </button>
              <span className="nav-user">{currentUser.name}</span>
              {notificationsOpen && (
                <div className="nav-notification-panel">
                  <div className="nav-notification-header">
                    <span>Notifications</span>
                    <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>Mark all read</button>
                  </div>
                  <div className="nav-notification-list">
                    {notifications.length === 0 ? (
                      <div className="nav-notification-empty">No notifications yet.</div>
                    ) : notifications.map(notification => (
                      <button
                        type="button"
                        key={notification.id}
                        className={`nav-notification-item ${notification.status === 'UNREAD' ? 'unread' : ''}`}
                        onClick={() => openNotification(notification)}
                      >
                        <span className="nav-notification-title">{notification.title}</span>
                        <span className="nav-notification-message">{notification.message}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="nav-btn"
            >
              Sign out
            </button>
          </>
        ) : !isFormView ? (
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="nav-btn"
          >
            Get Started
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="nav-btn"
          >
            Back Home
          </button>
        )}
      </div>
    </nav>
  );
}
