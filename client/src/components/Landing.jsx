import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderTree, Sparkles, Target } from "lucide-react";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

  :root {
    --bg: #09090b;
    --bg-soft: #111113;
    --panel: #121215;
    --panel-2: #16161a;
    --line: #27272a;
    --line-strong: #3f3f46;
    --text: #fafafa;
    --muted: #a1a1aa;
    --muted-2: #71717a;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Manrope', sans-serif;
    background: radial-gradient(1200px 700px at 60% -120px, #19191d 0%, var(--bg) 56%);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  .landing-wrap {
    min-height: 100vh;
    background: transparent;
  }

  .grid-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image:
      linear-gradient(to right, rgba(161,161,170,0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(161,161,170,0.08) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(circle at 50% 25%, black 18%, transparent 72%);
    -webkit-mask-image: radial-gradient(circle at 50% 25%, black 18%, transparent 72%);
  }

  .container {
    max-width: 1160px;
    margin: 0 auto;
    padding: 0 22px;
    position: relative;
    z-index: 2;
  }

  .nav {
    position: sticky;
    top: 0;
    z-index: 30;
    backdrop-filter: blur(10px);
    background: rgba(9, 9, 11, 0.72);
    border-bottom: 1px solid rgba(39, 39, 42, 0.9);
  }

  .nav-row {
    height: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .brand {
    text-decoration: none;
    color: var(--text);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn {
    border-radius: 10px;
    border: 1px solid var(--line);
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 9px 14px;
    transition: all 0.14s ease;
    cursor: pointer;
    font-family: inherit;
  }

  .btn.ghost {
    background: #121215;
    color: #e4e4e7;
  }

  .btn.ghost:hover {
    border-color: var(--line-strong);
    background: #1b1b1f;
  }

  .btn.solid {
    background: #f4f4f5;
    border-color: #f4f4f5;
    color: #111113;
  }

  .btn.solid:hover { filter: brightness(0.95); }

  .hero {
    padding: 86px 0 52px;
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 36px;
    align-items: center;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    background: rgba(255,255,255,0.04);
    color: #d4d4d8;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 0.71rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin-bottom: 14px;
  }

  .dot { display: inline-flex; }

  .hero h1 {
    font-size: clamp(2.7rem, 7vw, 5rem);
    line-height: 0.98;
    letter-spacing: -0.04em;
    margin-bottom: 16px;
  }

  .hero h1 span { color: var(--muted); }

  .hero p {
    color: var(--muted);
    line-height: 1.72;
    font-size: 1rem;
    max-width: 520px;
  }

  .hero-row {
    margin-top: 24px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .hero-card {
    border: 1px solid var(--line);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(22,22,26,.8) 0%, rgba(14,14,17,.95) 100%);
    padding: 16px;
  }

  .hero-card-head {
    font-size: 0.74rem;
    color: var(--muted-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
    font-weight: 700;
  }

  .hero-list { display: grid; gap: 8px; }

  .hero-item {
    border: 1px solid #303036;
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
    padding: 9px 10px;
    font-size: 0.83rem;
    color: #e4e4e7;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stats {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .stat {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #111113;
    text-align: center;
    padding: 12px 8px;
  }

  .stat b {
    display: block;
    font-size: 1.55rem;
    letter-spacing: -0.03em;
  }

  .stat span {
    color: var(--muted-2);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  .section {
    padding: 24px 0 56px;
  }

  .section h2 {
    font-size: clamp(1.8rem, 4.4vw, 2.7rem);
    letter-spacing: -0.03em;
    margin-bottom: 10px;
  }

  .section h2 span { color: var(--muted); }

  .section p {
    color: var(--muted);
    max-width: 560px;
    line-height: 1.7;
  }

  .feature-grid {
    margin-top: 2rem ;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .feature-card {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #111113;
    padding: 18px;
    transition: border-color .15s ease, transform .15s ease, background .15s ease;
  }

  .feature-card:hover {
    border-color: var(--line-strong);
    background: #17171b;
    transform: translateY(-1px);
  }

  .feature-tag {
    font-size: 0.67rem;
    color: var(--muted-2);
    text-transform: uppercase;
    letter-spacing: 0.11em;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .feature-title {
    font-size: 1.02rem;
    font-weight: 700;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }

  .feature-desc {
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.66;
  }

  .cta {
  margin: 2rem auto 2rem;
    padding: 56px 0 74px;
    text-align: center;
  }

  .cta h3 {
    font-size: clamp(2rem, 5.4vw, 4rem);
    letter-spacing: -0.04em;
    margin-bottom: 10px;
  }

  .cta p {
    color: var(--muted);
    margin: 0 auto 18px;
    max-width: 460px;
    line-height: 1.7;
  }

  .footer {
    border-top: 1px solid var(--line);
    padding: 16px 0 20px;
    color: var(--muted-2);
    font-size: 0.74rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 980px) {
    .hero { grid-template-columns: 1fr; gap: 20px; }
    .feature-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 640px) {
    .nav-row { height: 60px; }
    .feature-grid { grid-template-columns: 1fr; }
    .stats { grid-template-columns: 1fr; }
    .hero { padding-top: 70px; }
  }
`;

const FEATURES = [
  {
    tag: "Classification",
    title: "BART Intent Detection",
    desc: "Messages are automatically categorized into business-relevant buckets for structured memory and retrieval.",
  },
  {
    tag: "Persistence",
    title: "Automatic Save",
    desc: "Every conversation is persisted in real time, so session history is always available across reloads.",
  },
  {
    tag: "Grouping",
    title: "Pattern Clustering",
    desc: "Conversation groups are created from recurring themes, helping you spot trends and repeated decision patterns.",
  },
  {
    tag: "RAG",
    title: "Contextual Responses",
    desc: "Relevant prior conversations are retrieved to ground responses in your own historical context.",
  },
  {
    tag: "Performance",
    title: "Low-Latency Inference",
    desc: "Optimized pipeline with fast embedding and inference path for responsive, practical chat interaction.",
  },
  {
    tag: "Security",
    title: "Private Workspace",
    desc: "Authenticated sessions with per-user data isolation and controlled profile access.",
  },
];

const Landing = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      navigate("/chat", { replace: true });
      return;
    }

    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="landing-wrap" style={{ opacity: visible ? 1 : 0, transition: "opacity .35s ease" }}>
      <style>{css}</style>
      <div className="grid-bg" aria-hidden="true" />

      <header className="nav">
        <div className="container nav-row">
          <Link className="brand" to="/">FRIDAY</Link>
          <div className="nav-actions">
            <Link className="btn ghost" to="/login">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <div className="eyebrow"><span className="dot"><Sparkles size={12} /></span>Now Available</div>
            <h1>
              AI Workspace for
              <span> Persistent Conversations</span>
            </h1>
            <p>
              FRIDAY is a focused assistant for individuals who need context-aware chat,
              structured memory, and reliable retrieval from historical conversations.
            </p>
            <div className="hero-row">
              <Link className="btn solid" to="/login">Start Free</Link>
              <button
                className="btn ghost"
                type="button"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Features
              </button>
            </div>
          </div>

          <aside className="hero-card">
            <div className="hero-card-head">Workspace Snapshot</div>
            <div className="hero-list">
              <div className="hero-item"><Target size={14} />Category detected: product</div>
              <div className="hero-item"><FolderTree size={14} />Context retrieved: 5 conversations</div>
              <div className="hero-item"><FolderTree size={14} />Grouping status: active</div>
            </div>
            <div className="stats">
              <div className="stat"><b>7</b><span>Categories</span></div>
              <div className="stat"><b>8</b><span>Conversations</span></div>
              <div className="stat"><b>100%</b><span>Persistent</span></div>
            </div>
          </aside>
        </section>

        <section className="section" id="features">
          <h2>
            Clean architecture,
            <span> practical AI features</span>
          </h2>
          <p>
            Built for clarity and reliability: each component in the pipeline exists to improve response quality,
            maintain context, and keep data organized over time.
          </p>

          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-tag">{feature.tag}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <h3>Built to scale with your conversations</h3>
          <p>
            Start with a simple chat flow and grow into a context-rich assistant powered by classification,
            retrieval, and grouping.
          </p>
          <Link className="btn solid" to="/login">Open Workspace</Link>
        </section>

        <footer className="footer">
          <span>FRIDAY</span>
          <span>AI-powered assistant platform</span>
        </footer>
      </main>
    </div>
  );
};

export default Landing;
