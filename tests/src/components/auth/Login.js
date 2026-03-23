import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SplashScreen from '../splashscreen/SplashScreen';

import jaenlogo from '../../assets/images/jaenlogo.png';
import sagipbayanlogo from '../../assets/images/sagipbayanlogo.png';

import hero4 from '../../assets/images/hero4.jpg';
import hero5 from '../../assets/images/hero5.jpg';
import hero6 from '../../assets/images/hero6.jpg';

import './Login.css';

export default function Login() {
  // ---------- ORIGINAL STATE / LOGIC (UNCHANGED) ----------
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('barangay');
  const [selectedBarangay, setSelectedBarangay] = useState(''); // preserved (even if not used here)
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [showSplash, setShowSplash] = useState(true);
  const [eError, setEError] = useState("");
  const [pError, setPError] = useState("");

  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION = 10 * 60 * 1000;
  const [adminAttempts, setAdminAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  const BASE_URL = process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";
  const local = "http://localhost:8000";

  useEffect(() => {
    const lockInfo = JSON.parse(localStorage.getItem('adminLock')) || {};
    if (lockInfo.expiresAt && lockInfo.expiresAt > Date.now()) {
      const remaining = lockInfo.expiresAt - Date.now();
      setIsLocked(true);
      setLockMessage(`Too many failed attempts. Try again in:`);
      setCountdown(Math.ceil(remaining / 1000));
      setAdminAttempts(MAX_ATTEMPTS);

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            setIsLocked(false);
            setAdminAttempts(0);
            setLockMessage('');
            localStorage.removeItem('adminLock');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, []);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) return alert('Please fill all fields');
    if (role === 'admin' && isLocked) return;

  const payload = { email: trimmedEmail, password: trimmedPassword };

  console.log("Attempting login with:", payload);

  try {
    const res = await fetch(`${local}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    // DEBUG: log raw response
    console.log("Login response status:", res.status, res.statusText);

      let data;
      try {
        data = await res.json();
      } catch {
        data = { message: "Invalid JSON response from server" };
      }

      if (!res.ok) {
        if (role === 'admin') {
          const attempts = adminAttempts + 1;
          setAdminAttempts(attempts);

          if (attempts >= MAX_ATTEMPTS) {
            const expiresAt = Date.now() + LOCK_DURATION;
            setIsLocked(true);
            setLockMessage(`Too many failed attempts. Try again in:`);
            setCountdown(Math.ceil(LOCK_DURATION / 1000));
            localStorage.setItem('adminLock', JSON.stringify({ attempts: MAX_ATTEMPTS, expiresAt }));
          } else {
            alert(`Login failed. Attempts left: ${MAX_ATTEMPTS - attempts}`);
          }
        } else {
          alert(data.message || 'Login failed');
        }
        return;
      }

      setUser(data);
      localStorage.setItem('role', data.role);

      if (data.role === 'admin') navigate('/admin/dashboard');
      else if (data.role === 'drrmo') navigate('/drrmo/dashboard');
      else navigate('/barangay/dashboard');

    } catch (err) {
      console.error("Login fetch error:", err);
      alert("Login failed. Check server or network.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // ---------- LIGHT CAROUSEL (LEFT) ----------
  const slides = [hero5, hero4, hero6].filter(Boolean);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!slides.length) return;
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3500);
    return () => clearInterval(id);
  }, [slides.length]);

  if (showSplash) return <SplashScreen />;

  return (
    <div className="login-page">
      <div className="login-split">
        {/* LEFT: CAROUSEL (NEVER CHANGES WITH ROLE) */}
        <aside className="login-left-carousel" aria-label="Highlights">
          <div className="carousel-stack">
            {slides.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Slide ${i + 1}`}
                className={`carousel-slide ${i === currentSlide ? 'is-active' : ''}`}
                aria-hidden={i === currentSlide ? 'false' : 'true'}
              />
            ))}
          </div>

          <div className="carousel-overlay">
            <div className="carousel-logos" aria-hidden="true">
              <img src={jaenlogo} alt="Jaen Logo" />
              <img src={sagipbayanlogo} alt="SagipBayan Logo" className="logo-sagip" />
            </div>
            <h1 className="carousel-title">Jaen MDRRMO Portal</h1>
            <p className="carousel-tag">Connecting Communities. Protecting Lives.</p>
          </div>
        </aside>

        {/* RIGHT: LOGIN FORM */}
        <main className={`login-right-form ${role === 'admin' ? 'admin-mode' : ''}`}>
          <form
            className="form-card"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            {/* Government header strip */}
            <div className="gov-strip" aria-hidden="true">
              <div className="gov-brand">
                <img src={jaenlogo} alt="Jaen Seal" className="gov-seal" />
                <div className="gov-label">
                  <div className="gov-name">JAEN, NUEVA ECIJA</div>
                  <div className="gov-sub">MUNICIPAL DISASTER RISK REDUCTION &amp; MANAGEMENT OFFICE</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h3 className="card-title">Login</h3>
            <div className="card-divider" aria-hidden="true" />

          {/* Form */}
          <div className="form-container">
            {/* <div className="field">
              <label className="field-label">Role</label>
              <div className="select-wrap">
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="barangay">Barangay</option>
                  <option value="drrmo">DRRMO</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div> */}

            <div className="field">
              <label className="field-label">Email</label>
              <input
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

              <div className="field">
                <label className="field-label">Password</label>
                <input
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {role === 'admin' && !isLocked && (
                <p className="attempts-text">Attempts left: {MAX_ATTEMPTS - adminAttempts}</p>
              )}

              {isLocked && (
                <p className="locked-message">
                  🔒 {lockMessage} {Math.floor(countdown / 60)}:{('0' + (countdown % 60)).slice(-2)}
                </p>
              )}

              <button type="submit" disabled={isLocked}>
                {isLocked ? 'ACCOUNT LOCKED' : 'LOGIN'}
              </button>

              {/* Disclaimer */}
              <div className="gov-disclaimer">
                Authorized access only. Actions may be logged and audited under applicable laws and policies.
              </div>

              <div className="security-line" aria-hidden="true">
                <span>Secured</span><span className="dot">•</span>
                <span>Encrypted Connection</span><span className="dot">•</span>
                <span>Official Use Only</span>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}