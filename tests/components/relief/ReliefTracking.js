import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/ReliefTracking.css';

const categoryLabels = {
  food: 'Food & Water',
  hygiene: 'Hygiene & Sanitation',
  clothing: 'Clothes & Warmth',
  furniture: 'Furniture',
  medicine: 'Medical & Safety'
};

const PAGE_SIZE = 18;

/** Stable key used for sorting and hashing rows to avoid flicker */
function rowKey(r) {
  const b = r.barangayName ?? '';
  const k = r.categoryKey ?? '';
  const s = r.status ?? '';
  const t = r.requestedAt ?? '';
  return `${b}||${k}||${s}||${t}`;
}

/** Sort rows in a stable way so polling returns don't reshuffle the table */
function normalizeRows(list) {
  const arr = Array.isArray(list) ? [...list] : [];
  arr.sort((a, b) => {
    const ka = rowKey(a);
    const kb = rowKey(b);
    return ka.localeCompare(kb);
  });
  return arr;
}

/** Build a light hash string to compare datasets without deep diff */
function hashRows(list) {
  if (!Array.isArray(list) || list.length === 0) return '0';
  // Keep it cheap: join keys vs JSON.stringify whole objects
  return list.map(rowKey).join('│');
}

export default function ReliefTracking() {
  const navigate = useNavigate();
  const appRef = useRef(null);

  // auth guard
  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) navigate('/');
  }, [navigate]);

  const [viewerType, setViewerType] = useState('');
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // pagination
  const [page, setPage] = useState(1);

  // flicker guards
  const firstLoadRef = useRef(true);
  const rowsHashRef = useRef('');     // previous rows hash
  const histHashRef = useRef('');     // previous history hash
  const viewerRef = useRef('');       // previous viewer type

  /* 🔹 Fetch tracking data (silent on poll; spinner only first load) */
  const fetchRelief = useCallback(async () => {
    try {
      if (firstLoadRef.current) setLoading(true);

      const res = await fetch('http://localhost:8000/api/relief-tracking', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();

      let nextViewer = '';
      let nextRows = [];
      let nextHistory = [];

      // BARANGAY response
      if (data?.rows) {
        nextViewer = 'barangay';
        nextRows = normalizeRows(data.rows);
        nextHistory = normalizeRows(data.history || []);
      } else {
        // DRRMO response (array of rows)
        nextViewer = 'drrmo';
        nextRows = normalizeRows(data);
      }

      // Hash and compare to avoid re-render flicker
      const nextRowsHash = hashRows(nextRows);
      const nextHistHash = hashRows(nextHistory);

      if (viewerRef.current !== nextViewer) {
        viewerRef.current = nextViewer;
        setViewerType(nextViewer);
      }

      if (rowsHashRef.current !== nextRowsHash) {
        rowsHashRef.current = nextRowsHash;
        setRows(nextRows);
      }

      if (nextViewer === 'barangay' && histHashRef.current !== nextHistHash) {
        histHashRef.current = nextHistHash;
        setHistory(nextHistory);
      }
    } catch (err) {
      console.error(err);
      if (firstLoadRef.current) {
        setRows([]);
        setHistory([]);
      }
    } finally {
      if (firstLoadRef.current) {
        setLoading(false);
        firstLoadRef.current = false;
      }
    }
  }, []);

  /* 🔹 BARANGAY ACTIONS */
  const handleBarangayAction = async (categoryKey, action) => {
    try {
      const res = await fetch(
        'http://localhost:8000/api/barangays/relief-request-action',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ categoryKey, action })
        }
      );
      if (!res.ok) throw new Error('Action failed');
      await fetchRelief();
    } catch (err) {
      alert(err.message);
    }
  };

  /* 🔹 DRRMO CANCEL APPROVAL */
  const handleCancelApproval = async (barangayId, categoryKey) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/drrmo/relief-request-status/${barangayId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ categoryKey, action: 'cancel' })
        }
      );
      if (!res.ok) throw new Error('Cancel failed');
      fetchRelief();
    } catch (err) {
      alert(err.message);
    }
  };

  // polling
  useEffect(() => {
    fetchRelief();
    const i = setInterval(fetchRelief, 5000);
    return () => clearInterval(i);
  }, [fetchRelief]);

  // fit main region to viewport by measuring header height (debounced)
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const headerEl = document.querySelector('.app-header');
        const h = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
        if (appRef.current) {
          const prev = appRef.current.style.getPropertyValue('--rt-header-h');
          const next = `${h}px`;
          if (prev !== next) appRef.current.style.setProperty('--rt-header-h', next);
        }
      });
    };
    sync();
    window.addEventListener('resize', sync);
    const ro = new ResizeObserver(sync);
    const headerEl = document.querySelector('.app-header');
    if (headerEl) ro.observe(headerEl);
    return () => {
      window.removeEventListener('resize', sync);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const fmtDate = (val) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleString(); } catch { return String(val); }
  };

  // pagination model
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // clamp page only when needed (avoid loops)
  useEffect(() => {
    setPage((p) => {
      const clamped = Math.min(Math.max(1, p), totalPages);
      return clamped === p ? p : clamped;
    });
  }, [totalPages]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, total);
  const pageRows = useMemo(
    () => rows.slice(pageStart, pageEnd),
    [rows, pageStart, pageEnd]
  );

  const goFirst = () => setPage(1);
  const goPrev  = () => setPage((p) => Math.max(1, p - 1));
  const goNext  = () => setPage((p) => Math.min(totalPages, p + 1));
  const goLast  = () => setPage(totalPages);

  return (
    <div className="rt-app" ref={appRef}>


      {/* Sticky toolbar */}
      <div className="rt-toolbar">
        <div className="rt-toolbar-left">
          <h2 className="rt-title">Relief Tracking</h2>
          {!loading && (
            <span className="rt-meta">
              {total} record{total === 1 ? '' : 's'} • Page {page} of {totalPages}
            </span>
          )}
        </div>
        <div className="rt-toolbar-right">
          <button className="rt-btn" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>

      {/* Main region (fills viewport; panel owns the height) */}
      <main className="rt-main">
        <section className="rt-panel">
          {/* Table region = scrollable table + pinned pagination */}
          <div className="rt-table-region">
            <div className="rt-table-wrap">
              {loading ? (
                <div className="rt-state">
                  <div className="rt-emoji">⏳</div>
                  <div className="rt-state-text">
                    <strong>Loading relief tracking…</strong>
                    <span className="rt-muted">Please wait</span>
                  </div>
                </div>
              ) : total === 0 ? (
                <div className="rt-state">
                  <div className="rt-emoji">📦</div>
                  <div className="rt-state-text">
                    <strong>No active requests</strong>
                    <span className="rt-muted">New requests will appear here.</span>
                  </div>
                </div>
              ) : (
                <table className="rt-table">
                  <thead>
                    <tr>
                      <th>Barangay</th>
                      <th>Category</th>
                      <th>People Range</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={`${r.barangayId}-${r.categoryKey}`}>
                        <td title={r.barangayName ?? ''}>{r.barangayName}</td>
                        <td title={categoryLabels[r.categoryKey] ?? ''}>
                          {categoryLabels[r.categoryKey] || r.categoryKey}
                        </td>
                        <td title={r.peopleRange ?? ''}>{r.peopleRange}</td>
                        <td>
                          <span
                            className={
                              'rt-pill ' +
                              (r.status === 'requested'
                                ? 'rt-pill-gray'
                                : r.status === 'approved'
                                ? 'rt-pill-green'
                                : r.status === 'received'
                                ? 'rt-pill-blue'
                                : 'rt-pill-amber')
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>{fmtDate(r.requestedAt)}</td>
                        <td>
                          {/* BARANGAY */}
                          {viewerType === 'barangay' && r.status === 'requested' && (
                            <button
                              className="rt-action rt-danger"
                              onClick={() => handleBarangayAction(r.categoryKey, 'cancel')}
                            >
                              Cancel Request
                            </button>
                          )}
                          {viewerType === 'barangay' && r.status === 'approved' && (
                            <button
                              className="rt-action rt-primary"
                              onClick={() => handleBarangayAction(r.categoryKey, 'received')}
                            >
                              Relief Goods Received
                            </button>
                          )}

                          {/* DRRMO */}
                          {viewerType === 'drrmo' && r.status === 'approved' && (
                            <button
                              className="rt-action rt-warning"
                              onClick={() => handleCancelApproval(r.barangayId, r.categoryKey)}
                            >
                              Cancel Approval
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination pinned to the bottom of the region */}
            <div className="rt-pagination">
              <div className="rt-range">
                {total === 0 ? '0–0 of 0' : `${pageStart + 1}–${pageEnd} of ${total}`}
              </div>
              <div className="rt-pages">
                <button className="rt-page-btn" onClick={goFirst} disabled={page === 1}>« First</button>
                <button className="rt-page-btn" onClick={goPrev}  disabled={page === 1}>‹ Prev</button>
                <span className="rt-page-indicator">Page {page} / {totalPages}</span>
                <button className="rt-page-btn" onClick={goNext}  disabled={page === totalPages}>Next ›</button>
                <button className="rt-page-btn" onClick={goLast}  disabled={page === totalPages}>Last »</button>
              </div>
            </div>
          </div>

          {/* Barangay History */}
          {viewerType === 'barangay' && history.length > 0 && (
            <section className="rt-history">
              <h3 className="rt-h-title">History</h3>
              <div className="rt-h-wrap">
                <table className="rt-h-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>People Range</th>
                      <th>Status</th>
                      <th>Action By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={`${h.category}-${h.actionAt}-${i}`}>
                        <td>{categoryLabels[h.category] || h.category}</td>
                        <td>{h.peopleRange}</td>
                        <td>
                          <span
                            className={
                              'rt-pill ' +
                              (h.status === 'requested'
                                ? 'rt-pill-gray'
                                : h.status === 'approved'
                                ? 'rt-pill-green'
                                : h.status === 'received'
                                ? 'rt-pill-blue'
                                : 'rt-pill-amber')
                            }
                          >
                            {h.status}
                          </span>
                        </td>
                        <td>{h.actionBy}</td>
                        <td>{fmtDate(h.actionAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}