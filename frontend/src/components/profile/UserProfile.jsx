import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import userIcon from "/assets/icons/user-dp.svg";
import "./styles/UserProfile.css";

import AccountSettings from "./AccountSettings";
import Certificates from "./Certificates";
import Subscriptions from "./Subscriptions";
import PurchasedCourses from "./PurchasedCourses";
import DeleteAccount from "./DeleteAccount";
import Logout from "./Logout";

// Logger aligned with App.jsx
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

// Configure Axios with base URL from environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
});

// Axios interceptor for token refresh on 401
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
          originalRequest.headers[
            "Authorization"
          ] = `Bearer ${refreshData.accessToken}`;
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
  purchasedCourses: "Purchased Courses",
  subscriptions: "Subscriptions",
  certificates: "Certificates",
  deleteAccount: "Delete Account",
  logout: "Log out",
};

const UserProfile = ({
  onLogout,
  user = {
    name: "Guest User",
    email: "guest@example.com",
  },
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [activeSection, setActiveSection] = useState(null);
  const [profilePicture, setProfilePicture] = useState(userIcon);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Validate BASE_URL
  useEffect(() => {
    if (!api.defaults.baseURL && process.env.NODE_ENV !== "production") {
      logger.error(
        "VITE_BACKEND_URL is not defined in environment variables",
        {}
      );
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  // Prevent body scrolling when avatar modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isModalOpen]);

  // Load profile picture from localStorage or fetch from backend on mount
  useEffect(() => {
    const cacheKey = "userProfilePicture";
    const cachedProfile = localStorage.getItem(cacheKey);

    const fetchProfile = async () => {
      const traceId = crypto.randomUUID();
      const accessToken = localStorage.getItem("accessToken");

      try {
        // Load cached profile picture immediately
        if (cachedProfile) {
          const parsedProfile = JSON.parse(cachedProfile);
          if (parsedProfile?.profilePicture) {
            setProfilePicture(parsedProfile.profilePicture);
            logger.debug("Loaded profile picture from cache", {
              traceId,
              profilePicture: parsedProfile.profilePicture,
            });
          }
        }

        // Delay for Google OAuth redirect to allow backend sync
        if (
          location.search.includes("accessToken") &&
          location.search.includes("refreshToken")
        ) {
          logger.debug("Detected OAuth redirect, delaying profile fetch", {
            traceId,
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        logger.debug("Fetching profile", {
          traceId,
          accessToken: accessToken.substring(0, 10) + "...",
        });
        const response = await api.get("/api/users/current", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
        });

        if (response.data.success && response.data.user.profilePicture) {
          const newProfilePicture = response.data.user.profilePicture;
          setProfilePicture(newProfilePicture);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ profilePicture: newProfilePicture })
          );
          logger.debug("Profile fetched successfully", {
            traceId,
            profilePicture: newProfilePicture,
          });
        } else {
          setProfilePicture(userIcon);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ profilePicture: userIcon })
          );
          logger.debug("No profile picture in response, using default", {
            traceId,
          });
        }
      } catch (error) {
        logger.error("Error fetching profile", {
          error: error.message,
          traceId,
          response: error.response?.data,
        });
        if (!cachedProfile) {
          setProfilePicture(userIcon);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ profilePicture: userIcon })
          );
          logger.warn("No cache, using default profile picture", { traceId });
        }
        if (error.response?.status !== 401) {
          logger.warn("Non-401 error, keeping cached or default picture", {
            traceId,
          });
        }
        // Interceptor handles 401 errors, no additional action needed
      }
    };

    fetchProfile();
  }, [navigate, location.search]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !document
          .querySelector(".user-profile-icon-container")
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

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("profilePicture");
  };

  const handleProfilePictureClick = () => {
    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const handleAvatarSelect = async (avatarUrl) => {
    const traceId = crypto.randomUUID();
    setIsUploading(true);
    setErrorMessage(null);
    const accessToken = localStorage.getItem("accessToken");

    try {
      logger.debug("Updating avatar", { avatarUrl, traceId });
      const response = await api.patch(
        "/api/users/update-profile",
        { profilePicture: avatarUrl },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.success) {
        const newProfilePicture = response.data.user.profilePicture;
        setProfilePicture(newProfilePicture);
        localStorage.setItem("profilePicture", newProfilePicture);
        logger.debug("Avatar updated successfully", {
          traceId,
          profilePicture: newProfilePicture,
        });
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
      if (error.response?.status === 401) {
        logger.debug("Received 401 for avatar update, relying on interceptor", {
          traceId,
        });
        setErrorMessage("Session expired. Please log in again.");
      } else if (error.response?.status === 404) {
        setErrorMessage(
          "Avatar update endpoint not found. Please contact support."
        );
      } else if (error.response?.status === 429) {
        setErrorMessage("Too many requests. Please try again later.");
      } else {
        setErrorMessage(
          error.response?.data?.message ||
            "Failed to update avatar. Please try again."
        );
      }
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

  const handleLogoutConfirm = () => {
    handleLogout();
    setProfilePicture(userIcon);
    onLogout();
    closeDropdown();
  };

  const renderSectionContent = () => {
    if (currentView !== "section" || !activeSection) return null;
    switch (activeSection) {
      case menuItems.accountSettings:
        return <AccountSettings user={user} onBack={handleBackClick} />;
      case menuItems.purchasedCourses:
        return <PurchasedCourses user={user} onBack={handleBackClick} closeDropdown={closeDropdown} />;
      case menuItems.subscriptions:
        return <Subscriptions user={user} onBack={handleBackClick} closeDropdown={closeDropdown} />;
      case menuItems.certificates:
        return <Certificates user={user} onBack={handleBackClick} />;
      case menuItems.deleteAccount:
        return <DeleteAccount user={user} onBack={handleBackClick} />;
      case menuItems.logout:
        return (
          <Logout onLogout={handleLogoutConfirm} onBack={handleBackClick} />
        );
      default:
        return null;
    }
  };

  const renderMenuItems = () => {
    const iconMap = {
      accountSettings: "settings",
      purchasedCourses: "library_books",
      subscriptions: "subscriptions",
      certificates: "school",
      deleteAccount: "delete",
      logout: "logout",
    };
    return (
      <nav className="user-profile-menu">
        <ul className="user-profile-menu-list">
          {Object.entries(menuItems).map(([key, value]) => (
            <li
              key={key}
              className={`user-profile-menu-item ${
                key.includes("delete") ? "user-profile-menu-item-danger" : ""
              }`}
              onClick={() => handleSectionClick(value)}
            >
              <span className="material-icons user-profile-menu-icon">
                {iconMap[key]}
              </span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      </nav>
    );
  };

  return (
    <div className="user-profile-icon-container" ref={dropdownRef}>
      <button
        className="user-profile-icon-button"
        onClick={toggleDropdown}
        aria-expanded={isDropdownOpen}
        aria-label="User profile menu"
      >
        <img
          src={profilePicture}
          alt="User profile"
          className="user-profile-icon-image"
        />
      </button>

      {isDropdownOpen && (
        <div className="user-profile-dropdown" role="menu">
          <div className="user-profile-dropdown-header">
            <div className="user-profile-dropdown-avatar">
              <button
                className="user-profile-dropdown-avatar-button"
                onClick={handleProfilePictureClick}
                aria-label="Change profile picture"
              >
                <img
                  src={profilePicture}
                  alt="User profile"
                  className="user-profile-dropdown-avatar-image"
                />
              </button>
            </div>
            <div className="user-profile-dropdown-user-info">
              <h3 className="user-profile-dropdown-user-name">{user.name}</h3>
              <p className="user-profile-dropdown-user-email">{user.email}</p>
            </div>
          </div>
          <div className="user-profile-dropdown-divider" />
          {currentView === "main" ? (
            <div className="user-profile-dropdown-content">{renderMenuItems()}</div>
          ) : (
            <div className="user-profile-dropdown-section">
              {renderSectionContent()}
            </div>
          )}
        </div>
      )}

      {/* Avatar Selection Modal */}
      {isModalOpen && (
        <div className="user-avatar-modal-overlay">
          <div className="user-avatar-modal">
            {isUploading && (
              <div
                className="user-avatar-spinner"
                aria-label="Uploading avatar"
              ></div>
            )}
            <h3>Choose the avatar you like</h3>
            {errorMessage && <p className="error">{errorMessage}</p>}
            <div className="user-avatar-options">
              <div className="user-avatar-row">
                <div className="user-avatar-row-options">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar.url}
                      className="user-avatar-option-button"
                      onClick={() => handleAvatarSelect(avatar.url)}
                      disabled={isUploading}
                    >
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        className="user-avatar-option-image"
                      />
                      <span>{avatar.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="user-avatar-modal-close"
              onClick={() => {
                setIsModalOpen(false);
                setErrorMessage(null);
              }}
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

UserProfile.propTypes = {
  onLogout: PropTypes.func.isRequired,
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
  }),
};

export default UserProfile;