import { createContext, useContext, useMemo, useState } from "react";
import { api, setCsrfToken } from "./lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfTokenState] = useState("");
  const [error, setError] = useState("");

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
    }),
    [user, csrfToken, error],
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
