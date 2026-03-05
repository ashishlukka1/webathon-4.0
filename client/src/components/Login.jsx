import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      <div className="card">
        <div className="brand1">Jarvis</div>

        <div className="headline">
          {isRegister
            ? "Create your account to continue"
            : "Welcome back — sign in to continue"}
        </div>

        {error && <div className="error-box">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="field">
              <label>Full Name</label>
              <div className="input-wrap">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <div className="input-wrap">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="input-wrap">
              <input
                type={showPw ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                placeholder="Enter your password"
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

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="divider">or</div>

        <div className="toggle-text">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}
          <button
            type="button"
            className="mode-switch"
            onClick={toggleMode}
            disabled={loading}
          >
            {isRegister ? "Sign In" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;