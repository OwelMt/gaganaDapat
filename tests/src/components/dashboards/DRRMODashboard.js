import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import DashboardShell from '../layout/DashboardShell';

function DRRMODashboard() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/'); // redirect to login
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear(); // clear session
    navigate('/'); // redirect to login
  };

  return (
    <DashboardShell>
      <section>
        <h2>DRRMO Dashboard</h2>

        {/* Quick Actions (replaces the old DashboardCard components) */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: 12 }}>
          <button
            style={qaBtn}
            onClick={() => navigate('/drrmo/relief-lists')}
          >
            Relief Requests List
          </button>

          <button
            style={qaBtn}
            onClick={() => navigate('/evacuation')}
          >
            Evacuation Management
          </button>

          <button
            style={qaBtn}
            onClick={() => navigate('/admin')}
          >
            Incident Reports
          </button>

          <button
            style={qaBtn}
            onClick={() => navigate('/idk')}
          >
            Guidelines
          </button>

          <button
            style={qaBtn}
            onClick={() => navigate('/drrmo/audit-trail')}
          >
            Audit Trail
          </button>

          {/* If/when you add more:
          <button
            style={qaBtn}
            onClick={() => navigate('/drrmo/account-settings')}
          >
            Edit Accounts
          </button>
          */}
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={handleLogout} style={logoutBtn}>
            Logout
          </button>
        </div>
      </section>
    </DashboardShell>
  );
}

/** lightweight inline styles so we don't change your CSS files */
const qaBtn = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  background: '#fff',
  cursor: 'pointer',
  font: 'inherit'
};

const logoutBtn = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #d9534f',
  background: '#d9534f',
  color: '#fff',
  cursor: 'pointer',
  font: 'inherit'
};

export default DRRMODashboard;