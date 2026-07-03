import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { can } from "./lib/permissions.js";
import LoginPage from "./pages/LoginPage.jsx";
import NewJobPage from "./pages/NewJobPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import UsagePage from "./pages/UsagePage.jsx";

function AppShell({ children }) {
  const { user, role, logout } = useAuth();
  const canViewUsage = can(role, "content.video.admin");

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="page">
      <header className="app-hero">
        <div className="app-hero-top">
          <div>
            <p className="eyebrow">SC AI Video Content Studio</p>
            <h1>สร้างวิดีโอสินค้าด้วย AI</h1>
          </div>
          <div className="session-info">
            <span className="role-badge">{role || "ไม่ทราบสิทธิ์"}</span>
            <span className="subtle">{user?.id || ""}</span>
            <button type="button" className="ghost" onClick={handleLogout}>
              ออกจากระบบ
            </button>
          </div>
        </div>
        <nav className="app-nav">
          <NavLink to="/new" className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
            New Job
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
            History
          </NavLink>
          {canViewUsage ? (
            <NavLink to="/usage" className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
              Usage & Cost
            </NavLink>
          ) : null}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isRestoringSession } = useAuth();

  if (isRestoringSession) {
    return (
      <div className="page">
        <p className="subtle" style={{ padding: "2rem" }}>
          กำลังโหลด...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/new" replace />} />
        <Route path="/new" element={<NewJobPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/usage" element={<UsagePage />} />
        <Route path="*" element={<Navigate to="/new" replace />} />
      </Routes>
    </AppShell>
  );
}
