import { Link, useNavigate } from "react-router-dom";
import "./LandingPage.css";

// EXACT EXISTING VIDEO FILE IN MEDIA-ASSETS
const ACADEMIC_VIDEO_PATH = "/media-assets/videos/backgrounds/Generate_academic_video_sequence_1080p_202608212346.mp4";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="fullscreen-cinematic-landing">
      {/* SEPARATE LANDING NAVBAR */}
      <nav className="cinematic-navbar">
        <div className="brand-logo">
          <Link to="/">ACADION</Link>
        </div>

        {/* TOP-RIGHT LOGIN BUTTON ONLY */}
        <div className="navbar-action">
          <button className="top-login-btn" onClick={() => navigate("/login")}>
            Login
          </button>
        </div>
      </nav>

      {/* FULL-VIEWPORT CINEMATIC VIDEO VIEWPORT */}
      <div className="cinematic-viewport">
        {/* EXACT EXISTING PROJECT VIDEO PLAYER */}
        <video
          className="main-hero-academic-video"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={ACADEMIC_VIDEO_PATH} type="video/mp4" />
          Your browser does not support HTML5 video.
        </video>

        {/* SUBTLE DARK OVERLAY FOR TEXT & BUTTON READABILITY */}
        <div className="viewport-subtle-overlay" />

        {/* MINIMAL BRANDING & PROMINENT JOIN FREE BUTTON */}
        <div className="cinematic-branding-overlay">
          <h1 className="brand-title">ACADION</h1>
          <h2 className="brand-subtitle">
            Academic Intelligence &amp; Operations Network
          </h2>
          <p className="brand-tagline">
            Your Smart Academic Ecosystem
          </p>

          {/* STRICT PRIMARY ACTION: PROMINENT JOIN FREE BUTTON */}
          <div className="primary-action-wrapper">
            <button
              className="prominent-join-btn"
              onClick={() => navigate("/register")}
            >
              <span>Join Free</span>
              <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
