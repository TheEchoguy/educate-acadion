import { useState, useEffect } from "react";
import "./LoginSuccessIntro.css";

function LoginSuccessIntro({ onComplete }) {
  const [movingUp, setMovingUp] = useState(false);

  const titleLetters = "ACADION".split("");
  const subtitleWords = [
    "Academic",
    "Intelligence &",
    "Operations",
    "Network"
  ];

  useEffect(() => {
    // 1. Pause after complete reveal, then trigger slight upward move & fade out (1.85 seconds)
    const exitTimer = setTimeout(() => {
      setMovingUp(true);
    }, 1850);

    // 2. Call onComplete immediately after the slight upward fade completes (2.45 seconds total)
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2450);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="login-success-movie-overlay">
      {/* AMBIENT GLOWS */}
      <div className="movie-blue-glow" />
      <div className="movie-purple-glow" />
      <div className="movie-dark-scrim" />

      {/* CINEMATIC TITLE & SUBTITLE REVEAL CONTAINER */}
      <div className={`movie-title-reveal-box ${movingUp ? "move-up-exit" : ""}`}>
        {/* 1. SLOWER LETTER REVEAL (A → C → A → D → I → O → N) */}
        <h1 className="movie-acadion-title">
          {titleLetters.map((letter, idx) => (
            <span
              key={idx}
              className="title-letter"
              style={{ animationDelay: `${idx * 0.18}s` }}
            >
              {letter}
            </span>
          ))}
        </h1>

        {/* 2. PROGRESSIVE SUBTITLE REVEAL IN SYNC WITH ACADION LETTERS */}
        <p className="movie-acadion-subtitle">
          {subtitleWords.map((word, idx) => (
            <span
              key={idx}
              className="subtitle-word"
              style={{ animationDelay: `${0.05 + idx * 0.35}s` }}
            >
              {word}&nbsp;
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export default LoginSuccessIntro;
