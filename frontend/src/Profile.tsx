import { useEffect, useState, type ChangeEvent } from 'react';
import { Camera, Globe, MapPin, Save, Trash2, UserRound } from 'lucide-react';
import { getStoredAuth, storeAuth, type AuthUser } from './api';
import './Profile.css';

type ProfileData = {
  displayName: string;
  avatar: string;
  location: string;
  bio: string;
  headline: string;
  primaryFocus: string;
  phone: string;
  website: string;
};

interface ProfileProps {
  currentUser: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
}

function profileKey(userId: string) {
  return `demetra.profile.${userId}`;
}

function loadProfile(user: AuthUser): ProfileData {
  const fallback: ProfileData = {
    displayName: user.name,
    avatar: '',
    location: '',
    bio: '',
    headline: user.role === 'ORGANIZER' ? 'Teacher' : 'Student',
    primaryFocus: '',
    phone: '',
    website: '',
  };

  const saved = localStorage.getItem(profileKey(user.id));
  if (!saved) return fallback;

  try {
    return { ...fallback, ...(JSON.parse(saved) as Partial<ProfileData>) };
  } catch {
    return fallback;
  }
}

export default function Profile({ currentUser, onUserUpdated }: ProfileProps) {
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile(currentUser));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadProfile(currentUser));
    setSaved(false);
  }, [currentUser]);

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const uploadAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateField('avatar', typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    const normalizedProfile = {
      ...profile,
      displayName: profile.displayName.trim() || currentUser.name,
      location: profile.location.trim(),
      headline: profile.headline.trim(),
      primaryFocus: profile.primaryFocus.trim(),
      phone: profile.phone.trim(),
      website: profile.website.trim(),
    };

    localStorage.setItem(profileKey(currentUser.id), JSON.stringify(normalizedProfile));
    setProfile(normalizedProfile);

    const auth = getStoredAuth();
    const updatedUser = { ...currentUser, name: normalizedProfile.displayName };
    if (auth) storeAuth({ token: auth.token, user: updatedUser });
    onUserUpdated(updatedUser);
    setSaved(true);
  };

  const roleLabel = currentUser.role === 'ORGANIZER' ? 'Teacher account' : 'Student account';
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'D';

  return (
    <div className="profile-page page-transition-container">
      <section className="profile-hero">
        <div className="profile-hero-copy">
          <div className="profile-spark">✦</div>
          <div className="profile-eyebrow">Demetra Profile</div>
          <h1 className="profile-title">Edit your profile</h1>
          <p className="profile-subtitle">
            Keep the details other members see around your events, notes, and organization activity.
          </p>
        </div>

        <div className="profile-preview">
          <div className="profile-avatar profile-avatar--large">
            {profile.avatar ? <img src={profile.avatar} alt="" /> : <span>{initials}</span>}
          </div>
          <div>
            <div className="profile-preview-name">{profile.displayName || currentUser.name}</div>
            <div className="profile-preview-role">{roleLabel}</div>
            {profile.location && <div className="profile-preview-meta"><MapPin size={13} /> {profile.location}</div>}
          </div>
        </div>
      </section>

      <main className="profile-content">
        <section className="profile-card profile-card--media">
          <div className="profile-card-heading">
            <h2>Profile Picture</h2>
            <p>Use a clear portrait or a studio mark.</p>
          </div>
          <div className="profile-photo-row">
            <div className="profile-avatar profile-avatar--edit">
              {profile.avatar ? <img src={profile.avatar} alt="" /> : <UserRound size={42} />}
            </div>
            <div className="profile-photo-actions">
              <label className="profile-file-btn">
                <Camera size={16} />
                Upload photo
                <input type="file" accept="image/*" onChange={uploadAvatar} />
              </label>
              {profile.avatar && (
                <button type="button" className="profile-secondary-btn" onClick={() => updateField('avatar', '')}>
                  <Trash2 size={15} />
                  Remove
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-card-heading">
            <h2>Basic Information</h2>
            <p>Name is shown in the navbar and inside your account.</p>
          </div>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>Display name</label>
              <input value={profile.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
            </div>
            <div className="profile-field">
              <label>Headline</label>
              <input value={profile.headline} onChange={(e) => updateField('headline', e.target.value)} placeholder="Teacher, pianist, student..." />
            </div>
            <div className="profile-field">
              <label>Location</label>
              <input value={profile.location} onChange={(e) => updateField('location', e.target.value)} placeholder="Sofia, online, school studio..." />
            </div>
            <div className="profile-field">
              <label>{currentUser.role === 'ORGANIZER' ? 'Primary subject' : 'Primary interest'}</label>
              <input value={profile.primaryFocus} onChange={(e) => updateField('primaryFocus', e.target.value)} placeholder="Piano, choir, music theory..." />
            </div>
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-card-heading">
            <h2>About</h2>
            <p>Optional, but helpful for students, teachers, and event guests.</p>
          </div>
          <div className="profile-field">
            <label>Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => updateField('bio', e.target.value)}
              placeholder="Write a short introduction..."
              rows={6}
            />
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-card-heading">
            <h2>Contact</h2>
            <p>These fields are optional.</p>
          </div>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>Phone</label>
              <input value={profile.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+359..." />
            </div>
            <div className="profile-field">
              <label>Website</label>
              <div className="profile-input-icon">
                <Globe size={15} />
                <input value={profile.website} onChange={(e) => updateField('website', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>
        </section>

        <div className="profile-save-bar">
          <button type="button" className="profile-save-btn" onClick={saveProfile}>
            <Save size={16} />
            Save profile
          </button>
          {saved && <span className="profile-saved">Saved</span>}
        </div>
      </main>
    </div>
  );
}
