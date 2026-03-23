// src/components/relief/ReliefRequestForm.js
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/ReliefRequestForm.css';
import DashboardShell from '../layout/DashboardShell';

export default function ReliefRequestForm() {
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/'); // redirect to login
    }
  }, [navigate]);

  // Use real ampersands so React renders correctly
  const categories = [
    { key: 'food',      label: 'Food & Water' },
    { key: 'hygiene',   label: 'Hygiene & Sanitation' },
    { key: 'clothing',  label: 'Clothes & Warmth' },
    { key: 'furniture', label: 'Furniture' },
    { key: 'medicine',  label: 'Medical & Safety' }
  ];

  const peopleRanges = ['10–20', '20–50', '50–100', '100–300'];
  const urgencyLevels = [
    { key: 'low',       label: 'Low' },
    { key: 'moderate',  label: 'Moderate' },
    { key: 'severe',    label: 'Severe' },
  ];

  const [reliefReq, setReliefReq] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [peopleRange, setPeopleRange] = useState('');
  const [urgency, setUrgency] = useState('');  // ✅ NEW

  async function fetchMyRequests() {
    try {
      const res = await fetch('http://localhost:8000/api/barangays/me', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to load requests');
      const data = await res.json();
      setReliefReq(data.reliefReq || {});
    } catch (err) {
      console.error(err);
    }
  }

  // 🔁 Real-time polling
  useEffect(() => {
    fetchMyRequests();
    const interval = setInterval(fetchMyRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  function isLocked(categoryKey) {
    return reliefReq[categoryKey]?.active;
  }

  async function confirmRequest() {
    if (!activeCategory || !peopleRange || !urgency) {
      alert('Please select a category, people range, and urgency.');
      return;
    }

    const key = activeCategory.key;

    if (isLocked(key)) {
      alert('You already have a pending request for this category.');
      return;
    }

    try {
      const body = {
        categoryKey: key,
        peopleRange,
        urgency,            // ✅ include urgency so AuditTrail can show it
        // If your backend expects "severity" instead of "urgency", replace line above with:
        // severity: urgency,
      };

      const res = await fetch('http://localhost:8000/api/barangays/relief-request', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to submit request');

      // Reset selections and refresh
      await fetchMyRequests();
      setActiveCategory(null);
      setPeopleRange('');
      setUrgency('');
      alert('Relief request submitted.');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  return (
    <DashboardShell>
      <div className="rrf-app">
        <div className="rrf-page">
          {/* Toolbar */}
          <div className="rrf-toolbar">
            <h2 className="rrf-title">Relief Request</h2>
            <div className="rrf-toolbar-right">
              <button className="rrf-btn" onClick={() => navigate('/barangay/dashboard')}>
                ← Back to Dashboard
              </button>
            </div>
          </div>

          {/* Content */}
          <main className="rrf-main">
            {/* Category grid */}
            <section className="rrf-section">
              <h3 className="rrf-section-title">Choose a Category</h3>
              <div className="rrf-grid">
                {categories.map((category) => {
                  const locked = isLocked(category.key);
                  return (
                    <div key={category.key} className="rrf-card-wrap">
                      {/* Replaces <DashboardCard/> with an accessible button "card" */}
                      <button
                        type="button"
                        className={`rrf-card ${locked ? 'rrf-locked' : ''}`}
                        onClick={() => !locked && setActiveCategory(category)}
                        disabled={locked}
                        aria-disabled={locked}
                        aria-label={`${category.label}${locked ? ' (Locked)' : ''}`}
                      >
                        <div className="rrf-card-title">{category.label}</div>
                        <div className="rrf-card-desc">
                          {locked ? 'Pending / In Progress' : 'Request relief'}
                        </div>
                      </button>

                      {locked && <div className="rrf-badge">Locked</div>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Selections */}
            {activeCategory && (
              <section className="rrf-section">
                <h3 className="rrf-section-title">{activeCategory.label}</h3>

                {/* People Range */}
                <div className="rrf-fieldset">
                  <div className="rrf-label">Affected People / Families</div>
                  <div className="rrf-radio-group">
                    {peopleRanges.map((range) => (
                      <label key={range} className="rrf-radio">
                        <input
                          type="radio"
                          name="peopleRange"
                          checked={peopleRange === range}
                          onChange={() => setPeopleRange(range)}
                        />
                        <span>{range} people</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Urgency (NEW) */}
                <div className="rrf-fieldset">
                  <div className="rrf-label">Urgency</div>
                  <div className="rrf-radio-group">
                    {urgencyLevels.map((u) => (
                      <label key={u.key} className="rrf-radio">
                        <input
                          type="radio"
                          name="urgency"
                          checked={urgency === u.key}
                          onChange={() => setUrgency(u.key)}
                        />
                        <span>{u.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Confirm */}
                <div className="rrf-actions">
                  <button
                    className="rrf-btn"
                    onClick={() => {
                      setActiveCategory(null);
                      setPeopleRange('');
                      setUrgency('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="rrf-btn rrf-primary"
                    disabled={!peopleRange || !urgency}
                    onClick={confirmRequest}
                  >
                    Confirm Request
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </DashboardShell>
  );
}
