import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/Logout.css";
import backIcon from "/assets/icons/back.svg";
import logoutIcon from "/assets/icons/logout-white.svg";

const Logout = ({ onLogout, onBack }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setError(null);

      const accessToken = localStorage.getItem("accessToken");
      const sessionToken = localStorage.getItem("sessionToken");

      try {
        await axios.post(
          `${BASE_URL}/api/auth/logout`,
          {},
          {
            withCredentials: true,
            headers: {
              Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
              "X-Session-Token": sessionToken || undefined,
            },
          }
        );
      } catch (backendErr) {
        // Proceed with client-side cleanup if backend logout fails
      }

      localStorage.removeItem("accessToken");
      localStorage.removeItem("sessionToken");

      if (typeof onLogout === "function") {
        onLogout();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="logout-container">
      <div className="logout-header">
        <button
          className="logout-back-button"
          onClick={handleBack}
          aria-label="Go back"
          disabled={isLoggingOut}
        >
          <img src={backIcon} alt="Back" className="logout-back-icon" />
        </button>
        <h2 className="logout-title">Log Out</h2>
      </div>

      <div className="logout-content">
        <p className="logout-message">
          Are you sure you want to log out?
        </p>

        {error && <div className="profile-logout-error">{error}</div>}

        <div className="logout-actions">
          <button
            className="logout-confirm-button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <div className="logout-spinner" role="status" aria-hidden="true"></div>
                <span>Logging Out...</span>
              </>
            ) : (
              <>
                <img
                  src={logoutIcon}
                  alt=""
                  className="logout-icon"
                  aria-hidden="true"
                />
                Log Out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

Logout.propTypes = {
  onLogout: PropTypes.func,
  onBack: PropTypes.func,
};

export default Logout;