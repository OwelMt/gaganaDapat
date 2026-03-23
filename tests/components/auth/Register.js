import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/Register.css';
import DashboardShell from '../layout/DashboardShell';

export default function Register() {
  const navigate = useNavigate();

  // ---------- AUTH GUARD ----------
  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/');
    }
  }, [navigate]);

  // ---------- FORM STATE ----------
  const [role, setRole] = useState('drrmo');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hotline, setHotline] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState({});

  const [touched, setTouched] = useState({});

  const barangays = Array.from({ length: 25 }, (_, i) => `Brgy ${i + 1}`);

  // ---------- VALIDATORS ----------
  function validatePassword(pw) {
    if (!pw) return 'Password is required';
    if (!/^[A-Z]/.test(pw)) return 'Password must start with a capital letter';
    if (!/\d/.test(pw)) return 'Password must contain at least one number';
    if (pw.length < 8) return 'Password must be at least 8 characters';
    return '';
  }

  function validateEmail(value) {
    if (!value) return 'Email is required';
    if (!value.includes('@') || !value.includes('.com')) {
      return 'Email must contain @ and .com';
    }
    return '';
  }

  function validatePhone(value) {
    if (!value) return 'Phone number is required';
    if (!/^\d{10,11}$/.test(value)) return 'Enter valid phone number (10-11 digits)';
    return '';
  }

  // ---------- REAL-TIME VALIDATION ----------
  useEffect(() => {
    const nextErrors = {};

    if (touched.username && !username)
      nextErrors.username = 'Username is required';

    if (touched.email) {
      const emailError = validateEmail(email);
      if (emailError) nextErrors.email = emailError;
    }

    if (touched.phoneNumber) {
      if (!phoneNumber)
        nextErrors.phoneNumber = 'Phone number is required';
      else {
        const phoneErr = validatePhone(phoneNumber);
        if (phoneErr) nextErrors.phoneNumber = phoneErr;
      }
    }

    if (touched.address && !address)
      nextErrors.address = 'Address is required';

    if (touched.password) {
      const pwError = validatePassword(password);
      if (pwError) nextErrors.password = pwError;
    }

    if (touched.confirmPassword && password !== confirmPassword)
      nextErrors.confirmPassword = 'Passwords do not match';

    setErrors(nextErrors);
  }, [username, email, password, confirmPassword, phoneNumber, address, role, touched]);

  // ---------- SUBMIT VALIDATION ----------
  function computeErrors() {
    const nextErrors = {};

    if (touched.username && !username)
      nextErrors.username = 'Username is required';

    if (touched.email) {
      const emailError = validateEmail(email);
      if (emailError) nextErrors.email = emailError;
    }

    if (touched.phoneNumber) {
      if (!phoneNumber)
        nextErrors.phoneNumber = 'Phone number is required';
      else {
        const phoneErr = validatePhone(phoneNumber);
        if (phoneErr) nextErrors.phoneNumber = phoneErr;
      }
    }

    if (touched.address && !address)
      nextErrors.address = 'Address is required';

    if (touched.password) {
      const pwError = validatePassword(password);
      if (pwError) nextErrors.password = pwError;
    }

    if (touched.confirmPassword && password !== confirmPassword)
      nextErrors.confirmPassword = 'Passwords do not match';

    setErrors(nextErrors);
  }

  // ---------- SUBMIT VALIDATION ----------
  function computeErrors() {
    const nextErrors = {};

    if (touched.username && !username)
      nextErrors.username = 'Username is required';

    if (touched.email) {
      const emailError = validateEmail(email);
      if (emailError) nextErrors.email = emailError;
    }

    if (touched.phoneNumber) {
      if (!phoneNumber)
        nextErrors.phoneNumber = 'Phone number is required';
      else {
        const phoneErr = validatePhone(phoneNumber);
        if (phoneErr) nextErrors.phoneNumber = phoneErr;
      }
    }

    if (touched.address && !address)
      nextErrors.address = 'Address is required';

    if (touched.password) {
      const pwError = validatePassword(password);
      if (pwError) nextErrors.password = pwError;
    }

    if (touched.confirmPassword && password !== confirmPassword)
      nextErrors.confirmPassword = 'Passwords do not match';

    
    return nextErrors;
  }

  // ---------- SUBMIT ----------
  function handleRegister() {
    const freshErrors = computeErrors();
    setErrors(freshErrors);

    if (Object.keys(freshErrors).length > 0) {
      alert('Please fix the errors first');
      return;
    }

    const payload = {
      username,
      password,
      role,
      email,
      phoneNumber,
      hotline: hotline || undefined,
      address
    };

    fetch('http://localhost:8000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Registration failed');
        return res.json();
      })
      .then(() => {
        alert(`${role.toUpperCase()} account created`);
        navigate('/admin/dashboard');
      })
      .catch(err => {
        console.error(err);
        alert(err.message);
      });
  }

  // ---------- UI ----------
  return (
    <DashboardShell>
      <div className="register-page">
        {/* Content area only; no left panel; no white card */}
        <div className="shell" style={{ padding: 16, justifyContent: 'center' }}>
          <main className="content" style={{ maxWidth: 1200, width: '100%' }}>
            {/* Simple header */}
            <header className="panel-header" style={{ border: 'none', padding: 0, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 6px' }}>Create Admin account</h2>
              <p className="panel-desc" style={{ margin: 0 }}>
                Use this form to create an administrator account. Each admin is assigned a role and
                specific permissions that define what parts of the system they can access.
              </p>
            </header>

            {/* Form */}
            <div className="form-body">
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegister();
                }}
              >
                {/* Username */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Username</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        className={`input ${errors.username ? 'invalid' : ''}`}
                        placeholder="Username"
                        value={username}
                        onChange={e => {
                          setUsername(e.target.value);
                          setTouched(prev => ({ ...prev, username: true }));
                        }}
                        // onChange={e => {
                        //   setUsername(e.target.value);
                        //   setTouched(prev => ({ ...prev, username: true }));
                        // }}
                      />
                      {errors.username && <span className="error">{errors.username}</span>}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Email Address</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        className={`input ${errors.email ? 'invalid' : ''}`}
                        placeholder="Email"
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value);
                          setTouched(prev => ({ ...prev, email: true }));
                        }}
                      />
                      {errors.email && <span className="error">{errors.email}</span>}
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Phone Number</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        className={`input ${errors.phoneNumber ? 'invalid' : ''}`}
                        placeholder="Phone Number"
                        value={phoneNumber}
                        onChange={e => {
                          setPhoneNumber(e.target.value);
                          setTouched(prev => ({ ...prev, phoneNumber: true }));
                        }}
                      />
                      {errors.phoneNumber && <span className="error">{errors.phoneNumber}</span>}
                    </div>
                  </div>
                </div>

                {/* Hotline */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Hotline (optional)</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        className="input"
                        placeholder="Hotline (optional)"
                        value={hotline}
                        onChange={e => {
                          setHotline(e.target.value);
                          setTouched(prev => ({ ...prev, hotline: true }));
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Address</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        className={`input ${errors.address ? 'invalid' : ''}`}
                        placeholder="Address"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
                      />
                      {errors.address && <span className="error">{errors.address}</span>}
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Password</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        type="password"
                        className={`input ${errors.password ? 'invalid' : ''}`}
                        placeholder="Password"
                        value={password}
                        onChange={e => {
                          setPassword(e.target.value);
                          setTouched(prev => ({ ...prev, password: true }));
                        }}
                      />
                      {errors.password && <span className="error">{errors.password}</span>}
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="section">
                  <div className="section-head">
                    <div className="section-title">Confirm Password</div>
                  </div>
                  <div className="section-control">
                    <div className="field">
                      <input
                        type="password"
                        className={`input ${errors.confirmPassword ? 'invalid' : ''}`}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={e => {
                          setConfirmPassword(e.target.value);
                          setTouched(prev => ({ ...prev, confirmPassword: true }));
                        }}
                      />
                      {errors.confirmPassword && (
                        <span className="error">{errors.confirmPassword}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="section">
                  <div className="section-control actions-right">
                    <button type="submit" className="btn btn-commit">Create Account</button>
                  </div>
                </div>

                {/* Back */}
                <div className="section">
                  <div className="section-control actions-right">
                  
                  </div>
                </div>

              </form>
            </div>
          </main>
        </div>
      </div>
    </DashboardShell>
  );
}
