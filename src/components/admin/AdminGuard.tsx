import { useState } from "react";
import { Outlet } from "react-router-dom";

const PASSPHRASE = "renjoy";
const STORAGE_KEY = "renjoy_admin_auth";

export function AdminGuard() {
  const [authenticated, setAuthenticated] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSPHRASE) {
      localStorage.setItem(STORAGE_KEY, "true");
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (authenticated) {
    return <Outlet />;
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "#fff",
    }}>
      <form onSubmit={handleSubmit} style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "300px",
      }}>
        <label style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "#242427",
        }}>
          Enter passphrase
        </label>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          autoFocus
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            color: "#242427",
            outline: "none",
          }}
        />
        {error && (
          <span style={{ fontSize: "13px", color: "#dc2626" }}>Incorrect</span>
        )}
        <button type="submit" style={{
          padding: "8px 16px",
          background: "#242427",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: 500,
          cursor: "pointer",
        }}>
          Submit
        </button>
      </form>
    </div>
  );
}
