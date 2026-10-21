import { useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ProfileDropdown from "./ProfileDropdown";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, role } = useContext(AuthContext);

  const isHomeActive = location.pathname === "/home";
  const isDashboardActive =
    location.pathname.startsWith("/student") ||
    location.pathname.startsWith("/teacher") ||
    location.pathname.startsWith("/admin");

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        {/* LOGGED IN USERS NAVIGATE TO OLD ORIGINAL HOME PAGE (/home) */}
        <Link to={token ? "/home" : "/"}>Acadion</Link>
      </div>

      <div className="navbar-links">
        {!token ? (
          <div className="navbar-right">
            <Link to="/login">
              <button className="login-btn">Login</button>
            </Link>
            <Link to="/register">
              <button className="join-btn">Join Free</button>
            </Link>
          </div>
        ) : (
          <>
            <div className="navbar-center">
              <button
                className={`nav-pill-btn ${isHomeActive ? "active" : ""}`}
                onClick={() => navigate("/home")}
              >
                Home
              </button>

              {role === "ADMIN" && (
                <button
                  className={`nav-pill-btn ${isDashboardActive ? "active" : ""}`}
                  onClick={() => navigate("/admin/dashboard")}
                >
                  Dashboard
                </button>
              )}

              {role === "STUDENT" && (
                <>
                  <button
                    className={`nav-pill-btn ${location.pathname === "/student/dashboard" ? "active" : ""}`}
                    onClick={() => navigate("/student/dashboard")}
                  >
                    Dashboard
                  </button>
                  <button
                    className={`nav-pill-btn ${location.pathname.startsWith("/student/classrooms") ? "active" : ""}`}
                    onClick={() => navigate("/student/classrooms")}
                  >
                    Classrooms
                  </button>
                </>
              )}

              {role === "TEACHER" && (
                <>
                  <button
                    className={`nav-pill-btn ${location.pathname === "/teacher/dashboard" ? "active" : ""}`}
                    onClick={() => navigate("/teacher/dashboard")}
                  >
                    Dashboard
                  </button>
                  <button
                    className={`nav-pill-btn ${location.pathname.startsWith("/teacher/papers") || location.pathname.startsWith("/teacher/manage-papers") ? "active" : ""}`}
                    onClick={() => navigate("/teacher/papers")}
                  >
                    Papers & Studio
                  </button>
                  <button
                    className={`nav-pill-btn ${location.pathname.startsWith("/teacher/classrooms") ? "active" : ""}`}
                    onClick={() => navigate("/teacher/classrooms")}
                  >
                    IA Marks & Classes
                  </button>
                  <button
                    className={`nav-pill-btn ${location.pathname.startsWith("/teacher/analytics") ? "active" : ""}`}
                    onClick={() => navigate("/teacher/analytics")}
                  >
                    Risk & Analytics
                  </button>
                  <button
                    className={`nav-pill-btn ${location.pathname.startsWith("/teacher/ppt-generator") ? "active" : ""}`}
                    onClick={() => navigate("/teacher/ppt-generator")}
                  >
                    AI PPT Studio
                  </button>
                </>
              )}
            </div>

            <div className="navbar-right">
              <ProfileDropdown />
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;