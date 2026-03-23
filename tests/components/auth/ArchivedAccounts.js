import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../layout/DashboardShell';
import '../css/ArchivedAccounts.css';

export default function ArchivedAccounts() {
  const navigate = useNavigate();

  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);

  // measure app header height only if you still render a top header elsewhere
  const appRef = useRef(null);

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) navigate('/');
  }, [navigate]);

  useEffect(() => {
    fetchArchivedAccounts();
  }, []);

  useEffect(() => {
    const syncHeaderHeight = () => {
      const headerEl = document.querySelector('.app-header');
      const h = headerEl ? headerEl.getBoundingClientRect().height : 0;
      if (appRef.current) {
        appRef.current.style.setProperty('--app-header-h', `${Math.round(h)}px`);
      }
    };
    syncHeaderHeight();

    window.addEventListener('resize', syncHeaderHeight);
    const ro = new ResizeObserver(syncHeaderHeight);
    const headerEl = document.querySelector('.app-header');
    if (headerEl) ro.observe(headerEl);
    return () => {
      window.removeEventListener('resize', syncHeaderHeight);
      ro.disconnect();
    };
  }, []);

  const fetchArchivedAccounts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/archived', {
        credentials: 'include'
      });
      const data = await res.json();
      setArchived(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch archived accounts');
    } finally {
      setLoading(false);
    }
  };

  const restoreAccount = async (id) => {
    if (!window.confirm('Restore this account?')) return;

    try {
      const res = await fetch(`http://localhost:8000/api/auth/restore/${id}`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (res.ok) {
        alert('Account restored successfully');
        setArchived(prev => prev.filter(a => a._id !== id));
      } else {
        alert('Failed to restore account');
      }
    } catch (err) {
      console.error(err);
      alert('Error restoring account');
    }
  };

  return (
    <DashboardShell>
      {/* NOTE: we add tio-no-toolbar to switch height calc to “no toolbar” mode */}
      <div className="tio-app tio-no-toolbar" ref={appRef}>
        {/* ❌ Toolbar removed — we show a slim count bar inside main instead */}

        <main className="tio-main">
          {/* thin count bar (like Edit view’s countbar) */}
          <div className="tio-headbar">
            <span>
              {loading ? 'Loading…' : `${archived.length} record${archived.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="tio-table-region">
            <div className="tio-table-wrap">
              <table className="tio-table">
                <thead>
                  <tr>
                    <th style={{ width: '18ch' }}>Username</th>
                    <th style={{ width: '26ch' }}>Email</th>
                    <th style={{ width: '14ch' }}>Phone</th>
                    <th>Address</th>
                    <th style={{ width: '12ch' }}>Role</th>
                    <th style={{ width: '12ch' }}></th>
                  </tr>
                </thead>

                <tbody>
                  {/* Probe row for column sizing */}
                  <tr className="tio-probe-row">
                    <td>username_example</td>
                    <td>name@example.com</td>
                    <td>09123456789</td>
                    <td>Barangay San Nicolas, Jaen</td>
                    <td>DRRMO</td>
                    <td></td>
                  </tr>

                  {loading && (
                    <tr className="tio-empty-row">
                      <td colSpan={6}>
                        <div className="tio-empty-inline">
                          <span className="tio-empty-emoji">⏳</span>
                          <div className="tio-empty-text">
                            <strong>Loading archived accounts…</strong>
                            <span className="tio-muted">Please wait</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && archived.length === 0 && (
                    <tr className="tio-empty-row">
                      <td colSpan={6}>
                        <div className="tio-empty-inline">
                          <span className="tio-empty-emoji">📂</span>
                          <div className="tio-empty-text">
                            <strong>No Archived Accounts</strong>
                            <span className="tio-muted">
                              Accounts that are archived will appear here.
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && archived.length > 0 && archived.map(acc => (
                    <tr key={acc._id}>
                      <td title={acc.username ?? ''}>{acc.username}</td>
                      <td
                        title={acc.email ?? ''}
                        style={{ color: '#0b4dbb', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {acc.email}
                      </td>
                      <td title={acc.phoneNumber ?? ''}>{acc.phoneNumber}</td>
                      <td title={acc.address ?? ''}>{acc.address}</td>
                      <td title={acc.role ?? ''}>{acc.role}</td>
                      <td>
                        <button
                          className="tio-btn"
                          style={{
                            background: '#2e7d32',
                            color: '#fff',
                            borderColor: '#2e7d32',
                            fontWeight: 800
                          }}
                          onClick={() => restoreAccount(acc._id)}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination row */}
            <div className="tio-pagination">
              <button className="tio-btn" disabled>Prev</button>
              <span className="tio-page">Page 1</span>
              <button className="tio-btn" disabled>Next</button>
            </div>
          </div>
        </main>
      </div>
    </DashboardShell>
  );
}
