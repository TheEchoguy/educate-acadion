import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { verifyOtp } from "../../services/authService";
import "./VerifyOtp.css";

function VerifyOtp() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const email = localStorage.getItem("otpEmail");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const response = await verifyOtp({
        email,
        otp,
      });

      setIsVerified(true);
      toast.success(response || "OTP Verified Successfully!");

      // After OTP verification, wait 2.5s and redirect to Login Page with pending approval message!
      setTimeout(() => {
        navigate("/login?pendingApproval=true");
      }, 2500);
    } catch (error) {
      toast.error(
        error.response?.data || "OTP Verification Failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-page">
      <Toaster position="top-right" />

      {/* FLOATING BACKGROUND GLOW ORBS */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />

      <div className="verify-card">
        <div className="verify-badge">🔐 EMAIL OTP VERIFICATION</div>

        {isVerified ? (
          <div className="verified-success-box">
            <div className="success-icon-check">✅</div>
            <h2>OTP Verified Successfully!</h2>
            <p className="approval-notice-text">
              Your email has been verified. Your account is now awaiting <strong>Administrator Approval</strong>.
            </p>
            <div className="info-banner-amber">
              <span>⏳ Please wait for admin approval before logging in. You will receive an email notification once approved.</span>
            </div>
            <p className="redirecting-text">Redirecting to Login page...</p>
          </div>
        ) : (
          <>
            <h1>Verify Security OTP</h1>
            <p className="sub-heading">
              Enter the 6-digit One-Time Password sent to <span className="highlight-email">{email || "your registered email"}</span>
            </p>

            <div className="otp-info-message">
              <span>ℹ️ After verifying OTP, your account will be sent for Admin verification before login access is granted.</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Enter 6-Digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  className="otp-input-field"
                />
              </div>

              <button type="submit" className="verify-submit-btn" disabled={loading}>
                {loading ? "Verifying OTP..." : "Verify OTP & Submit"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyOtp;
