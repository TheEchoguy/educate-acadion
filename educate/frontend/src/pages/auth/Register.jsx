import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

import { registerUser } from "../../services/authService";
import "./Register.css";

// EXACT UPLOADED REGISTER MP4 VIDEO FILE IN MEDIA-ASSETS
const REGISTER_VIDEO_PATH = "/media-assets/videos/backgrounds/Creating_ACADION_registration_video_1080p_202608220038.mp4";

function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT",
    usn: "",
    semester: "",
    studentDepartment: "",
    employeeId: "",
    designation: "",
    teacherDepartment: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRoleSelect = (selectedRole) => {
    setFormData((prev) => ({
      ...prev,
      role: selectedRole,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const payload = {
        ...formData,
        semester: formData.semester ? parseInt(formData.semester, 10) : null,
      };
      const response = await registerUser(payload);

      toast.success(response || "Registration Successful! OTP sent to your email.");
      localStorage.setItem("otpEmail", formData.email);

      setTimeout(() => {
        navigate("/verify-otp");
      }, 1500);
    } catch (error) {
      toast.error(
        error.response?.data || "Registration Failed. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  // PASSWORD STRENGTH CALCULATOR
  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (/[A-Z]/.test(pwd) || /[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd) && pwd.length >= 8) score += 1;
    return score;
  };

  const pwdScore = getPasswordStrength(formData.password);

  return (
    <div className="register-page-video-wrapper">
      <Toaster position="top-right" />

      {/* FULL-PAGE MOVING REGISTER MP4 BACKGROUND VIDEO */}
      <video
        className="register-background-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={REGISTER_VIDEO_PATH} type="video/mp4" />
      </video>

      {/* PREMIUM DARK OVERLAY ABOVE VIDEO */}
      <div className="register-video-dark-overlay" />

      {/* CENTERED REGISTER FORM CARD IN VIEWPORT */}
      <div className="register-centered-container">
        <div className="register-glass-card">
          {/* 1. SMALL PREMIUM BADGE */}
          <div className="card-badge-pill">🎓 SMART ACADEMIC REGISTRATION</div>

          {/* 2. MAIN HEADING & 3. SUBTITLE */}
          <div className="brand-header">
            <h1 className="brand-title">CREATE ACCOUNT</h1>
            <p className="welcome-subtext">Select your role and enter your institutional credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            {/* 4. ROLE SELECTION BUTTONS */}
            <div className="role-selection-group">
              <label>Select Role:</label>
              <div className="role-buttons-grid">
                <button
                  type="button"
                  className={`role-btn ${formData.role === "STUDENT" ? "active" : ""}`}
                  onClick={() => handleRoleSelect("STUDENT")}
                >
                  <span className="role-icon">👨‍🎓</span>
                  <span>Student Account</span>
                </button>
                <button
                  type="button"
                  className={`role-btn ${formData.role === "TEACHER" ? "active" : ""}`}
                  onClick={() => handleRoleSelect("TEACHER")}
                >
                  <span className="role-icon">👨‍🏫</span>
                  <span>Faculty / Teacher</span>
                </button>
              </div>
            </div>

            {/* 5. FULL NAME FIELD (EXACT PLACEHOLDER: "Enter your full name") */}
            <div className="input-field-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* 6. INSTITUTIONAL EMAIL FIELD */}
            <div className="input-field-group">
              <label>Institutional Email</label>
              <input
                type="email"
                name="email"
                placeholder="name@college.edu.in"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* 7. ACCOUNT PASSWORD FIELD + VISIBILITY TOGGLE + STRENGTH METER */}
            <div className="input-field-group">
              <label>Account Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Create a secure password"
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

              {/* COMPACT STRENGTH METER */}
              {formData.password.length > 0 && (
                <div className="password-strength-bars">
                  <div className={`strength-bar ${pwdScore >= 1 ? "weak" : ""}`} />
                  <div className={`strength-bar ${pwdScore >= 2 ? "medium" : ""}`} />
                  <div className={`strength-bar ${pwdScore >= 3 ? "strong" : ""}`} />
                  <span className="strength-label">
                    {pwdScore === 1 && "Weak"}
                    {pwdScore === 2 && "Good"}
                    {pwdScore === 3 && "Strong"}
                  </span>
                </div>
              )}
            </div>

            {/* STUDENT SPECIFIC FIELDS */}
            {formData.role === "STUDENT" && (
              <>
                {/* 8. UNIVERSITY SEAT NUMBER (USN) */}
                <div className="input-field-group">
                  <label>University Seat Number (USN)</label>
                  <input
                    type="text"
                    name="usn"
                    placeholder="Enter your USN"
                    value={formData.usn}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row-two-col">
                  {/* 9. SEMESTER DROPDOWN */}
                  <div className="input-field-group">
                    <label>Semester</label>
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Semester</option>
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                      <option value="3">Semester 3</option>
                      <option value="4">Semester 4</option>
                      <option value="5">Semester 5</option>
                      <option value="6">Semester 6</option>
                      <option value="7">Semester 7</option>
                      <option value="8">Semester 8</option>
                    </select>
                  </div>

                  {/* 10. DEPARTMENT DROPDOWN */}
                  <div className="input-field-group">
                    <label>Department</label>
                    <select
                      name="studentDepartment"
                      value={formData.studentDepartment}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Department</option>
                      <option value="Computer Science & Engineering">Computer Science &amp; Engg</option>
                      <option value="Information Science & Engineering">Information Science &amp; Engg</option>
                      <option value="Electronics & Communication">Electronics &amp; Comm</option>
                      <option value="Electrical & Electronics">Electrical &amp; Electronics</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* TEACHER SPECIFIC FIELDS */}
            {formData.role === "TEACHER" && (
              <>
                <div className="input-field-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    name="employeeId"
                    placeholder="Enter Employee ID"
                    value={formData.employeeId}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row-two-col">
                  <div className="input-field-group">
                    <label>Designation</label>
                    <select
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Designation</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Professor & HOD">Professor &amp; HOD</option>
                      <option value="Senior Lecturer">Senior Lecturer</option>
                    </select>
                  </div>

                  <div className="input-field-group">
                    <label>Department</label>
                    <select
                      name="teacherDepartment"
                      value={formData.teacherDepartment}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Department</option>
                      <option value="Computer Science & Engineering">Computer Science &amp; Engg</option>
                      <option value="Information Science & Engineering">Information Science &amp; Engg</option>
                      <option value="Electronics & Communication">Electronics &amp; Comm</option>
                      <option value="Electrical & Electronics">Electrical &amp; Electronics</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* 11. REGISTER BUTTON */}
            <button type="submit" className="register-submit-btn" disabled={loading}>
              <span>{loading ? "Registering..." : "Register & Get OTP"}</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>

          {/* 12. BOTTOM TEXT & 13. SIGN IN TO ACCOUNT LINK */}
          <div className="register-footer">
            <span>Already registered?</span>
            <Link to="/login" className="login-link">
              Sign In to Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
