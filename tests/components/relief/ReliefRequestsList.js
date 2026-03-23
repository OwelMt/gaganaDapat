import { useEffect, useState, useCallback } from 'react'; 
import { useNavigate } from 'react-router-dom';

export default function ReliefRequestsList() {
  const navigate = useNavigate();
  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/'); // redirect to login
    }
  }, [navigate]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // fetch pending requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/api/drrmo/pending-requests', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      setRows(data);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Approve request
  const handleAccept = async (barangayId, categoryKey) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/drrmo/relief-request-status/${barangayId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ categoryKey, action: 'accept' })
        }
      );
      if (!res.ok) throw new Error('Failed to approve request');
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Cancel request
  const handleCancel = async (barangayId, categoryKey) => {
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
      if (!res.ok) throw new Error('Failed to cancel request');
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  if (loading) return <p>Loading pending requests...</p>;

  return (
    <div>
      <h2>Pending Relief Requests</h2>
      {rows.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              <th style={th}>Barangay</th>
              <th style={th}>Category</th>
              <th style={th}>People Range</th>
              <th style={th}>Requested At</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.barangayId}-${r.categoryKey}`}>
                <td style={td}>{r.barangayName}</td>
                <td style={td}>{r.category}</td>
                <td style={td}>{r.peopleRange}</td>
                <td style={td}>{r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '-'}</td>
                <td style={td}>
                  <button onClick={() => handleAccept(r.barangayId, r.categoryKey)}>Approve</button>
                  <button style={{ marginLeft: 8 }} onClick={() => handleCancel(r.barangayId, r.categoryKey)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button style={{ marginTop: 20 }} onClick={() => navigate(-1)}>Go Back to Dashboard</button>
    </div>
  );
}

const th = { borderBottom: '2px solid #ccc', textAlign: 'left', padding: 8 };
const td = { borderBottom: '1px solid #eee', padding: 8 };
