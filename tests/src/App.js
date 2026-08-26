import './App.css';
import './components/css/ThemeTokens.css';
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext"; // ← add this
import Login from "./components/auth/Login";
import Dashboard from "./components/entry/Dashboard";
import SplashScreen from './components/splashscreen/SplashScreen';
import {
  getHomePathForRole,
  normalizeRole,
} from "./components/auth/roleAccessUtils";
import './components/css/OverlayFixes.css';

const IncidentReport = lazy(() => import("./components/IncidentReport"));
const AuditTrails = lazy(() => import("./components/AuditTrails"));
const EManagement = lazy(() => import("./components/EManagement"));
const Register = lazy(() => import("./components/auth/Register"));
const EditAccount = lazy(() => import("./components/auth/EditAccount"));
const ArchivedAccounts = lazy(() => import("./components/auth/ArchivedAccounts"));
const BarangayDashboard = lazy(() => import("./components/dashboards/BarangayDashboard"));
const DRRMODashboard = lazy(() => import("./components/dashboards/DRRMODashboard"));
const AdminDashboard = lazy(() => import("./components/dashboards/AdminDashboard"));
const AccountantDashboard = lazy(() => import("./components/dashboards/AccountantDashboard"));
const ReliefRequestForm = lazy(() => import("./components/relief/ReliefRequestForm"));
const ReliefRequestsList = lazy(() => import("./components/relief/ReliefRequestsList"));
const ReliefTracking = lazy(() => import("./components/relief/ReliefTracking"));
const AuditTrail = lazy(() => import("./components/relief/AuditTrail"));
const HomeGuidelines = lazy(() => import("./components/guidelines/HomeGuidelines"));
const UpdateGuideline = lazy(() => import("./components/guidelines/UpdateGuidelines"));
const TimeInOut = lazy(() => import("./components/admin/timeInOut"));
const AdminLogs = lazy(() => import("./components/admin/AdminLogs"));
const EvacuationMap = lazy(() => import("./components/map/EvacuationMap"));
const AdminAccounts = lazy(() => import("./components/group/AdminAccounts"));
const AdminAnalytics = lazy(() => import("./components/group/AdminAnalytics"));
const Notification = lazy(() => import("./components/Notification"));
const Announcement = lazy(() => import("./components/Announcement"));
const UnityDigitalTwin = lazy(() => import("./components/DigitalTwin/UnityDigitalTwin"));
const YoloWaterMonitor = lazy(() => import("./components/YoloWaterMonitor"));
const UnityDigitalTwin1 = lazy(() => import("./components/DigitalTwin/UnityDigitalTwin1"));
const FloodVirtualTwin1 = lazy(() => import("./components/FloodVirtualTwin1"));
const Inventory = lazy(() => import("./components/Donations/Inventory"));
const InventoryAdd = lazy(() => import("./components/Donations/InventoryAdd"));
const DonationValidationQueue = lazy(() => import("./components/Donations/DonationValidationQueue"));

const BASE_URL = process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

const ADMIN_ONLY = ["admin"];
const ACCOUNTANT_ONLY = ["accountant"];
const BARANGAY_ONLY = ["barangay"];
const DRRMO_ONLY = ["drrmo"];
const ADMIN_DRRMO = ["admin", "drrmo"];
const ALL_AUTH = ["admin", "drrmo", "barangay", "accountant"];

function homeForRole(role) {
  return getHomePathForRole(role);
}

function SessionGate({ allowedRoles = ALL_AUTH, children }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const validateSession = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/debug-session`, {
          credentials: "include"
        });

        if (!active) return;

        if (!res.ok) {
          setUser(null);
          navigate("/Login", { replace: true });
          return;
        }

        const data = await res.json();
        const role = normalizeRole(data?.role || data?.session?.role);
        const username = data?.username || data?.session?.username || "";
        const userId = data?.userId || data?.session?.userId || "";

        if (!role || !userId) {
          setUser(null);
          navigate("/Login", { replace: true });
          return;
        }

        setUser({
          role,
          username,
          userId,
          themePreference: data?.themePreference || "dark"
        });
        localStorage.setItem("role", role);
        localStorage.setItem("username", username);
        localStorage.setItem("userId", userId);

        if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
          navigate(homeForRole(role), { replace: true });
          return;
        }

        setReady(true);
      } catch (err) {
        if (!active) return;
        console.error(err);
        setUser(null);
        navigate("/Login", { replace: true });
      }
    };

    validateSession();

    return () => {
      active = false;
    };
  }, [allowedRoles, navigate, setUser]);

  if (!ready) {
    return <SplashScreen />;
  }

  return children;
}

function sessionElement(element, allowedRoles) {
  return <SessionGate allowedRoles={allowedRoles}>{element}</SessionGate>;
}

function LoginGate({ children }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const validateSession = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/debug-session`, {
          credentials: "include"
        });

        if (!active) return;

        if (!res.ok) {
          setReady(true);
          return;
        }

        const data = await res.json();
        const role = normalizeRole(data?.role || data?.session?.role);
        const username = data?.username || data?.session?.username || "";
        const userId = data?.userId || data?.session?.userId || "";

        if (!role || !userId) {
          setReady(true);
          return;
        }

        setUser({
          role,
          username,
          userId,
          themePreference: data?.themePreference || "dark"
        });
        localStorage.setItem("role", role);
        localStorage.setItem("username", username);
        localStorage.setItem("userId", userId);
        navigate(homeForRole(role), { replace: true });
      } catch (err) {
        if (!active) return;
        console.error(err);
        setReady(true);
      }
    };

    validateSession();

    return () => {
      active = false;
    };
  }, [navigate, setUser]);

  if (!ready) {
    return <SplashScreen />;
  }

  return children;
}

const ROUTES = [
  { path: "/", element: <Dashboard /> },
  { path: "/Login", element: <Login /> },
  { path: "/login", element: <Navigate to="/Login" replace /> },
  { path: "/auditTrails", element: <AuditTrails />, roles: ADMIN_ONLY },
  { path: "/evacuation", element: <EManagement />, roles: ALL_AUTH },
  { path: "/drrmo/evacuation-centers", element: <EManagement />, roles: ADMIN_DRRMO },
  { path: "/barangay/dashboard", element: <BarangayDashboard />, roles: BARANGAY_ONLY },
  { path: "/barangay/relief-request", element: <ReliefRequestForm />, roles: BARANGAY_ONLY },
  { path: "/barangay/relief-status", element: <ReliefTracking />, roles: BARANGAY_ONLY },
  { path: "/barangay/evacuation-centers", element: <EManagement />, roles: BARANGAY_ONLY },
  { path: "/barangay/notifications", element: <Notification />, roles: BARANGAY_ONLY },
  { path: "/drrmo/dashboard", element: <DRRMODashboard />, roles: DRRMO_ONLY },
  { path: "/drrmo/relief-lists", element: <ReliefRequestsList />, roles: DRRMO_ONLY },
  { path: "/drrmo/relief-status", element: <ReliefTracking />, roles: ADMIN_DRRMO },
  { path: "/drrmo/audit-trail", element: <AuditTrail />, roles: ADMIN_DRRMO },
  { path: "/drrmo/guidelines", element: <HomeGuidelines />, roles: ADMIN_DRRMO },
  { path: "/drrmo/announcements", element: <Announcement />, roles: ADMIN_DRRMO },
  { path: "/drrmo/inventory", element: <Inventory />, roles: ADMIN_DRRMO },
  { path: "/drrmo/inventory/add", element: <InventoryAdd />, roles: ADMIN_DRRMO },
  { path: "/drrmo/incident-report", element: <IncidentReport />, roles: ADMIN_DRRMO },
  { path: "/drrmo/analytics", element: <AdminAnalytics />, roles: ADMIN_DRRMO },
  { path: "/drrmo/notifications", element: <Notification />, roles: ADMIN_DRRMO },
  { path: "/admin/dashboard", element: <AdminDashboard />, roles: ADMIN_ONLY },
  { path: "/admin/relief-lists", element: <ReliefRequestsList />, roles: ADMIN_ONLY },
  { path: "/admin/register", element: <Register />, roles: ADMIN_ONLY },
  { path: "/admin/audit-trail", element: <AuditTrails />, roles: ADMIN_ONLY },
  { path: "/admin/edit-accounts", element: <EditAccount />, roles: ADMIN_ONLY },
  { path: "/admin/archived-accounts", element: <ArchivedAccounts />, roles: ADMIN_ONLY },
  { path: "/admin/inventory", element: <Inventory />, roles: ADMIN_ONLY },
  { path: "/admin/inventory/add", element: <InventoryAdd />, roles: ADMIN_ONLY },
  { path: "/admin/donations/queue", element: <DonationValidationQueue />, roles: ADMIN_ONLY },
  { path: "/admin/time-in-time-out", element: <TimeInOut />, roles: ADMIN_ONLY },
  { path: "/admin/logs", element: <AdminLogs />, roles: ADMIN_ONLY },
  { path: "/admin/accounts", element: <AdminAccounts />, roles: ADMIN_ONLY },
  { path: "/admin/analytics", element: <AdminAnalytics />, roles: ADMIN_ONLY },
  { path: "/admin/announcements", element: <Announcement />, roles: ADMIN_ONLY },
  { path: "/admin/guidelines", element: <HomeGuidelines />, roles: ADMIN_ONLY },
  { path: "/admin/notifications", element: <Notification />, roles: ADMIN_ONLY },
  { path: "/accountant/dashboard", element: <AccountantDashboard />, roles: ACCOUNTANT_ONLY },
  { path: "/accountant/analytics", element: <AdminAnalytics />, roles: ACCOUNTANT_ONLY },
  { path: "/accountant/inventory", element: <Inventory />, roles: ACCOUNTANT_ONLY },
  { path: "/accountant/inventory/add", element: <InventoryAdd />, roles: ACCOUNTANT_ONLY },
  { path: "/accountant/donations/queue", element: <DonationValidationQueue />, roles: ACCOUNTANT_ONLY },
  { path: "/accountant/relief-lists", element: <ReliefRequestsList />, roles: ACCOUNTANT_ONLY },
  { path: "/accountant/notifications", element: <Notification />, roles: ACCOUNTANT_ONLY },
  { path: "/drrmo/digital-twin", element: <UnityDigitalTwin />, roles: ADMIN_DRRMO },
  { path: "/digital-twin-mobile", element: <UnityDigitalTwin1 /> },
  { path: "/virtual-twin-mobile", element: <FloodVirtualTwin1 /> },
  { path: "/flood-virtual-twin-mobile", element: <FloodVirtualTwin1 /> },
  { path: "/idk", element: <HomeGuidelines />, roles: ALL_AUTH },
  { path: "/update/:id", element: <UpdateGuideline />, roles: ALL_AUTH },
  { path: "/map", element: <EvacuationMap />, roles: ALL_AUTH },
  { path: "/yolo-water-monitor", element: <YoloWaterMonitor /> }
];


function App() {
  const renderRoute = (route) => {
    if (route.path === "/Login") {
      return <LoginGate>{route.element}</LoginGate>;
    }

    if (!route.roles) {
      return route.element;
    }

    return sessionElement(route.element, route.roles);
  };

  return (
    <AuthProvider>
      <ThemeProvider>{/* ← Theme for dark/light + icon switching */}
        <Router>
          <Routes>
            {ROUTES.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <Suspense fallback={<SplashScreen />}>
                    {renderRoute(route)}
                  </Suspense>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/Login" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
