import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, setCsrfToken } from "./lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfTokenState] = useState("");
  const [error, setError] = useState("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Restore the session on mount (e.g. after a page refresh) using the
  // existing httpOnly cookie against GET /admin/me — a 401 just means the
  // user isn't logged in yet, not an error worth surfacing.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.getMe();
        if (!active) return;
        setUser(data?.user || null);
        const token = data?.csrf_token || data?.csrfToken || "";
        setCsrfTokenState(token);
        setCsrfToken(token);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) {
          // Non-401 failures (network/server errors) are silently ignored here too —
          // the user will simply see the login page and can retry.
        }
      } finally {
        if (active) setIsRestoringSession(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function login({ username, password }) {
    setError("");
    const data = await api.login({ username, password });
    const nextUser = data?.user || null;
    const token = data?.csrf_token || data?.csrfToken || "";

    setUser(nextUser);
    setCsrfTokenState(token);
    setCsrfToken(token);
    return nextUser;
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setCsrfTokenState("");
      setCsrfToken("");
    }
  }

  const value = useMemo(
    () => ({
      user,
      role: user?.role || "",
      csrfToken,
      error,
      setError,
      login,
      logout,
      isAuthenticated: Boolean(user),
      isRestoringSession,
    }),
    [user, csrfToken, error, isRestoringSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
