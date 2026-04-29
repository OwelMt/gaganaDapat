import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccountSettings() {
  const navigate = useNavigate();
  useEffect(() => {
      const storedRole = localStorage.getItem('role');
      if (!storedRole) {
        navigate('/'); // redirect to login
      }
    }, [navigate]);

  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);

  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const BASE_URL = process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

  useEffect(() => {
    fetch(`${BASE_URL}/api/barangays/me`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        const loaded = {
          _id: data._id,
          username: data.username || '',
          phoneNumber: data.phoneNumber || '',
          hotline: data.hotline || '',
          address: data.address || '',
          password: '',
          oldPasswordHash: data.password || '' // for comparison safeguard
        };

        setForm(loaded);
        setOriginal(loaded);
      });
  }, []);

  if (!form) return <p>Loading account...</p>;

  const strongPassword = pwd => {
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-8]/.test(pwd)
    );
  };

  const validPhone = phone => /^09\d{9}$/.test(phone);

  const hasChanges = () => (
    form.username !== original.username ||
    form.phoneNumber !== original.phoneNumber ||
    form.hotline !== original.hotline ||
    form.address !== original.address ||
    form.password.length > 0
  );

  const updateAccount = async () => {
    setError('');

    if (!hasChanges()) {
      setError('No changes detected.');
      return;
    }

    if (form.phoneNumber && !validPhone(form.phoneNumber)) {
      setError('Phone number must start with 09 and be 11 digits.');
      return;
    }

    if (form.password) {
      if (!strongPassword(form.password)) {
        setError(
          'Password atleast must be 8 characters with uppercase, lowercase, number.'
        );
        return;
      }

      if (form.password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    const payload = { ...form };
    delete payload._id;
    delete payload.oldPasswordHash;

    if (!payload.password) delete payload.password;

    const res = await fetch(
      `${BASE_URL}/api/auth/update/${form._id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      }
    );

    if (res.ok) {
      alert('Account updated successfully');

      setOriginal({ ...form, password: '' });
      setForm({ ...form, password: '' });
      setConfirmPassword('');
      navigate('/');
    } else {
      alert('New password must be different from old password');
      console.log(res)
      console.log(confirmPassword)
      console.log(form.password)
    }
  };

  return (
    <div>
      <h2>Account Settings</h2>

      <div style={box}>

        <label style={label}>Username</label>
        <input
          value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })}
        />

        <label style={label}>Phone Number</label>
        <input
          value={form.phoneNumber}
          onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
          placeholder="09XXXXXXXXX"
        />

        <label style={label}>Hotline(Optional)</label>
        <input
          value={form.hotline}
          onChange={e => setForm({ ...form, hotline: e.target.value })}
        />

        <label style={label}>Address</label>
        <input
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
        />

        <label style={label}>New Password</label>
        <input
          type="password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder="Keep empty to not change"
        />

        <label style={label}>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder='Re-enter new password'
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button onClick={updateAccount}>
          Update Account
        </button>
      </div>

      <button style={{ marginTop: 20 }} onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  );
}

const box = {
  border: '1px solid #ddd',
  padding: 16,
  maxWidth: 420,
  borderRadius: 6
};

const label = {
  display: 'block',
  marginTop: 12,
  marginBottom: 4,
  fontWeight: 'bold'
};
