import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/ArchivedAccounts.css';

export default function ArchivedAccounts() {
  const navigate = useNavigate();
  const BASE_URL =
    process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 8;

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) navigate('/');
  }, [navigate]);

  useEffect(() => {
    fetchArchivedAccounts();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const fetchArchivedAccounts = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${BASE_URL}/api/auth/archived`, {
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
      setRestoringId(id);

      const res = await fetch(`${BASE_URL}/api/auth/restore/${id}`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (res.ok) {
        alert('Account restored successfully');
        setArchived((prev) => prev.filter((a) => a._id !== id));
      } else {
        alert('Failed to restore account');
      }
    } catch (err) {
      console.error(err);
      alert('Error restoring account');
    } finally {
      setRestoringId(null);
    }
  };

  const filteredArchived = useMemo(() => {
    const term = search.trim().toLowerCase();

    return archived.filter((acc) => {
      const matchesSearch =
        !term ||
        String(acc.username || '').toLowerCase().includes(term) ||
        String(acc.email || '').toLowerCase().includes(term) ||
        String(acc.phoneNumber || '').toLowerCase().includes(term) ||
        String(acc.address || '').toLowerCase().includes(term) ||
        String(acc.role || '').toLowerCase().includes(term);

      const matchesRole =
        !roleFilter || String(acc.role || '').toLowerCase() === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [archived, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredArchived.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paginatedArchived = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredArchived.slice(start, start + PAGE_SIZE);
  }, [filteredArchived, safePage]);

  const roleCounts = useMemo(() => {
    return archived.reduce(
      (acc, item) => {
        const role = String(item.role || '').toLowerCase();
        if (role === 'barangay') acc.barangay += 1;
        if (role === 'drrmo') acc.drrmo += 1;
        return acc;
      },
      { barangay: 0, drrmo: 0 }
    );
  }, [archived]);

  const formatRole = (role) => {
    if (!role) return '-';
    if (String(role).toLowerCase() === 'drrmo') return 'DRRMO';
    if (String(role).toLowerCase() === 'barangay') return 'Barangay';
    return role;
  };

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  const hasActiveFilters = Boolean(search.trim() || roleFilter);

  const statItems = [
    {
      label: 'Archived',
      value: loading ? '—' : archived.length,
      tone: 'green'
    },
    {
      label: 'Barangay',
      value: loading ? '—' : roleCounts.barangay,
      tone: 'emerald'
    },
    {
      label: 'DRRMO',
      value: loading ? '—' : roleCounts.drrmo,
      tone: 'blue'
    }
  ];

  return (
    <div className="archived-page">
      <div className="archived-shell">
        <div className="archived-hero">
          <div className="archived-hero-copy">
            <div className="archived-kicker-row">
              <span className="archived-kicker">Administration Module</span>
              {hasActiveFilters && (
                <span className="archived-mini-badge">Filtered View</span>
              )}
            </div>

            <h1 className="archived-title">Archived Accounts</h1>

            <div className="archived-stats">
              {statItems.map((item) => (
                <div
                  key={item.label}
                  className={`archived-stat-card archived-stat-card--${item.tone}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="archived-panel">
          <div className="archived-toolbar">
            <div className="archived-search-wrap">
              <input
                className="archived-search"
                type="text"
                placeholder="Search username, email, phone, address, or role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="archived-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="barangay">Barangay</option>
              <option value="drrmo">DRRMO</option>
            </select>
          </div>

          <div className="archived-toolbar-meta">
            <span className="archived-results-text">
              {loading
                ? 'Loading records...'
                : `${filteredArchived.length} result${filteredArchived.length === 1 ? '' : 's'}`}
            </span>

            {hasActiveFilters && !loading && (
              <button
                type="button"
                className="archived-clear-btn"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="archived-table-wrap">
            <table className="archived-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="archived-empty-cell">
                      <div className="archived-empty-state">
                        <div className="archived-empty-inner">
                          <strong>Loading archived accounts...</strong>
                          <span>Please wait while records are fetched.</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : archived.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="archived-empty-cell">
                      <div className="archived-empty-state">
                        <div className="archived-empty-inner">
                          <strong>No archived accounts</strong>
                          <span>Archived users will appear here.</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : paginatedArchived.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="archived-empty-cell">
                      <div className="archived-empty-state">
                        <div className="archived-empty-inner">
                          <strong>No matching results</strong>
                          <span>Try a different search or role filter.</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedArchived.map((acc) => (
                    <tr key={acc._id}>
                      <td title={acc.username || ''}>{acc.username || '-'}</td>
                      <td className="archived-email" title={acc.email || ''}>
                        {acc.email || '-'}
                      </td>
                      <td title={acc.phoneNumber || ''}>{acc.phoneNumber || '-'}</td>
                      <td title={acc.address || ''}>{acc.address || '-'}</td>
                      <td>
                        <span
                          className={`archived-role-pill ${
                            String(acc.role || '').toLowerCase() === 'barangay'
                              ? 'barangay'
                              : 'drrmo'
                          }`}
                        >
                          {formatRole(acc.role)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="archived-restore-btn"
                          onClick={() => restoreAccount(acc._id)}
                          disabled={restoringId === acc._id}
                        >
                          {restoringId === acc._id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="archived-pagination">
            <button
              className="archived-page-btn"
              disabled={!canPrev}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              ← Prev
            </button>

            <span className="archived-page-label">
              Page {safePage} of {totalPages}
            </span>

            <button
              className="archived-page-btn"
              disabled={!canNext}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}