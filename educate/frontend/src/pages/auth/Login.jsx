import { useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { jwtDecode } from "jwt-decode";

import { loginUser } from "../../services/authService";
import { AuthContext } from "../../context/AuthContext";
import LoginSuccessIntro from "../../components/LoginSuccessIntro";
import "./Login.css";

// EXACT UPLOADED LOGIN MP4 VIDEO FILE IN MEDIA-ASSETS
const LOGIN_VIDEO_PATH = "/media-assets/videos/backgrounds/Creating_background_video_for_login_202608220034.mp4";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMovieReveal, setShowMovieReveal] = useState(false);
  const [targetRoute, setTargetRoute] = useState("/home");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Check if redirected after OTP verification
  const queryParams = new URLSearchParams(location.search);
  const isPendingApprovalRedirect = queryParams.get("pendingApproval") === "true";

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const token = await loginUser(formData);
      const decoded = jwtDecode(token);
      const role = decoded.role;

      localStorage.setItem("name", decoded.name || "User");
      localStorage.setItem("email", decoded.sub || formData.email || "");
      localStorage.setItem("token", token);
      localStorage.setItem("role", role || "");
      localStorage.setItem("usn", decoded.usn || "");
      localStorage.setItem("semester", decoded.semester || "");
      localStorage.setItem("department", decoded.studentDepartment || "");
      login(token, role);

      // ALWAYS NAVIGATE STRICTLY TO EXISTING HOME PAGE (/home) AFTER ACADION TRANSITION FINISHES
      const route = "/home";
      setTargetRoute(route);
      toast.success("Login Successful! Preparing ACADION Ecosystem...");

      // Trigger full-screen movie reveal strictly after successful login of an APPROVED account
      setShowMovieReveal(true);
    } catch (error) {
      const errorMessage = error.response?.data;

      if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("approval")) {
        toast.error("Your account is awaiting administrator approval.");
      } else if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("not found")) {
        toast.error("Account not found. Please register first.");
      } else {
        toast.error(
          error.response?.data?.message ||
          error.response?.data ||
          "Login Failed. Please check your credentials."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMovieRevealFinish = () => {
    // ALWAYS OPEN EXISTING HOME PAGE (/home)
    navigate("/home");
  };

  return (
    <>
      {/* SEPARATE SUCCESSFUL LOGIN MOVIE REVEAL COMPONENT */}
      {showMovieReveal && (
        <LoginSuccessIntro onComplete={handleMovieRevealFinish} />
      )}

      <div className="login-page-video-wrapper">
        <Toaster position="top-right" />

        {/* FULL-PAGE MOVING LOGIN MP4 BACKGROUND VIDEO */}
        <video
          className="login-background-video"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={LOGIN_VIDEO_PATH} type="video/mp4" />
        </video>

        {/* PREMIUM DARK OVERLAY ABOVE VIDEO */}
        <div className="login-video-dark-overlay" />

        {/* FLOATING LOGIN CARD ON RIGHT SIDE OF DESKTOP SCREEN */}
        <div className="login-floating-card">
          {/* 1. SMALL PREMIUM BADGE */}
          <div className="card-badge-pill">🎓 SMART ACADEMIC PORTAL</div>

          {/* 2. ACADION HEADING & 3. SUBTITLE */}
          <div className="brand-header">
            <h1 className="brand-title">ACADION</h1>
            <p className="welcome-subtext">Sign in to your smart academic account</p>
          </div>

          {/* PENDING APPROVAL NOTICE BANNER */}
          {isPendingApprovalRedirect && (
            <div className="pending-approval-banner">
              <div className="banner-icon">⏳</div>
              <div className="banner-text">
                <strong>Registration Submitted Successfully</strong>
                <p>Your account is pending administrator approval. You will be able to sign in after your account has been approved.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {/* 4. EMAIL ADDRESS LABEL & 5. EMAIL INPUT */}
            <div className="input-field-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="name@college.edu.in"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* 6. PASSWORD LABEL, 7. PASSWORD INPUT & 8. PASSWORD VISIBILITY TOGGLE */}
            <div className="input-field-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* 9. FULL-WIDTH SIGN IN TO ACCOUNT BUTTON */}
            <button type="submit" className="login-submit-btn" disabled={loading}>
              <span>{loading ? "Authenticating..." : "Sign In to Account"}</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>

          {/* 10. DON'T HAVE AN ACCOUNT YET? & 11. CREATE NEW ACCOUNT LINK */}
          <div className="login-footer">
            <span>Don't have an account yet?</span>
            <Link to="/register" className="register-link">
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
