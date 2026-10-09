import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMyProfile, updateMyProfile } from "../../services/profileService";
import ProfileDropdown from "../../components/ProfileDropdown";
import ImageCropperModal from "../../components/ImageCropperModal";
import "./TeacherProfile.css";

function TeacherProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const email = localStorage.getItem("email") || "";

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
    designation: "",
    qualification: "",
    experienceYears: "",
    cabinRoom: "",
    teacherDepartment: "",
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
      const data = await getMyProfile(email);
      
      const cleanCollege = sanitizeValue(data.collegeName, "HKBK College of Engineering");
      const savedCover = localStorage.getItem("coverImage") || data.coverImage || "";

      const sanitizedProfile = {
        ...data,
        collegeName: cleanCollege,
        coverImage: savedCover,
      };

      setProfile(sanitizedProfile);
      setEditForm({
        name: data.name || "",
        phone: data.phone || "",
        bio: data.bio || "",
        collegeName: cleanCollege,
        designation: data.designation || "",
        qualification: data.qualification || "",
        experienceYears: data.experienceYears || "",
        cabinRoom: data.cabinRoom || "",
        teacherDepartment: data.teacherDepartment || "",
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
      toast.error("Failed to load teacher profile");
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
      };

      const updated = await updateMyProfile(payload);
      const cleanCollege = sanitizeValue(updated.collegeName, "HKBK College of Engineering");

      const sanitizedUpdated = {
        ...updated,
        collegeName: cleanCollege,
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

      toast.success("Teacher profile updated successfully!");
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (n) => {
    if (!n) return "T";
    const parts = n.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  if (loading) {
    return (
      <div className="teacher-profile-page">
        <div className="profile-loading-card">Loading faculty profile...</div>
      </div>
    );
  }

  // Skills parsing if present
  const skillsArray = profile?.skills
    ? (Array.isArray(profile.skills) ? profile.skills : profile.skills.split(",")).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="teacher-profile-page">
      {/* Top Navigation */}
      <div className="profile-top-bar">
        <button className="back-btn" onClick={() => navigate("/teacher/dashboard")}>
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
              <span className="verified-badge">✓ Verified Faculty</span>
            </div>

            <div className="profile-role-subline">
              <span className="role-chip">Faculty Member</span>
              {profile?.designation && (
                <span className="subline-text">• {profile.designation}</span>
              )}
              {profile?.teacherDepartment && (
                <span className="subline-text">• {profile.teacherDepartment}</span>
              )}
              {profile?.collegeName && (
                <span className="subline-text">• 🏛️ {profile.collegeName}</span>
              )}
            </div>

            <div className="profile-pills-row">
              {profile?.teacherDepartment && (
                <span className="info-pill dept-pill">Dept: {profile.teacherDepartment}</span>
              )}
              {profile?.qualification && (
                <span className="info-pill qual-pill">Degree: {profile.qualification}</span>
              )}
              {profile?.cabinRoom && (
                <span className="info-pill cabin-pill">Cabin: {profile.cabinRoom}</span>
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
                Add a short introduction about your teaching philosophy, research publications, or academic specializations.
              </span>
            )}
          </p>
        </div>

        {/* ACADEMIC INTERESTS & SKILLS */}
        <div className="profile-section-card">
          <div className="section-card-head">
            <h3>💡 Specializations &amp; Academic Expertise</h3>
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
              No specializations added yet. Click &quot;Add Skills&quot; to list your teaching subjects or technical expertise.
            </p>
          )}
        </div>
      </div>

      {/* ACADEMIC STATISTICS KPI GRID */}
      <div className="academic-kpi-grid">
        <div className="kpi-card clickable" onClick={() => navigate("/teacher/manage-papers")}>
          <div className="kpi-icon-box purple">📝</div>
          <div className="kpi-meta">
            <span className="kpi-title">Papers Published / Uploaded</span>
            <strong className="kpi-digit">{profile?.papersUploaded ?? 0}</strong>
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => navigate("/teacher/evaluate")}>
          <div className="kpi-icon-box blue">✍️</div>
          <div className="kpi-meta">
            <span className="kpi-title">Evaluations Completed</span>
            <strong className="kpi-digit">{profile?.evaluationsCount ?? 0}</strong>
          </div>
        </div>

        <div className="kpi-card highlight">
          <div className="kpi-icon-box green">📊</div>
          <div className="kpi-meta">
            <span className="kpi-title">Class Pass Rate Average</span>
            <strong className="kpi-digit">{profile?.classPassRate ?? 0}%</strong>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box amber">🛡️</div>
          <div className="kpi-meta">
            <span className="kpi-title">Faculty Status</span>
            <strong className="kpi-digit status-ok">ACTIVE_STAFF</strong>
          </div>
        </div>
      </div>

      {/* DETAILS GRID */}
      <div className="profile-details-grid">
        {/* Academic & Faculty Details */}
        <div className="detail-panel-card">
          <div className="detail-card-head">
            <h3>🎓 Faculty Academic Details</h3>
          </div>
          <div className="detail-items-list">
            <div className="detail-row">
              <span className="detail-label">Designation / Title</span>
              <strong className="detail-value highlight">{profile?.designation || "Faculty Member"}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Department / Branch</span>
              <strong className="detail-value">
                {profile?.teacherDepartment || "Not specified"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Academic Qualification</span>
              <strong className="detail-value">
                {profile?.qualification || "Not specified"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Teaching Experience</span>
              <strong className="detail-value">
                {profile?.experienceYears ? `${profile.experienceYears} Years` : "Not specified"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Cabin / Office Room</span>
              <strong className="detail-value">
                {profile?.cabinRoom || "Not specified"}
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
              <span className="detail-label">Registered Institutional Email</span>
              <strong className="detail-value">{profile?.email}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Contact Phone</span>
              <strong className="detail-value">{profile?.phone || "Not provided"}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">Account Role</span>
              <strong className="detail-value role-badge-text">Faculty Staff Member</strong>
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
              <h2>✏️ Edit Faculty Profile</h2>
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
                  <label>Designation / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Assistant Professor"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Academic Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g. M.Tech, Ph.D."
                    value={editForm.qualification}
                    onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Department / Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science & Engineering"
                    value={editForm.teacherDepartment}
                    onChange={(e) => setEditForm({ ...editForm, teacherDepartment: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Cabin / Office Room</label>
                  <input
                    type="text"
                    placeholder="e.g. CS-304"
                    value={editForm.cabinRoom}
                    onChange={(e) => setEditForm({ ...editForm, cabinRoom: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>College / Institution Name</label>
                  <input
                    type="text"
                    placeholder="Enter your college name"
                    value={editForm.collegeName}
                    onChange={(e) => setEditForm({ ...editForm, collegeName: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Specializations &amp; Expertise (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Machine Learning, Cloud Computing, Database Systems"
                    value={editForm.skills}
                    onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Teaching Philosophy / Academic Summary</label>
                  <textarea
                    rows="3"
                    placeholder="Write a brief intro about your teaching focus or research interests..."
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  />
                </div>
              </div>

              {/* Protected Read-only Fields Note */}
              <div className="modal-readonly-note">
                🔒 Protected Institutional Email ({profile?.email}) is verified and locked by institution governance.
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

export default TeacherProfile;
