import { useState, useEffect } from "react";
import "./SuccessMovieReveal.css";

function SuccessMovieReveal({ onFinish }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Reveal animation duration: 3.2 seconds
    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        if (onFinish) onFinish();
      }, 600);
    }, 3200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={`success-movie-reveal-overlay ${fadingOut ? "movie-fade-out" : ""}`}>
      {/* AMBIENT LIGHT GLOWS */}
      <div className="movie-blue-glow" />
      <div className="movie-purple-glow" />
      <div className="movie-dark-scrim" />

      {/* MOVIE TITLE REVEAL CONTENT */}
      <div className="movie-title-reveal-box">
        <h1 className="movie-acadion-title">
          <span className="movie-light-sweep">ACADION</span>
        </h1>

        <p className="movie-acadion-subtitle">
          Academic Intelligence &amp; Operations Network
        </p>

        <div className="movie-welcome-line">
          <span className="movie-glow-dot" />
          <span>Welcome back to your smart academic ecosystem</span>
          <span className="movie-glow-dot" />
        </div>
      </div>
    </div>
  );
}

export default SuccessMovieReveal;
