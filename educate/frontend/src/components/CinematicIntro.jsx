import { useState, useEffect } from "react";
import "./CinematicIntro.css";
// Missing legacy asset placeholder (CinematicIntro is currently unreferenced)
const heroImg = "";

function CinematicIntro({ onComplete }) {
  const [scene, setScene] = useState(1);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Scene 1 -> Scene 2 (at 1.0s)
    const timer1 = setTimeout(() => {
      setScene(2);
    }, 1000);

    // Scene 2 -> Scene 3 Title Reveal (at 1.8s)
    const timer2 = setTimeout(() => {
      setScene(3);
    }, 1800);

    // Transition to Login (at 3.8s)
    const timer3 = setTimeout(() => {
      handleComplete();
    }, 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleComplete = () => {
    setFadingOut(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 600);
  };

  return (
    <div className={`cinematic-intro-container ${fadingOut ? "fade-out" : ""}`}>
      {/* BACKGROUND IMAGE WITH CAMERA PUSH & PARALLAX */}
      <div
        className={`intro-hero-bg ${scene >= 2 ? "scene-darken" : ""}`}
        style={{ backgroundImage: `url(${heroImg})` }}
      />

      {/* AMBIENT GLOW OVERLAYS */}
      <div className={`intro-blue-glow ${scene >= 2 ? "active" : ""}`} />
      <div className={`intro-purple-glow ${scene >= 2 ? "active" : ""}`} />
      <div className="intro-dark-scrim" />

      {/* SKIP INTRO BUTTON */}
      <button className="skip-intro-btn" onClick={handleComplete}>
        Skip Intro →
      </button>

      {/* SCENE 3: ACADION TITLE REVEAL */}
      <div className={`title-reveal-box ${scene === 3 ? "active" : ""}`}>
        <div className="brand-logo-glow-wrapper">
          <h1 className="cinematic-title">
            <span className="light-sweep">ACADION</span>
          </h1>
        </div>
        <p className="cinematic-subtitle">
          Academic Intelligence &amp; Operations Network
        </p>
        <div className="cinematic-tagline">
          <span className="tagline-dot" />
          <span>Your Smart Academic Ecosystem</span>
          <span className="tagline-dot" />
        </div>
      </div>
    </div>
  );
}

export default CinematicIntro;
