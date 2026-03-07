import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import axiosInstance from "./api";
import "./Login.css";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const response = await axiosInstance.post(endpoint, formData);

      if (response.data.token && response.data._id) {
        const user = {
          _id: response.data._id,
          name: response.data.name,
          email: response.data.email,
        };

        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("token", response.data.token);

        navigate("/chat", { replace: true });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      let errorMsg = "An error occurred";

      if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.response?.status === 404) {
        errorMsg = "Server endpoint not found.";
      } else if (err.response?.status === 500) {
        errorMsg = "Server error.";
      } else if (err.message === "Network Error") {
        errorMsg = "Network error. Is backend running?";
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError("");
    setFormData({ name: "", email: "", password: "" });
  };

  return (
    <div className="auth-container">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-glow auth-glow-2" aria-hidden="true" />
      <Link to="/" className="back-home">
        <ArrowLeft size={15} />
        Back to Home
      </Link>

      <div className="card">
        <div className="brand-row">
          <Link to="/" className="linktohome">FRIDAY</Link>
          <span className="brand-badge">Secure</span>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={`mode-tab ${!isRegister ? "active" : ""}`} onClick={() => isRegister && toggleMode()} disabled={loading}>
            Sign In
          </button>
          <button type="button" className={`mode-tab ${isRegister ? "active" : ""}`} onClick={() => !isRegister && toggleMode()} disabled={loading}>
            Register
          </button>
        </div>

        <h1 className="title">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="headline"></p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <div className="input-wrap">
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="John Doe"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-wrap">
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={loading}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                placeholder="Enter your password"
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowPw(!showPw)}
                disabled={loading}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Loading..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
