import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMyProfile, updateMyProfile } from "../../services/profileService";
import ProfileDropdown from "../../components/ProfileDropdown";
import ImageCropperModal from "../../components/ImageCropperModal";
import "./StudentProfile.css";

function StudentProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const email = localStorage.getItem("email") || "";
  const usn = localStorage.getItem("usn") || "";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal & Cropper State
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState(null);
  const [rawCoverForCrop, setRawCoverForCrop] = useState(null);
  const [viewingFullImage, setViewingFullImage] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    bio: "",
    collegeName: "",
    academicBatch: "",
    semester: "",
    studentDepartment: "",
    skills: "",
    profilePicture: "",
    coverImage: "",
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const sanitizeValue = (val, defaultValueMatch) => {
    if (!val) return "";
    if (typeof defaultValueMatch === "string" && val.trim().toLowerCase() === defaultValueMatch.toLowerCase()) {
      return "";
    }
    if (val.toUpperCase().includes("HKBK")) {
      return "";
    }
    return val;
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const data = await getMyProfile(email, usn);
      
      const cleanCollege = sanitizeValue(data.collegeName, "HKBK College of Engineering");
      const cleanBatch = sanitizeValue(data.academicBatch, "2023 - 2027");

      const savedCover = localStorage.getItem("coverImage") || data.coverImage || "";

      const sanitizedProfile = {
        ...data,
        collegeName: cleanCollege,
        academicBatch: cleanBatch,
        coverImage: savedCover,
      };

      setProfile(sanitizedProfile);
      setEditForm({
        name: data.name || "",
        phone: data.phone || "",
        bio: data.bio || "",
        collegeName: cleanCollege,
        academicBatch: cleanBatch,
        semester: data.semester || "",
        studentDepartment: data.studentDepartment || "",
        skills: data.skills || "",
        profilePicture: data.profilePicture || "",
        coverImage: savedCover,
      });

      if (data.profilePicture) {
        localStorage.setItem("profilePicture", data.profilePicture);
      }
      if (data.name) {
        localStorage.setItem("name", data.name);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load student profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageForCrop(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCoverSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setRawCoverForCrop(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = (croppedBase64) => {
    setEditForm((prev) => ({
      ...prev,
      profilePicture: croppedBase64,
    }));
    setRawImageForCrop(null);
    toast.success("Photo cropped! Click 'Save Profile' to apply changes.");
  };

  const handleCoverCropComplete = (croppedBase64) => {
    setEditForm((prev) => ({
      ...prev,
      coverImage: croppedBase64,
    }));
    setProfile((prev) => ({
      ...prev,
      coverImage: croppedBase64,
    }));
    localStorage.setItem("coverImage", croppedBase64);
    setRawCoverForCrop(null);
    toast.success("Cover image cropped & adjusted! Click 'Save Profile' to apply changes.");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...editForm,
        email: profile.email,
        usn: profile.usn,
      };

      const updated = await updateMyProfile(payload);
      const cleanCollege = sanitizeValue(updated.collegeName, "HKBK College of Engineering");
      const cleanBatch = sanitizeValue(updated.academicBatch, "2023 - 2027");

      const sanitizedUpdated = {
        ...updated,
        collegeName: cleanCollege,
        academicBatch: cleanBatch,
        coverImage: editForm.coverImage || updated.coverImage || "",
      };

      setProfile(sanitizedUpdated);

      if (sanitizedUpdated.profilePicture) {
        localStorage.setItem("profilePicture", sanitizedUpdated.profilePicture);
      } else {
        localStorage.removeItem("profilePicture");
      }
      if (sanitizedUpdated.coverImage) {
        localStorage.setItem("coverImage", sanitizedUpdated.coverImage);
      }
      if (sanitizedUpdated.name) {
        localStorage.setItem("name", sanitizedUpdated.name);
      }
      
      window.dispatchEvent(new Event("storage"));

      toast.success("Student profile updated successfully!");
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (n) => {
    if (!n) return "S";
    const parts = n.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  if (loading) {
    return (
      <div className="student-profile-page">
        <div className="profile-loading-card">Loading student profile...</div>
      </div>
    );
  }

  // Calculate Academic Progress if semester exists
  const currentSemNum = parseInt(profile?.semester, 10);
  const hasSemProgress = !isNaN(currentSemNum) && currentSemNum >= 1 && currentSemNum <= 8;
  const semPercentage = hasSemProgress ? Math.min(Math.round((currentSemNum / 8) * 100), 100) : 0;

  // Skills parsing if present
  const skillsArray = profile?.skills
    ? (Array.isArray(profile.skills) ? profile.skills : profile.skills.split(",")).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="student-profile-page">
      {/* Top Navigation */}
      <div className="profile-top-bar">
        <button className="back-btn" onClick={() => navigate("/student/dashboard")}>
          ← Back To Dashboard
        </button>

        <div className="top-bar-right">
          <ProfileDropdown />
        </div>
      </div>

      {/* COMPACT LINKEDIN-STYLE ACADEMIC PROFILE HEADER */}
      <div className="profile-hero-card">
        {/* COMPACT COVER BANNER */}
        <div
          className="profile-cover-area"
          style={
            profile?.coverImage
              ? { backgroundImage: `url(${profile.coverImage})` }
              : undefined
          }
        >
          <label className="change-cover-btn">
            📷 Edit Cover
            <input
              type="file"
              ref={coverInputRef}
              accept="image/*"
              onChange={handleCoverSelect}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* OVERLAPPING AVATAR & COMPACT IDENTITY */}
        <div className="profile-hero-content">
          <div className="profile-avatar-wrapper">
            <div
              className="profile-main-avatar"
              onClick={() => setViewingFullImage(true)}
              title="Click to view full profile picture"
            >
              {profile?.profilePicture ? (
                <img src={profile.profilePicture} alt={profile.name} className="avatar-image" />
              ) : (
                <span className="avatar-initials">{getInitials(profile?.name)}</span>
              )}
            </div>
          </div>

          <div className="profile-main-info">
            <div className="profile-name-row">
              <h1>{profile?.name}</h1>
              <span className="verified-badge">✓ Verified Student</span>
            </div>

            <div className="profile-role-subline">
              <span className="role-chip">Student Member</span>
              {profile?.studentDepartment && (
                <span className="subline-text">• {profile.studentDepartment}</span>
              )}
              {profile?.collegeName && (
                <span className="subline-text">• 🏛️ {profile.collegeName}</span>
              )}
            </div>

            <div className="profile-pills-row">
              <span className="info-pill usn-pill">USN: {profile?.usn || "N/A"}</span>
              {profile?.semester && (
                <span className="info-pill sem-pill">Semester {profile.semester}</span>
              )}
              {profile?.studentDepartment && (
                <span className="info-pill dept-pill">Dept: {profile.studentDepartment}</span>
              )}
              {profile?.academicBatch && (
                <span className="info-pill batch-pill">Batch: {profile.academicBatch}</span>
              )}
            </div>
          </div>

          <div className="profile-hero-actions">
            <button className="edit-profile-hero-btn" onClick={() => setShowEditModal(true)}>
              ✏️ Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ONE ROW FOR BIO (LEFT 50%) AND SKILLS (RIGHT 50%) ON DESKTOP */}
      <div className="profile-two-column-row">
        {/* ABOUT / ACADEMIC PROFILE CARD */}
        <div className="profile-section-card">
          <div className="section-card-head">
            <h3>📝 Academic Profile &amp; Bio</h3>
            <button className="section-edit-btn" onClick={() => setShowEditModal(true)}>
              ✏️ Edit Bio
            </button>
          </div>
          <p className="profile-bio-text">
            {profile?.bio || (
              <span className="empty-text-placeholder">
                Add a short introduction about your academic focus, research goals, or technical interests.
              </span>
            )}
          </p>
        </div>

        {/* ACADEMIC INTERESTS & SKILLS */}
        <div className="profile-section-card">
          <div className="section-card-head">
            <h3>💡 Academic Interests &amp; Skills</h3>
            <button className="section-edit-btn" onClick={() => setShowEditModal(true)}>
              + Add Skills
            </button>
          </div>
          {skillsArray.length > 0 ? (
            <div className="skills-tags-row">
              {skillsArray.map((skill, idx) => (
                <span key={idx} className="skill-chip">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="empty-text-placeholder">
              No academic skills or interests added yet. Click &quot;Add Skills&quot; to list your core subjects or technical skills.
            </p>
          )}
        </div>
      </div>

      {/* COMPACT ACADEMIC PROGRAM PROGRESS */}
      {hasSemProgress && (
        <div className="profile-section-card progress-compact-card">
          <div className="section-card-head">
            <h3>🎓 Academic Program Progress</h3>
            <span className="progress-value-tag">Semester {currentSemNum} of 8</span>
          </div>
          <div className="academic-progress-track">
            <div className="academic-progress-bar" style={{ width: `${semPercentage}%` }} />
          </div>
        </div>
      )}

      {/* ACADEMIC STATISTICS KPI GRID */}
      <div className="academic-kpi-grid">
        <div className="kpi-card clickable" onClick={() => navigate("/student/exams")}>
          <div className="kpi-icon-box blue">📝</div>
          <div className="kpi-meta">
            <span className="kpi-title">Formal Exams Attended</span>
            <strong className="kpi-digit">{profile?.examsAttended ?? 0}</strong>
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => navigate("/student/practice")}>
          <div className="kpi-icon-box purple">🎯</div>
          <div className="kpi-meta">
            <span className="kpi-title">Practice Tests Taken</span>
            <strong className="kpi-digit">{profile?.practiceAttempts ?? 0}</strong>
          </div>
        </div>

        <div className="kpi-card highlight">
          <div className="kpi-icon-box green">📊</div>
          <div className="kpi-meta">
            <span className="kpi-title">Average Assessment Score</span>
            <strong className="kpi-digit">{profile?.averageScore ?? 0}%</strong>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box amber">🛡️</div>
          <div className="kpi-meta">
            <span className="kpi-title">Academic Status</span>
            <strong className="kpi-digit status-ok">{profile?.riskLevel || "ON_TRACK"}</strong>
          </div>
        </div>
      </div>

      {/* DETAILS GRID */}
      <div className="profile-details-grid">
        {/* Academic Details */}
        <div className="detail-panel-card">
          <div className="detail-card-head">
            <h3>🎓 Academic Details</h3>
          </div>
          <div className="detail-items-list">
            <div className="detail-row">
              <span className="detail-label">University Seat No (USN)</span>
              <strong className="detail-value highlight">{profile?.usn || "N/A"}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Current Semester</span>
              <strong className="detail-value">
                {profile?.semester ? `Semester ${profile.semester}` : "Not specified"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Department / Branch</span>
              <strong className="detail-value">
                {profile?.studentDepartment || "Not specified"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Academic Batch</span>
              <strong className="detail-value">
                {profile?.academicBatch || "Not specified"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Institution / College</span>
              <strong className="detail-value">
                {profile?.collegeName || "Not specified"}
              </strong>
            </div>
          </div>
        </div>

        {/* Contact & Account Details */}
        <div className="detail-panel-card">
          <div className="detail-card-head">
            <h3>📞 Contact &amp; Account</h3>
          </div>
          <div className="detail-items-list">
            <div className="detail-row">
              <span className="detail-label">Registered Email</span>
              <strong className="detail-value">{profile?.email}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Contact Phone</span>
              <strong className="detail-value">{profile?.phone || "Not provided"}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Account Role</span>
              <strong className="detail-value role-badge-text">Student Member</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Account Verification</span>
              <strong className="detail-value text-green">✓ Verified &amp; Approved</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Member Since</span>
              <strong className="detail-value">
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })
                  : "Active Member"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="profile-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>✏️ Edit Student Profile</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="modal-form">
              {/* Photo Upload & Crop Row */}
              <div className="modal-avatar-upload-row">
                <div className="modal-avatar-preview">
                  {editForm.profilePicture ? (
                    <img src={editForm.profilePicture} alt="Preview" className="preview-img" />
                  ) : (
                    <span>{getInitials(editForm.name)}</span>
                  )}
                </div>

                <div className="upload-controls">
                  <label className="upload-btn">
                    📷 Choose &amp; Crop Photo
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      style={{ display: "none" }}
                    />
                  </label>
                  {editForm.profilePicture && (
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() => setEditForm({ ...editForm, profilePicture: "" })}
                    >
                      ✕ Remove Photo
                    </button>
                  )}
                  <small>Select any photo from your device to zoom &amp; crop.</small>
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="modal-fields-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="Enter phone number"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    placeholder="e.g. 6"
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Department / Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science (CSE)"
                    value={editForm.studentDepartment}
                    onChange={(e) => setEditForm({ ...editForm, studentDepartment: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Academic Batch</label>
                  <input
                    type="text"
                    placeholder="e.g. 2023 - 2027"
                    value={editForm.academicBatch}
                    onChange={(e) => setEditForm({ ...editForm, academicBatch: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>College / Institution Name</label>
                  <input
                    type="text"
                    placeholder="Enter your college name"
                    value={editForm.collegeName}
                    onChange={(e) => setEditForm({ ...editForm, collegeName: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Academic Interests &amp; Skills (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Data Structures, Web Development, Machine Learning, Python"
                    value={editForm.skills}
                    onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Bio / Academic Summary</label>
                  <textarea
                    rows="3"
                    placeholder="Write a brief intro about your academic focus or technical interests..."
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  />
                </div>
              </div>

              {/* Protected Read-only Fields Note */}
              <div className="modal-readonly-note">
                🔒 Protected Institutional Data (USN: {profile?.usn}, Email: {profile?.email}) is verified and locked by institution.
              </div>

              <div className="modal-foot">
                <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? "Saving Changes..." : "✓ Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AVATAR PHOTO CROPPER MODAL */}
      {rawImageForCrop && (
        <ImageCropperModal
          cropType="avatar"
          imageSrc={rawImageForCrop}
          onCropComplete={handleCropComplete}
          onClose={() => setRawImageForCrop(null)}
        />
      )}

      {/* COVER BANNER CROPPER MODAL */}
      {rawCoverForCrop && (
        <ImageCropperModal
          cropType="cover"
          imageSrc={rawCoverForCrop}
          onCropComplete={handleCoverCropComplete}
          onClose={() => setRawCoverForCrop(null)}
        />
      )}

      {/* FULL PROFILE IMAGE VIEWER LIGHTBOX MODAL */}
      {viewingFullImage && (
        <div className="full-image-modal-overlay" onClick={() => setViewingFullImage(false)}>
          <div className="full-image-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="full-image-header">
              <h3>🖼️ {profile?.name}&apos;s Profile Photo</h3>
              <button className="full-image-close-btn" onClick={() => setViewingFullImage(false)}>✕</button>
            </div>
            <div className="full-image-body">
              {profile?.profilePicture ? (
                <img src={profile.profilePicture} alt={profile?.name} className="full-profile-img" />
              ) : (
                <div className="full-image-initials-box">
                  <span>{getInitials(profile?.name)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentProfile;
