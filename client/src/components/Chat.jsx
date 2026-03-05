import { useState, useEffect, useRef } from "react";
import axiosInstance from "../components/api";
import "./Chat.css";

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, grouped: 0, lastCategory: "" });
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [typingPhase, setTypingPhase] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const lastResultIndexRef = useRef(0);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Load chat history on component mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        console.log("📖 Loading chat history...");
        const response = await axiosInstance.post("/chat", {
          userId: user._id,
          message: messageText,
        });

        if (response.data.conversations && response.data.conversations.length > 0) {
          const loadedMessages = response.data.conversations
            .reverse()
            .flatMap((conv) => [
              {
                id: conv._id + "-user",
                type: "user",
                content: conv.userMessage,
                category: conv.category,
              },
              {
                id: conv._id + "-ai",
                type: "ai",
                content: conv.aiResponse,
                category: conv.category,
                ragUsed: conv.ragUsed,
              },
            ]);

          setMessages(loadedMessages);
          console.log(`✓ Loaded ${loadedMessages.length} messages from history`);

          setStats({
            total: response.data.count,
            grouped: "—",
            lastCategory: response.data.conversations[0]?.category || "",
          });
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setInitialLoadDone(true);
      }
    };

    if (user?._id) {
      loadChatHistory();
    }
  }, [user?._id]);

  // Start voice recording
  const startRecording = () => {
    setRecordingError("");
    lastResultIndexRef.current = 0;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecordingError("🔴 Speech recognition not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      isRecordingRef.current = true;
      lastResultIndexRef.current = 0;
      console.log("🎤 Recording started...");
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = lastResultIndexRef.current; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
          console.log(`✓ Final: "${transcript}"`);
        } else {
          interimTranscript += transcript;
          console.log(`~ Interim: "${transcript}"`);
        }
      }

      lastResultIndexRef.current = event.results.length;

      const fullText = finalTranscript || interimTranscript;
      if (fullText.trim()) {
        setInputValue((prev) => {
          const base = prev.trim();
          if (base && base.endsWith(fullText.trim())) {
            return base;
          }
          return base ? base + " " + fullText : fullText;
        });
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") {
        setRecordingError(`🔴 Mic error: ${e.error}`);
        console.error("Mic error:", e.error);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        lastResultIndexRef.current = 0;
        recognition.start();
      } else {
        setIsRecording(false);
        console.log("🎤 Recording stopped");
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  // Stop voice recording
  const stopRecording = () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    setIsRecording(false);
    lastResultIndexRef.current = 0;
    console.log("⏹️ Recording stopped by user");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const messageText = inputValue;
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    // Typing reaction phases
    const phases = ["Analyzing…", "Processing…", "Formulating…", "Almost there…"];
    let phaseIdx = 0;
    setTypingPhase(phases[0]);
    const phaseInterval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length;
      setTypingPhase(phases[phaseIdx]);
    }, 1000);

    try {
      console.log("📤 Sending message...");
      const response = await axiosInstance.post("/chat", {
        userId: user._id,
        message: messageText,
      });


      console.log("✓ Response received");

      const aiMessage = {
        id: Date.now() + 1,
        type: "ai",
        content: response.data.message,
        category: response.data.metadata.categoryDetected,
        confidence: response.data.metadata.classificationConfidence,
        allScores: response.data.metadata.classificationScores,
        ragUsed: response.data.metadata.ragUsed,
        contextSource: response.data.metadata.contextSource,
        autoSaved: response.data.metadata.autoSaved,
        groupingTriggered: response.data.metadata.groupingTriggered,
      };

      setMessages((prev) => [...prev, aiMessage]);
      clearInterval(phaseInterval);
      setTypingPhase("");

      setStats({
        total: response.data.metadata.totalConversations,
        grouped: response.data.metadata.groupingTriggered ? "✓ Grouped" : "—",
        lastCategory: response.data.metadata.categoryDetected,
      });

      if (response.data.metadata.groupingTriggered) {
        console.log("🎯 Auto-grouping triggered!");
      }
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        type: "error",
        content: err.response?.data?.error || "Failed to generate response",
      };
      setMessages((prev) => [...prev, errorMessage]);
      clearInterval(phaseInterval);
      setTypingPhase("");
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
  };

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "U");

  if (!initialLoadDone) {
    return (
      <div className="chat-container">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">

      {/* ── TOP NAV ── */}
      <header className="chat-header">
        <div className="brand">FRIDAY</div>

        <div className="header-right">
          <div className="chat-stats-inline">
            💾 {stats.total} saved &nbsp;|&nbsp; {stats.grouped} &nbsp;|&nbsp;
            {stats.lastCategory && <><strong>{stats.lastCategory}</strong></>}
          </div>

          {/* Avatar + Dropdown */}
          <div className="user-menu" ref={dropdownRef}>
            <button
              className="avatar-btn"
              onClick={() => setDropdownOpen((o) => !o)}
              title="Account"
            >
              {getInitial(user?.name)}
            </button>

            {dropdownOpen && (
              <div className="dropdown">
                <div className="dropdown-info">
                  <span className="dropdown-name">{user?.name}</span>
                  <span className="dropdown-email">{user?.email}</span>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-logout" onClick={handleLogout}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── INFO BAR ── */}
      <div className="chat-info">
        🤖 BART AI classifier &nbsp;·&nbsp; 💾 Auto-saved &nbsp;·&nbsp;
        📊 Groups at 10+ messages &nbsp;·&nbsp; 🎤 Voice input enabled &nbsp;·&nbsp;
        🔄 Persists on refresh
      </div>

      {recordingError && (
        <div className="recording-error">{recordingError}</div>
      )}

      {/* ── MESSAGES ── */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-screen">
            <div className="welcome-content">
              <h1 className="welcome-title">
                Good to see you.<br />
                What&apos;s on your mind?
              </h1>
              <p className="welcome-sub">
                Ask me anything — I&apos;m here to help you think, create, and explore.
              </p>
              <div className="welcome-chips">
                {[
                  "Summarize a document",
                  "Help me write something",
                  "Explain a concept",
                  "Brainstorm ideas",
                  "Analyze my data",
                  "Draft an email",
                ].map((chip) => (
                  <button
                    key={chip}
                    className="welcome-chip"
                    onClick={() => setInputValue(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.type}`}>
            <p>{msg.content}</p>
            <div className="message-tags">
              {msg.category && (
                <span className="category-tag">
                  🤖 {msg.category}
                  {msg.confidence > 0 && (
                    <span className="confidence">({(msg.confidence * 100).toFixed(0)}%)</span>
                  )}
                </span>
              )}
              {msg.autoSaved && <span className="category-tag tag-saved">💾 Saved</span>}
              {msg.ragUsed && <span className="category-tag tag-rag">🔍 RAG</span>}
              {msg.groupingTriggered && <span className="category-tag tag-grouped">📊 Grouped</span>}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message message-ai typing-bubble">
            <div className="typing-reaction">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
              <span className="typing-phase">{typingPhase}</span>
            </div>
            <div className="typing-progress">
              <div className="typing-progress-fill" />
            </div>
          </div>
        )}
      </div>

      {/* ── RECORDING INDICATOR ── */}
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-dot" />
          <span>🎤 Recording... Speak now or click mic to stop</span>
        </div>
      )}

      {/* ── INPUT ── */}
      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isRecording ? "🎤 Listening... speak now" : "Type or click mic to speak..."}
          disabled={loading}
          className="chat-input"
          autoFocus
        />

        <button
          type="button"
          className={`chat-mic-btn ${isRecording ? "recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Stop recording" : "Start voice input"}
          disabled={loading}
        >
          {isRecording ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff4d4d">
              <circle cx="12" cy="12" r="8" opacity="0.3"/>
              <rect x="9" y="9" width="6" height="6" rx="1" fill="#ff4d4d"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#4f46e5">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
              <path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V21H9v2h6v-2h-2v-2.06A9 9 0 0 0 21 10z" />
            </svg>
          )}
        </button>

        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="chat-submit"
        >
          {loading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default Chat;