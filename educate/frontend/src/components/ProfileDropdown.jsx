import { useNavigate } from "react-router-dom";
import "./ProfileDropdown.css";

function ProfileDropdown() {
  const navigate = useNavigate();

  const name = localStorage.getItem("name") || "User";
  const role = localStorage.getItem("role") || "STUDENT";
  const semester = localStorage.getItem("semester") || "";
  const profilePicture = localStorage.getItem("profilePicture") || "";

  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";

  const getInitials = (n) => {
    if (!n) return "U";
    const parts = n.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/login");
  };

  const handleGoToProfile = () => {
    if (isStudent) {
      navigate("/student/profile");
    } else if (isTeacher) {
      navigate("/teacher/profile");
    } else {
      navigate("/admin/dashboard");
    }
  };

  return (
    <div className="topbar-user-cluster">
      {/* 1. Direct Profile Pill */}
      <button
        type="button"
        className="profile-pill-btn"
        onClick={handleGoToProfile}
        title="Click to view & edit your profile"
      >
        <div className="pill-avatar">
          {profilePicture ? (
            <img src={profilePicture} alt={name} className="pill-img" />
          ) : (
            <span className="pill-initials">{getInitials(name)}</span>
          )}
        </div>

        <div className="pill-info">
          <span className="pill-name">{name}</span>
          <span className="pill-role">
            {isStudent
              ? `Student • Sem ${semester || 6}`
              : isTeacher
              ? "Faculty Member"
              : "Administrator"}
          </span>
        </div>
      </button>

      {/* 2. Separate Distinct Logout Button */}
      <button
        type="button"
        className="topbar-logout-btn"
        onClick={handleLogout}
        title="Log out of your account"
      >
        Logout
      </button>
    </div>
  );
}

export default ProfileDropdown;
