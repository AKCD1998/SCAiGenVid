import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";

export default function LoginPage() {
  const { login, error: sessionError, setError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setError("");

    try {
      await login({ username, password });
      setPassword("");
    } catch (loginError) {
      setFormError(loginError.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <section className="hero login-hero">
        <div>
          <p className="eyebrow">SC AI Video Content Studio</p>
          <h1>เข้าสู่ระบบ</h1>
          <p className="subtle">
            แอปนี้ใช้บัญชีเดียวกับระบบ SC อื่น ๆ (cookie session) — ไม่มีข้อมูลลับใด ๆ ถูกเก็บไว้ในเบราว์เซอร์
          </p>
        </div>

        <form className="hero-card login-card" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="ชื่อผู้ใช้"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="รหัสผ่าน"
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          {formError || sessionError ? (
            <p className="message error-text">{formError || sessionError}</p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
