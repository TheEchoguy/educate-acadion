import { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import "./Home.css";

// ORIGINAL FIRST 3 BACKGROUND MP4 VIDEOS FOR THE 3 CATEGORIES
const VIDEO_STUDENT_CAMPUS = "/media-assets/videos/backgrounds/home_student_campus.mp4";
const VIDEO_FACULTY_LEARNING = "/media-assets/videos/backgrounds/home_faculty_learning.mp4";
const VIDEO_ADMINISTRATION = "/media-assets/videos/backgrounds/home_administration.mp4";

function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [prevSlide, setPrevSlide] = useState(0);
  const videoRefs = useRef([]);

  const slides = [
    {
      id: "students",
      category: "STUDENT CAMPUS",
      title: "Academic Campus & Assessment Hub",
      subtitle: "Empowering students with seamless exam participation, practice retakes, and performance tracking.",
      video: VIDEO_STUDENT_CAMPUS,
    },
    {
      id: "teacher",
      category: "FACULTY & LEARNING",
      title: "Faculty Teaching & Smart Evaluation",
      subtitle: "Streamlining question paper creation, automated answer grading, and classroom insights.",
      video: VIDEO_FACULTY_LEARNING,
    },
    {
      id: "admin",
      category: "ADMINISTRATION",
      title: "Institutional Governance & Security",
      subtitle: "Managing user account approvals, department metrics, and enterprise platform security.",
      video: VIDEO_ADMINISTRATION,
    },
  ];

  const handleTabClick = (idx) => {
    if (idx !== activeSlide) {
      setPrevSlide(activeSlide);
      setActiveSlide(idx);
    }
  };

  // When active module changes, play its video from the beginning
  useEffect(() => {
    videoRefs.current.forEach((videoEl, idx) => {
      if (videoEl) {
        if (idx === activeSlide) {
          videoEl.currentTime = 0;
          videoEl.play().catch(() => {});
        } else {
          videoEl.pause();
        }
      }
    });
  }, [activeSlide]);

  // When current active video finishes playing, automatically trigger fast slide out / slide in to next module
  const handleVideoEnded = (idx) => {
    if (idx === activeSlide) {
      const nextIdx = (activeSlide + 1) % slides.length;
      setPrevSlide(activeSlide);
      setActiveSlide(nextIdx);
    }
  };

  const getSlideClass = (idx) => {
    if (idx === activeSlide) return "slide-active";
    if (idx === prevSlide) return "slide-exit-left";
    return "slide-hidden";
  };

  return (
    <div className="home-page">
      <Navbar />

      {/* HERO SECTION WITH FAST SLIDE-IN / SLIDE-OUT PUSH TRANSITIONS AND ORIGINAL 3 VIDEOS */}
      <section className="full-display-transmission-hero">
        <div className="slideshow-video-container">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`reel-slide-item ${getSlideClass(idx)}`}
            >
              <video
                ref={(el) => (videoRefs.current[idx] = el)}
                className="home-category-bg-video"
                autoPlay={idx === activeSlide}
                muted
                playsInline
                onEnded={() => handleVideoEnded(idx)}
              >
                <source src={slide.video} type="video/mp4" />
              </video>
            </div>
          ))}
        </div>

        {/* LIGHT CLEAR OVERLAY FOR SHARP CONTRAST & MAXIMUM VIDEO CLARITY */}
        <div className="full-slide-vignette-overlay" />

        <div className="full-slide-content">
          <div className="transmission-tabs-bar">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                className={`full-tab-btn ${activeSlide === idx ? "active" : ""}`}
                onClick={() => handleTabClick(idx)}
              >
                <span className="tab-dot" />
                {slide.category}
              </button>
            ))}
          </div>

          <div className="motivational-quote-box">
            <span className="slide-category-tag">{slides[activeSlide].category}</span>
            <h1 className="quote-text">{slides[activeSlide].title}</h1>
            <p className="quote-subtitle">{slides[activeSlide].subtitle}</p>
          </div>

          <div className="slide-progress-bar">
            <div className="slide-progress-fill" key={activeSlide} />
          </div>
        </div>
      </section>

      {/* REAL ACADEMIC WORKSPACES BREAKDOWN */}
      <section className="portals-section">
        <div className="section-header">
          <h2>Acadion Platform Modules</h2>
          <p>Real-time tools built specifically for students, faculty, and institution administrators.</p>
        </div>

        <div className="portals-grid">
          {/* Teacher Workspace */}
          <div className="portal-card teacher-border">
            <div className="portal-icon-box purple">🎓</div>
            <h3>Teacher &amp; Faculty Workspace</h3>
            <p>Upload question papers, edit generated questions, grant practice paper permissions, and evaluate student response submissions.</p>
            <ul className="portal-features">
              <li>• Upload &amp; Manage Question Papers</li>
              <li>• Evaluate Student Answers &amp; Assign Marks</li>
              <li>• View Class Performance Analytics</li>
              <li>• Manual Internal Marks Entry</li>
            </ul>
          </div>

          {/* Student Workspace */}
          <div className="portal-card student-border">
            <div className="portal-icon-box blue">👨‍🎓</div>
            <h3>Student Workspace</h3>
            <p>View available examinations, launch timed online paper attempts, check evaluated marksheets, and practice with retake papers.</p>
            <ul className="portal-features">
              <li>• Timed Online Exam Interface</li>
              <li>• View Evaluated Marksheets &amp; Feedback</li>
              <li>• Unlimited Practice Paper Retakes</li>
              <li>• Performance &amp; Subject Mastery Insights</li>
            </ul>
          </div>

          {/* Admin Governance */}
          <div className="portal-card admin-border">
            <div className="portal-icon-box amber">⚡</div>
            <h3>Admin Governance</h3>
            <p>Approve new student and faculty account registrations, manage platform user roles, and monitor institutional metrics.</p>
            <ul className="portal-features">
              <li>• OTP-Verified Account Approval Queue</li>
              <li>• User Directory (Students, Teachers, Admins)</li>
              <li>• Automated Brevo Email Dispatch</li>
              <li>• Institution Performance Overview</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
