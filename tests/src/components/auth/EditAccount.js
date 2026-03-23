import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/EditAccount.css';
import DashboardShell from '../layout/DashboardShell';

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
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/all', {
        credentials: 'include'
      });
      const data = await res.json();
      setAccounts(data);

      const f = {};
      data.forEach(a => {
        f[a._id] = {
          username: a.username || '',
          email: a.email || '',
          phoneNumber: a.phoneNumber || '',
          hotline: a.hotline || '',
          address: a.address || '',
          password: '',
          confirmPassword: ''
        };
      });
      setForms(f);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch accounts');
    }
  };

  const handleChange = (id, field, value) => {
    setForms(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const validPhone = phone => /^[0-9]{10,11}$/.test(phone);
  const validPassword = pass =>
    /[A-Z]/.test(pass) &&
    /[0-9]/.test(pass) &&
    pass.length >= 8;
  const validEmail = email =>
    email.includes('@') && email.includes('.com');

  const updateAccount = async id => {
    const data = forms[id];

    if (data.phoneNumber && !validPhone(data.phoneNumber))
      return alert('Phone number must be 10–11 digits');
    if (data.email && !validEmail(data.email))
      return alert('Email must contain @ and .com');

    if (data.password) {
      if (!validPassword(data.password))
        return alert('Password must be 8+ chars, with capital letter and number');
      if (data.password !== data.confirmPassword)
        return alert('Passwords do not match');
    }

    const original = accounts.find(a => a._id === id);
    if (
      data.username === original.username &&
      data.email === original.email &&
      data.phoneNumber === original.phoneNumber &&
      data.hotline === original.hotline &&
      data.address === original.address &&
      !data.password
    ) return alert('No changes detected');

    const payload = { ...data };
    delete payload.confirmPassword;
    if (!payload.password) delete payload.password;

    const res = await fetch(`http://localhost:8000/api/auth/update/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Updated successfully');
      fetchAccounts();
    } else {
      alert('Update failed');
    }
  };

  const visibleAccounts = accounts.filter(acc => acc.role !== 'admin');

  const filteredAccounts = useMemo(() => {
    const term = q.toLowerCase();
    return visibleAccounts.filter(a =>
      `${a.username} ${a.email} ${a.phoneNumber} ${a.address}`.toLowerCase().includes(term)
    );
  }, [visibleAccounts, q]);

  const selected = accounts.find(a => a._id === open);

  return (
    <DashboardShell>
      <div className="edit-account">
        <div className="ea-two-col">
          {/* LEFT LIST */}
          <aside className="ea-sidebar">
            {/* Sticky search at top of list (like your screenshot) */}
            <div className="ea-listbar">
              <input
                className="ea-list-search"
                type="search"
                placeholder="Search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="ea-list">
              {filteredAccounts.map(acc => (
                <div key={acc._id} className="ea-item">
                  <div
                    className={`ea-head ${open === acc._id ? 'is-active' : ''}`}
                    onClick={() => setOpen(open === acc._id ? null : acc._id)}
                  >
                    <strong className="ea-username">{acc.username}</strong>
                    <span className="ea-role">{acc.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT EDITOR */}
          <section className="ea-editor">
            {/* Thin count bar on top of the editor */}
            <div className="ea-countbar">
              <span>{filteredAccounts.length} accounts</span>
            </div>

            {!selected ? (
              <div className="ea-placeholder ea-placeholder--centered">
                <div>
                  <div className="ea-empty-title">Select an account</div>
                  <div className="ea-empty-sub">
                    Choose a user from the list on the left to edit details.
                  </div>
                </div>
              </div>
            ) : (
              <div className="ea-form">
                <label>Username</label>
                <input
                  value={forms[open]?.username || ''}
                  onChange={e => handleChange(open, 'username', e.target.value)}
                />

                <label>Email</label>
                <input
                  value={forms[open]?.email || ''}
                  onChange={e => handleChange(open, 'email', e.target.value)}
                />

                <label>Phone Number</label>
                <input
                  value={forms[open]?.phoneNumber || ''}
                  onChange={e => handleChange(open, 'phoneNumber', e.target.value)}
                />

                <label>Hotline</label>
                <input
                  value={forms[open]?.hotline || ''}
                  onChange={e => handleChange(open, 'hotline', e.target.value)}
                />

                <label>Address</label>
                <input
                  value={forms[open]?.address || ''}
                  onChange={e => handleChange(open, 'address', e.target.value)}
                />

                <label>New Password</label>
                <input
                  type="password"
                  value={forms[open]?.password || ''}
                  onChange={e => handleChange(open, 'password', e.target.value)}
                  placeholder="Leave blank to keep current password"
                />

                <label>Confirm Password</label>
                <input
                  type="password"
                  value={forms[open]?.confirmPassword || ''}
                  onChange={e => handleChange(open, 'confirmPassword', e.target.value)}
                />

                <div className="ea-actions">
                  <button
                    className="ea-btn ea-btn-primary"
                    onClick={() => updateAccount(open)}
                  >
                    Update Account
                  </button>

                  <button
                    className="ea-btn ea-btn-danger"
                    onClick={async () => {
                      if (!window.confirm('Archive this account?')) return;

                      const res = await fetch(
                        `http://localhost:8000/api/auth/archive/${open}`,
                        { method: 'PUT', credentials: 'include' }
                      );

                      if (res.ok) {
                        alert('Account archived successfully');
                        setAccounts(prev => prev.filter(a => a._id !== open));
                        setOpen(null);
                      } else {
                        alert('Failed to archive account');
                      }
                    }}
                  >
                    Archive Account
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
