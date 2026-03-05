import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import "./Landing.css";

const Landing = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const user = localStorage.getItem("user");
    if (user) {
      navigate("/chat", { replace: true });
      return;
    }

    // Fade in animation
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, [navigate]);

  const handleGetStarted = () => {
    navigate("/login");
  };

  const handleLearnMore = () => {
    // Scroll to features or open docs
    document.querySelector(".landing-features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={`landing-container ${visible ? "landing-container--visible" : ""}`}>
      {/* Background */}
      <div className="landing-background">
        <div className="particle-canvas"></div>
        <div className="bg-grid"></div>
        <div className="bg-glow bg-glow--1"></div>
        <div className="bg-glow bg-glow--2"></div>
        <div className="bg-glow bg-glow--3"></div>
        <div className="bg-ring bg-ring--1"></div>
        <div className="bg-ring bg-ring--2"></div>
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav__logo">FRIDAY</div>
        <div className="landing-nav__links">
         <Link to="/login" className="landing-nav__link">
  Sign In
</Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="landing-content">
        {/* Badge */}
        <div className="landing-badge">
          <span className="landing-badge__dot"></span>
          <span className="landing-badge__text">Now Available</span>
        </div>

        {/* Hero Section */}
        <div className="landing-hero">
          <h1 className="landing-title">FRIDAY</h1>
          <h2 className="landing-subtitle">AI-Powered Assistant</h2>
          <p className="landing-description">
            Intelligent conversations that learn from your history. Auto-categorized, 
            always available, and continuously improving.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="landing-features" id="features">
          <div className="feature-card">
            <div className="feature-card__top-line"></div>
            <span className="feature-icon">🤖</span>
            <h3 className="feature-card__title">BART Classification</h3>
            <p className="feature-card__desc">
              Advanced AI automatically categorizes your conversations with precision.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__top-line"></div>
            <span className="feature-icon">💾</span>
            <h3 className="feature-card__title">Auto-Saved</h3>
            <p className="feature-card__desc">
              Every conversation is instantly saved and persists across sessions.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__top-line"></div>
            <span className="feature-icon">📊</span>
            <h3 className="feature-card__title">Smart Grouping</h3>
            <p className="feature-card__desc">
              Similar conversations are automatically grouped for better organization.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__top-line"></div>
            <span className="feature-icon">🔍</span>
            <h3 className="feature-card__title">Context Aware</h3>
            <p className="feature-card__desc">
              RAG system retrieves relevant past conversations for better responses.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__top-line"></div>
            <span className="feature-icon">⚡</span>
            <h3 className="feature-card__title">Lightning Fast</h3>
            <p className="feature-card__desc">
              Powered by llama-3:8b for ultra-fast inference and real-time responses.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__top-line"></div>
            <span className="feature-icon">🔐</span>
            <h3 className="feature-card__title">Secure & Private</h3>
            <p className="feature-card__desc">
              Your conversations are encrypted and only accessible to you.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="landing-buttons">
          <button className="primary-btn get-started" onClick={handleGetStarted}>
            Get Started
          </button>
          <button className="secondary-btn" onClick={handleLearnMore}>
            Learn More
          </button>
        </div>

        {/* Stats */}
        <div className="landing-stats">
          <div className="landing-stat">
            <span className="landing-stat__num">7</span>
            <span className="landing-stat__label">Categories</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat__num">∞</span>
            <span className="landing-stat__label">Conversations</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat__num">100%</span>
            <span className="landing-stat__label">Persistent</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;