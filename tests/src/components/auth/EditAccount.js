import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/EditAccount.css';
import {
  sanitizeAddress,
  sanitizeEmail,
  sanitizeHotline,
  sanitizePassword,
  sanitizePhoneNumber,
  sanitizeUsername
} from './inputSanitizers';

export default function EditAccount() {
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/');
    }
  }, [navigate]);

  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(null);
  const [forms, setForms] = useState({});
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  const BASE_URL =
    process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/all`, {
        credentials: 'include'
      });

      const data = await res.json();
      const safeData = Array.isArray(data) ? data : [];
      setAccounts(safeData);

      const mappedForms = {};
      safeData.forEach((a) => {
        mappedForms[a._id] = {
          username: a.username || '',
          email: a.email || '',
          phoneNumber: a.phoneNumber || '',
          hotline: a.hotline || '',
          address: a.address || '',
          password: '',
          confirmPassword: ''
        };
      });
      setForms(mappedForms);

      if (safeData.length > 0 && !open) {
        const firstVisible = safeData.find((acc) => acc.role !== 'admin');
        if (firstVisible) {
          setOpen(firstVisible._id);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to fetch accounts');
    }
  };

  const handleChange = (id, field, value) => {
    const sanitizers = {
      username: sanitizeUsername,
      email: sanitizeEmail,
      phoneNumber: sanitizePhoneNumber,
      hotline: sanitizeHotline,
      address: sanitizeAddress,
      password: sanitizePassword,
      confirmPassword: sanitizePassword
    };

    const nextValue = sanitizers[field] ? sanitizers[field](value) : value;

    setForms((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: nextValue }
    }));
  };

  const validPhone = (phone) => /^[0-9]{10,11}$/.test(phone);
  const validPassword = (pass) =>
    /[A-Z]/.test(pass) && /[0-9]/.test(pass) && pass.length >= 8;
  const validEmail = (email) => email.includes('@') && email.includes('.com');

  const visibleAccounts = useMemo(
    () => accounts.filter((acc) => acc.role !== 'admin'),
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const term = q.toLowerCase().trim();

    return visibleAccounts.filter((a) => {
      const matchesSearch = `${a.username} ${a.email} ${a.phoneNumber} ${a.address} ${a.role}`
        .toLowerCase()
        .includes(term);

      const matchesRole =
        !roleFilter || String(a.role || '').toLowerCase() === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [visibleAccounts, q, roleFilter]);

  const selected = useMemo(
    () => visibleAccounts.find((a) => a._id === open) || null,
    [visibleAccounts, open]
  );

  const selectedForm = selected ? forms[selected._id] : null;

  const totalBarangay = useMemo(
    () => visibleAccounts.filter((a) => a.role === 'barangay').length,
    [visibleAccounts]
  );

  const totalDrrmo = useMemo(
    () => visibleAccounts.filter((a) => a.role === 'drrmo').length,
    [visibleAccounts]
  );

  const totalFiltered = filteredAccounts.length;

  const getInitials = (value = '') => {
    const text = String(value || '').trim();
    if (!text) return '?';
    return text.slice(0, 1).toUpperCase();
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!selected || !selectedForm) return false;

    return (
      (selectedForm.username || '') !== (selected.username || '') ||
      (selectedForm.email || '') !== (selected.email || '') ||
      (selectedForm.phoneNumber || '') !== (selected.phoneNumber || '') ||
      (selectedForm.hotline || '') !== (selected.hotline || '') ||
      (selectedForm.address || '') !== (selected.address || '') ||
      !!selectedForm.password ||
      !!selectedForm.confirmPassword
    );
  }, [selected, selectedForm]);

  const handleSelectAccount = (id) => {
    if (id === open) return;

    if (hasUnsavedChanges) {
      const proceed = window.confirm(
        'You have unsaved changes. Switch accounts anyway?'
      );
      if (!proceed) return;
    }

    setOpen(id);
  };

  const resetSelectedForm = () => {
    if (!selected) return;

    setForms((prev) => ({
      ...prev,
      [selected._id]: {
        username: selected.username || '',
        email: selected.email || '',
        phoneNumber: selected.phoneNumber || '',
        hotline: selected.hotline || '',
        address: selected.address || '',
        password: '',
        confirmPassword: ''
      }
    }));
  };

  const updateAccount = async (id) => {
    const data = forms[id];
    if (!data) return;

    if (data.phoneNumber && !validPhone(data.phoneNumber)) {
      return alert('Phone number must be 10–11 digits');
    }

    if (data.email && !validEmail(data.email)) {
      return alert('Email must contain @ and .com');
    }

    if (data.password) {
      if (!validPassword(data.password)) {
        return alert(
          'Password must be 8+ characters with a capital letter and a number'
        );
      }

      if (data.password !== data.confirmPassword) {
        return alert('Passwords do not match');
      }
    }

    const original = accounts.find((a) => a._id === id);
    if (!original) return;

    if (
      data.username === original.username &&
      data.email === original.email &&
      data.phoneNumber === original.phoneNumber &&
      data.hotline === original.hotline &&
      data.address === original.address &&
      !data.password
    ) {
      return alert('No changes detected');
    }

    const payload = { ...data };
    delete payload.confirmPassword;
    if (!payload.password) delete payload.password;

    try {
      setSavingId(id);

      const res = await fetch(`${BASE_URL}/api/auth/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Updated successfully');
        await fetchAccounts();
      } else {
        alert('Update failed');
      }
    } catch (err) {
      console.error(err);
      alert('Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const archiveAccount = async (id) => {
    if (!window.confirm('Archive this account?')) return;

    try {
      setArchivingId(id);

      const res = await fetch(`${BASE_URL}/api/auth/archive/${id}`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (res.ok) {
        alert('Account archived successfully');
        setAccounts((prev) => prev.filter((a) => a._id !== id));
        setOpen(null);
      } else {
        alert('Failed to archive account');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to archive account');
    } finally {
      setArchivingId(null);
    }
  };

  const stats = [
    { label: 'Accounts', value: visibleAccounts.length, tone: 'green' },
    { label: 'DRRMO', value: totalDrrmo, tone: 'blue' },
    { label: 'Barangay', value: totalBarangay, tone: 'emerald' }
  ];

  return (
    <div className="edit-account">
      <div className="ea-page-shell">
        <section className="ea-hero-card">
          <div className="ea-hero-copy">
            <div className="ea-kicker-row">
              <span className="ea-kicker">Administration Module</span>
              {hasUnsavedChanges && (
                <span className="ea-live-pill ea-live-pill--warning">
                  Unsaved Changes
                </span>
              )}
            </div>

            <h1 className="ea-page-title">Edit Accounts</h1>

            <div className="ea-hero-stats">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className={`ea-stat-card ea-stat-card--${item.tone}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ea-workspace">
          <aside className="ea-sidebar-card">
            <div className="ea-sidebar-top">
              <div className="ea-listbar">
                <input
                  className="ea-list-search"
                  type="search"
                  placeholder="Search account"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="ea-filter-row">
                <select
                  className="ea-role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="drrmo">DRRMO</option>
                  <option value="barangay">Barangay</option>
                </select>
              </div>
            </div>

            <div className="ea-list">
              {filteredAccounts.length === 0 ? (
                <div className="ea-list-empty">
                  <strong>No accounts found</strong>
                </div>
              ) : (
                filteredAccounts.map((acc) => (
                  <div key={acc._id} className="ea-item">
                    <button
                      type="button"
                      className={`ea-head ${open === acc._id ? 'is-active' : ''}`}
                      onClick={() => handleSelectAccount(acc._id)}
                    >
                      <div className="ea-head-main">
                        <div className="ea-head-avatar">
                          {getInitials(acc.username)}
                        </div>

                        <div className="ea-head-copy">
                          <strong className="ea-username">{acc.username}</strong>
                          <small className="ea-email">{acc.email || 'No email'}</small>
                        </div>
                      </div>

                      <span className={`ea-role ea-role-${acc.role}`}>
                        {acc.role}
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="ea-editor-card">
            {!selected || !selectedForm ? (
              <div className="ea-placeholder ea-placeholder--centered">
                <div className="ea-empty-illustration">👤</div>
                <div className="ea-empty-title">Select an account</div>
              </div>
            ) : (
              <div className="ea-editor-scroll">
                <div className="ea-profile-card">
                  <div className="ea-profile-main">
                    <div className="ea-profile-avatar">
                      {getInitials(selected.username)}
                    </div>

                    <div className="ea-profile-copy">
                      <div className="ea-profile-topline">
                        <h3>{selected.username}</h3>
                        <div className={`ea-role-badge ea-role-${selected.role}`}>
                          {selected.role}
                        </div>
                      </div>
                      <p>{selected.email || 'No email address'}</p>
                    </div>
                  </div>

                  <div className="ea-profile-meta">
                    <div className="ea-meta-card">
                      <span>Phone</span>
                      <strong>{selected.phoneNumber || '-'}</strong>
                    </div>
                    <div className="ea-meta-card">
                      <span>Hotline</span>
                      <strong>{selected.hotline || '-'}</strong>
                    </div>
                  </div>
                </div>

                <div className="ea-section-block">
                  <div className="ea-section-title-row">
                    <h3>Account Information</h3>
                  </div>

                  <div className="ea-form-grid">
                    <div className="ea-field">
                      <label>Username</label>
                      <input
                        value={selectedForm.username || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'username', e.target.value)
                        }
                      />
                    </div>

                    <div className="ea-field">
                      <label>Email</label>
                      <input
                        value={selectedForm.email || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'email', e.target.value)
                        }
                      />
                    </div>

                    <div className="ea-field">
                      <label>Phone Number</label>
                      <input
                        value={selectedForm.phoneNumber || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'phoneNumber', e.target.value)
                        }
                      />
                    </div>

                    <div className="ea-field">
                      <label>Hotline</label>
                      <input
                        value={selectedForm.hotline || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'hotline', e.target.value)
                        }
                      />
                    </div>

                    <div className="ea-field ea-field-full">
                      <label>Address</label>
                      <input
                        value={selectedForm.address || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'address', e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="ea-section-block">
                  <div className="ea-section-title-row">
                    <h3>Security</h3>
                  </div>

                  <div className="ea-form-grid">
                    <div className="ea-field">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={selectedForm.password || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'password', e.target.value)
                        }
                        placeholder="Leave blank to keep current password"
                      />
                    </div>

                    <div className="ea-field">
                      <label>Confirm Password</label>
                      <input
                        type="password"
                        value={selectedForm.confirmPassword || ''}
                        onChange={(e) =>
                          handleChange(selected._id, 'confirmPassword', e.target.value)
                        }
                        placeholder="Re-enter password"
                      />
                    </div>
                  </div>
                </div>

                <div className="ea-actions">
                  <button
                    className="ea-btn ea-btn-secondary"
                    type="button"
                    onClick={resetSelectedForm}
                    disabled={!hasUnsavedChanges}
                  >
                    Reset Changes
                  </button>

                  <button
                    className="ea-btn ea-btn-primary"
                    onClick={() => updateAccount(selected._id)}
                    disabled={savingId === selected._id}
                  >
                    {savingId === selected._id ? 'Updating...' : 'Update Account'}
                  </button>
                </div>

                <div className="ea-danger-zone">
                  <div className="ea-danger-zone-copy">
                    <h4>Danger Zone</h4>
                    <p>Archive this account if it should no longer remain active.</p>
                  </div>

                  <button
                    className="ea-btn ea-btn-danger"
                    onClick={() => archiveAccount(selected._id)}
                    disabled={archivingId === selected._id}
                  >
                    {archivingId === selected._id
                      ? 'Archiving...'
                      : 'Archive Account'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
