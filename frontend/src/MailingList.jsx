import { useState, useEffect, useCallback } from 'react';
import { Mail, Trash2, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MailingList({ apiBase }) {
  const API_URL = `${apiBase}/api/mailing-list`;

  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  useEffect(() => {
    fetch(API_URL)
      .then((r) => r.json())
      .then((d) => setEmails(d.emails ?? []))
      .catch(() => showMessage('Could not load mailing list.', 'error'))
      .finally(() => setLoading(false));
  }, [API_URL, showMessage]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add email');
      setEmails(data.emails);
      setNewEmail('');
      showMessage('Email added successfully');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (emailToRemove) => {
    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(emailToRemove)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Failed to remove email');
      setEmails(data.emails);
      showMessage('Email removed');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner" />
        <p>Loading configuration…</p>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-delay-1" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="location-header">
        <div className="location-icon" style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa' }}>
          <Mail size={24} />
        </div>
        <div>
          <h2>Daily Digest Configuration</h2>
          <p className="subtitle" style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Manage who receives the 7:00 AM EST menu emails.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="form-group">
        <input
          type="email"
          placeholder="athlete@gmu.edu"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          disabled={submitting}
        />
        <button type="submit" className="primary" disabled={submitting}>
          <UserPlus size={18} />
          <span>{submitting ? 'Adding…' : 'Add Email'}</span>
        </button>
      </form>

      {message && (
        <div
          className="toast-message"
          style={{
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.type === 'success' ? '#10b981' : '#ef4444',
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="email-list">
        {emails.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
            No emails configured.
          </p>
        ) : (
          emails.map((email) => (
            <div key={email} className="email-item">
              <span>{email}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleRemove(email)}
                title="Remove Email"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
