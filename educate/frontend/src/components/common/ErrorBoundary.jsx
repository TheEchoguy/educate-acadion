import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    const role = (sessionStorage.getItem("role") || localStorage.getItem("role") || "").toUpperCase();
    if (role.includes("TEACHER")) {
      window.location.href = "/teacher/dashboard";
    } else if (role.includes("ADMIN")) {
      window.location.href = "/admin/dashboard";
    } else {
      window.location.href = "/student/dashboard";
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#090d16",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 540,
              width: "100%",
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 20,
              padding: "36px 32px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
                margin: "0 auto 20px auto",
              }}
            >
              ⚠️
            </div>

            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 10px 0", color: "#ffffff" }}>
              AI Study Tutor Encountered an Error
            </h2>

            <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              A client-side runtime exception occurred while rendering this view. Your session and data are secure.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: "0.78rem",
                  fontFamily: "monospace",
                  color: "#fca5a5",
                  textAlign: "left",
                  margin: "0 0 24px 0",
                  maxHeight: 120,
                  overflowY: "auto",
                  wordBreak: "break-word",
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: "linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#ffffff",
                  padding: "10px 20px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                }}
              >
                ↻ Reload Tutor
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#cbd5e1",
                  padding: "10px 20px",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
