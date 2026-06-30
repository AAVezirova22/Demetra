import React, { useEffect, useState } from 'react';
import './Register.css';
import {
  acceptInvitation,
  fetchInvitation,
  getStoredAuth,
  registerUser,
  storeAuth,
  type AuthUser,
  type InvitationDetails,
} from './api';

function titleCaseEnum(value: string | undefined) {
  if (!value) return 'Organization';
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export default function JoinInvitation({
  token,
  currentUser,
  onBackToHome,
  onAuthenticated,
  onNavigateToLogin,
  onLogout,
}: {
  token: string;
  currentUser: AuthUser | null;
  onBackToHome: () => void;
  onAuthenticated: (user: AuthUser) => void;
  onNavigateToLogin: () => void;
  onLogout: () => void;
}) {
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchInvitation(token)
      .then(({ invitation }) => {
        setInvitation(invitation);
        setEmail(invitation.email ?? '');
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Invitation could not be loaded.'))
      .finally(() => setLoading(false));
  }, [token]);

  const acceptExisting = async () => {
    const auth = getStoredAuth();
    if (!auth) {
      onNavigateToLogin();
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await acceptInvitation(auth.token, token);
      storeAuth({ token: auth.token, user: result.user });
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const isWrongAccount = Boolean(
    currentUser &&
    invitation?.email &&
    currentUser.email.toLowerCase() !== invitation.email.toLowerCase()
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitation) return;

    setSubmitting(true);
    setError('');
    try {
      const auth = await registerUser({
        name: name.trim(),
        email,
        password,
        role: invitation.role,
        invitationToken: token,
      });
      storeAuth(auth);
      onAuthenticated(auth.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join organization.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-form-side">
        <header className="register-brand" onClick={onBackToHome}>
          <span className="brand-icon">D</span>
          <span className="brand-name">Demetra</span>
        </header>

        <div className="register-card">
          <div className="register-header">
            <h2 className="register-title">Join organization</h2>
            <p className="register-subtitle">
              {loading
                ? 'Checking invitation...'
                : invitation
                  ? `${invitation.organization.name} invited you as ${invitation.role.toLowerCase()}.`
                  : 'This invitation cannot be used.'}
            </p>
          </div>

          {invitation && (
            <div className="invite-join-card">
              <div>
                <div className="invite-join-label">Organization</div>
                <div className="invite-join-title">{invitation.organization.name}</div>
                <div className="invite-join-meta">{titleCaseEnum(invitation.organization.kind)}</div>
              </div>
              <div className="invite-join-role">{invitation.role === 'ORGANIZER' ? 'Organizer' : 'Student'}</div>
            </div>
          )}

          {currentUser && invitation ? (
            <div className="register-form">
              {isWrongAccount ? (
                <div className="auth-message auth-message--error">
                  This invitation was sent to {invitation.email}. You are signed in as {currentUser.email}.
                </div>
              ) : error ? (
                <div className="auth-message auth-message--error">{error}</div>
              ) : null}
              <button type="button" className="register-submit-btn" onClick={acceptExisting} disabled={submitting || isWrongAccount}>
                {submitting ? 'Joining...' : `Join as ${currentUser.name}`}
              </button>
              {isWrongAccount && (
                <button type="button" className="register-secondary-btn" onClick={() => { onLogout(); onNavigateToLogin(); }}>
                  Sign out and switch account
                </button>
              )}
              <div className="register-footer">
                <span className="footer-text">Signed in as {currentUser.email}</span>
              </div>
            </div>
          ) : invitation ? (
            <form onSubmit={submit} className="register-form">
              <div className="form-group">
                <label htmlFor="invite-name">Full name</label>
                <input id="invite-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ivan Ivanov" />
              </div>
              <div className="form-group">
                <label htmlFor="invite-email">Email</label>
                <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" disabled={Boolean(invitation.email)} />
              </div>
              <div className="form-group">
                <label htmlFor="invite-password">Password</label>
                <input id="invite-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>

              {error && <div className="auth-message auth-message--error">{error}</div>}

              <button type="submit" className="register-submit-btn" disabled={submitting}>
                {submitting ? 'Creating account...' : 'Create account and join'}
              </button>
              <div className="register-footer">
                <span className="footer-text">Already have an account? </span>
                <button type="button" className="signin-link" onClick={onNavigateToLogin}>Sign in first</button>
              </div>
            </form>
          ) : (
            <div className="register-form">
              {error && <div className="auth-message auth-message--error">{error}</div>}
              <button type="button" className="register-submit-btn" onClick={onBackToHome}>Back to Demetra</button>
            </div>
          )}
        </div>
      </div>

      <div className="register-art-side">
        <div className="art-overlay">
          <div className="quote-container">
            <blockquote className="quote-text">"A school becomes a community when every invitation finds its voice."</blockquote>
            <cite className="quote-author">DEMETRA INVITATIONS</cite>
          </div>
        </div>
      </div>
    </div>
  );
}
