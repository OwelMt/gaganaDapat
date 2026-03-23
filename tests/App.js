import './App.css';
import './components/css/sidebar.css'; // ← add this
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext"; // ← add this
import 'leaflet/dist/leaflet.css';

import Admin from './components/Admin';
import AuditTrails from './components/AuditTrails';
import EManagement from './components/EManagement';
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import Dashboard from "./components/entry/Dashboard";
import EditAccount from './components/auth/EditAccount';
import AccountSettings from './components/auth/AccountSettings';
import ArchivedAccounts from './components/auth/ArchivedAccounts';
import BarangayDashboard from "./components/dashboards/BarangayDashboard";
import DRRMODashboard from "./components/dashboards/DRRMODashboard";
import AdminDashboard from "./components/dashboards/AdminDashboard";
import ReliefRequestForm from "./components/relief/ReliefRequestForm";
import ReliefRequestsList from "./components/relief/ReliefRequestsList";
import ReliefTracking from "./components/relief/ReliefTracking";
import AuditTrail from './components/relief/AuditTrail';
import HomeGuidelines from './components/guidelines/HomeGuidelines';
import UpdateGuideline from './components/guidelines/UpdateGuidelines';
import TimeInOut from './components/timeInOut';
import AdminLogs from './components/AdminLogs';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>{/* ← Theme for dark/light + icon switching */}
        <Router>
          <Routes>

            <Route path="/admin" element={<Admin />} />
            <Route path="/auditTrails" element={<AuditTrails/>} />

            {/* Evacuation Center Management */}
            {/* Keep existing generic route for backward compatibility */}
            <Route path="/evacuation" element={<EManagement/>} />
            {/* Add DRRMO-scoped route so DRRMO sidebar points here safely */}
            <Route path="/drrmo/evacuation-centers" element={<EManagement />} />

            {/* Public */}
            <Route path="/" element={<Dashboard/>}/>
            <Route path="/Login" element={<Login />} />

            {/* Barangay */}
            <Route path="/barangay/dashboard" element={<BarangayDashboard />} />
            <Route path="/barangay/relief-request" element={<ReliefRequestForm />} />
            <Route path="/barangay/relief-status" element={<ReliefTracking />} />
            <Route path="/barangay/account-settings" element={<AccountSettings />} />

            {/* DRRMO */}
            <Route path="/drrmo/dashboard" element={<DRRMODashboard />} />
            <Route path="/drrmo/relief-lists" element={<ReliefRequestsList />} />
            <Route path="/drrmo/relief-status" element={<ReliefTracking />} />
            <Route path="/drrmo/audit-trail" element={<AuditTrail />} />
            <Route path="/drrmo/account-settings" element={<AccountSettings />} />

            {/* Admin */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/register" element={<Register />} />
            <Route path="/admin/audit-trail" element={<AuditTrail />} />
            <Route path="/admin/edit-accounts" element={<EditAccount/>} />
            <Route path="/admin/archived-accounts" element={<ArchivedAccounts />} />
            <Route path="/admin/time-in-time-out" element={<TimeInOut />} />
            <Route path="/admin/logs" element={<AdminLogs />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />

            <Route path="/idk" element={<HomeGuidelines/>}/>
            <Route path="/update/:id" element={<UpdateGuideline/>}/>
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;