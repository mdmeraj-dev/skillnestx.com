import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import profileIcon from "/assets/icons/profile-white.svg";
import settingsIcon from "/assets/icons/settings-white.svg";
import deleteIcon from "/assets/icons/delete-red.svg";
import logoutIcon from "/assets/icons/logout-white.svg";
import "./styles/AdminProfile.css";

import AdminAccountSettings from "./components/AdminAccountSettings";
import AdminDeleteAccount from "./components/AdminDeleteAccount";
import AdminLogout from "./components/AdminLogout";

// Logger for consistency with App.jsx
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[WARN] ${msg}`, meta);
    }
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[DEBUG] ${msg}`, meta);
    }
  },
};

// Configure Axios with base URL and interceptor from App.jsx
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
});

// Axios interceptor for token refresh (same as App.jsx)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/api/auth/refresh-token" &&
      originalRequest.url !== "/api/auth/logout"
    ) {
      originalRequest._retry = true;
      const traceId = crypto.randomUUID();
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          logger.warn("No refresh token for interceptor", { traceId });
          throw new Error("Missing refresh token");
        }
        logger.debug("Attempting token refresh in interceptor", { traceId });
        const refreshResponse = await api.post(
          "/api/auth/refresh-token",
          { refreshToken },
          {
            headers: {
              "X-Trace-Id": traceId,
              "Content-Type": "application/json",
            },
          }
        );
        const refreshData = refreshResponse.data;
        if (refreshResponse.status === 200 && refreshData.success) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          localStorage.setItem("refreshToken", refreshData.refreshToken);
          logger.debug("Interceptor refreshed tokens", { traceId });
          originalRequest.headers["Authorization"] = `Bearer ${refreshData.accessToken}`;
          return api(originalRequest);
        }
        logger.warn("Interceptor token refresh failed", {
          traceId,
          status: refreshResponse.status,
          data: refreshData,
        });
        throw new Error("Refresh failed");
      } catch (refreshError) {
        logger.error("Interceptor refresh error", {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("profilePicture");
        window.dispatchEvent(
          new CustomEvent("navigate", {
            detail: {
              path: "/login",
              state: { error: "Session expired. Please log in again." },
              replace: true,
            },
          })
        );
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Define all available avatars
const avatars = [
  { url: "/assets/avatars/boy-1.svg", name: "Avatar 1" },
  { url: "/assets/avatars/boy-2.svg", name: "Avatar 2" },
  { url: "/assets/avatars/boy-3.svg", name: "Avatar 3" },
  { url: "/assets/avatars/girl-1.svg", name: "Avatar 4" },
  { url: "/assets/avatars/girl-2.svg", name: "Avatar 5" },
  { url: "/assets/avatars/girl-3.svg", name: "Avatar 6" },
];

const menuItems = {
  accountSettings: "Account Settings",
  deleteAccount: "Delete Account",
  logout: "Log out",
};

const AdminProfile = ({
  onAdminLogout,
  user = {
    name: "Guest User",
    email: "guest@example.com",
  },
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [activeSection, setActiveSection] = useState(null);
  const [profilePicture, setProfilePicture] = useState(profileIcon);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Prevent body scrolling when avatar modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add("admin-profile-modal-open");
    } else {
      document.body.classList.remove("admin-profile-modal-open");
    }
    return () => {
      document.body.classList.remove("admin-profile-modal-open");
    };
  }, [isModalOpen]);

  // Load profile picture from localStorage or fetch from backend on mount
  useEffect(() => {
    const savedProfilePicture = localStorage.getItem("profilePicture");
    if (savedProfilePicture) {
      setProfilePicture(savedProfilePicture);
    } else {
      const fetchProfile = async () => {
        const traceId = crypto.randomUUID();
        try {
          const accessToken = localStorage.getItem("accessToken");
          const refreshToken = localStorage.getItem("refreshToken");
          const response = await api.get("/api/users/current", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-refresh-token": refreshToken,
              "X-Trace-Id": traceId,
            },
          });
          if (response.data.success && response.data.user.profilePicture) {
            setProfilePicture(response.data.user.profilePicture);
            localStorage.setItem("profilePicture", response.data.user.profilePicture);
          } else {
            setProfilePicture(profileIcon);
          }
        } catch (error) {
          logger.error("Error fetching profile", {
            error: error.message,
            traceId,
            response: error.response?.data,
          });
          setProfilePicture(profileIcon);
        }
      };
      fetchProfile();
    }
  }, [navigate]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !document
          .querySelector(".admin-profile-icon-container")
          ?.contains(event.target)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeDropdown = () => {
    setIsDropdownOpen(false);
    setCurrentView("main");
    setActiveSection(null);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
    if (!isDropdownOpen) {
      setCurrentView("main");
      setActiveSection(null);
    }
  };

  const handleProfilePictureClick = () => {
    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const handleAvatarSelect = async (avatarUrl) => {
    setIsUploading(true);
    setErrorMessage(null);
    const traceId = crypto.randomUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const response = await api.patch(
        "/api/users/update-profile",
        { profilePicture: avatarUrl },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-refresh-token": refreshToken,
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
        }
      );
      if (response.data.success) {
        const newProfilePicture = response.data.user.profilePicture;
        setProfilePicture(newProfilePicture);
        localStorage.setItem("profilePicture", newProfilePicture);
        setIsModalOpen(false);
      } else {
        throw new Error(response.data.message || "Failed to update avatar");
      }
    } catch (error) {
      logger.error("Error updating avatar", {
        error: error.message,
        traceId,
        response: error.response?.data,
      });
      setErrorMessage(
        error.response?.data?.message ||
          "Failed to update avatar. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSectionClick = (section) => {
    setCurrentView("section");
    setActiveSection(section);
  };

  const handleBackClick = () => {
    setCurrentView("main");
    setActiveSection(null);
  };

  const handleAdminLogoutConfirm = () => {
    localStorage.removeItem("profilePicture");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setProfilePicture(profileIcon);
    onAdminLogout();
    closeDropdown();
  };

  const renderSectionContent = () => {
    if (currentView !== "section" || !activeSection) return null;
    switch (activeSection) {
      case menuItems.accountSettings:
        return <AdminAccountSettings user={user} onBack={handleBackClick} />;
      case menuItems.deleteAccount:
        return <AdminDeleteAccount user={user} onBack={handleBackClick} />;
      case menuItems.logout:
        return (
          <AdminLogout onAdminLogout={handleAdminLogoutConfirm} onBack={handleBackClick} />
        );
      default:
        return null;
    }
  };

  const renderMenuItems = () => {
    const iconMap = {
      accountSettings: settingsIcon,
      deleteAccount: deleteIcon,
      logout: logoutIcon,
    };
    return (
      <nav className="admin-profile-menu">
        <ul className="admin-profile-menu-list">
          {Object.entries(menuItems).map(([key, value]) => (
            <li
              key={key}
              className={`admin-profile-menu-item ${
                key.includes("delete") ? "admin-profile-menu-item-danger" : ""
              }`}
              onClick={() => handleSectionClick(value)}
            >
              <img
                src={iconMap[key]}
                alt={`${value} icon`}
                className="admin-profile-menu-icon"
              />
              <span>{value}</span>
            </li>
          ))}
        </ul>
      </nav>
    );
  };

  return (
    <div className="admin-profile-icon-container" ref={dropdownRef}>
      <button
        className="admin-profile-icon-button"
        onClick={toggleDropdown}
        aria-expanded={isDropdownOpen}
        aria-label="User profile menu"
      >
        <img
          src={profilePicture}
          alt="User profile"
          className="admin-profile-icon-image"
        />
      </button>

      {isDropdownOpen && (
        <div className="admin-profile-dropdown" role="menu">
          <div className="admin-profile-dropdown-header">
            <div className="admin-profile-dropdown-avatar">
              <button
                className="admin-profile-dropdown-avatar-button"
                onClick={handleProfilePictureClick}
                aria-label="Change profile picture"
              >
                <img
                  src={profilePicture}
                  alt="User profile"
                  className="admin-profile-dropdown-avatar-image"
                />
              </button>
            </div>
            <div className="admin-profile-dropdown-user-info">
              <h3 className="admin-profile-dropdown-user-name">{user.name}</h3>
              <p className="admin-profile-dropdown-user-email">{user.email}</p>
            </div>
          </div>
          <div className="admin-profile-dropdown-divider" />
          {currentView === "main" ? (
            <div className="admin-profile-dropdown-content">{renderMenuItems()}</div>
          ) : (
            <div className="admin-profile-dropdown-section">
              {renderSectionContent()}
            </div>
          )}
        </div>
      )}

      {/* Avatar Selection Modal */}
      {isModalOpen && (
        <div className="admin-profile-avatar-modal-overlay">
          <div
            className="admin-profile-avatar-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Avatar selection modal"
          >
            {isUploading && (
              <div
                className="admin-profile-avatar-spinner"
                aria-label="Uploading avatar"
              ></div>
            )}
            <h3>Choose the avatar you like</h3>
            {errorMessage && (
              <p className="admin-profile-error">{errorMessage}</p>
            )}
            <div className="admin-profile-avatar-options">
              <div className="admin-profile-avatar-row">
                <div className="admin-profile-avatar-row-options">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar.url}
                      className="admin-profile-avatar-option-button"
                      onClick={() => handleAvatarSelect(avatar.url)}
                      disabled={isUploading}
                      aria-label={`Select ${avatar.name}`}
                    >
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        className="admin-profile-avatar-option-image"
                      />
                      <span>{avatar.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="admin-profile-avatar-modal-close"
              onClick={() => {
                setIsModalOpen(false);
                setErrorMessage(null);
              }}
              disabled={isUploading}
              aria-label="Close avatar selection modal"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

AdminProfile.propTypes = {
  onAdminLogout: PropTypes.func,
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
  }),
};

export default AdminProfile;