import { useState } from "react";
import { api } from "../api/api";

export default function Login({ onLogin }: any) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("WORKER");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/login", { name: name.trim() });

      if (res.data.error) {
        alert("User not found");
        return;
      }

      localStorage.setItem("user", JSON.stringify(res.data));
      onLogin();
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        console.error(err);
      }
      alert(err?.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/register", { name: name.trim(), role });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      alert("User created successfully! You can now log in.");
      setIsRegister(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f2f5',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ color: '#1a73e8', margin: '0 0 10px 0', fontSize: '2rem' }}>Railway System</h1>
          <p style={{ color: '#5f6368', margin: 0 }}>
            {isRegister ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#3c4043', fontWeight: '600' }}>Full Name</label>
          <input
            placeholder="e.g. John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #dadce0',
              fontSize: '1rem',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#1a73e8'}
            onBlur={(e) => e.target.style.borderColor = '#dadce0'}
          />
        </div>

        {isRegister && (
          <div style={{ marginBottom: '25px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#3c4043', fontWeight: '600' }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #dadce0',
                fontSize: '1rem',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="WORKER">Worker</option>
            </select>
            <p style={{ margin: '8px 0 0', color: '#5f6368', fontSize: '0.82rem' }}>
              Supervisor and Admin accounts must be created by an Admin.
            </p>
          </div>
        )}

        <button
          onClick={isRegister ? handleRegister : handleLogin}
          disabled={loading || !name.trim()}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading || !name.trim() ? '#ccc' : '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? "Processing..." : (isRegister ? "Register" : "Sign In")}
        </button>

        <div style={{ marginTop: '25px', borderTop: '1px solid #f1f3f4', paddingTop: '20px' }}>
          <p style={{ color: '#5f6368', fontSize: '0.9rem' }}>
            {isRegister ? "Already have an account?" : "Don't have an account?"}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setName("");
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#1a73e8',
                fontWeight: '600',
                marginLeft: '8px',
                cursor: 'pointer',
                padding: 0
              }}
            >
              {isRegister ? "Sign In" : "Register"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
