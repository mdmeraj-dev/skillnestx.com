import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import userIcon from "/assets/icons/user-dp.svg";
import settingsIcon from "/assets/icons/settings.svg";
import coursesIcon from "/assets/icons/courses.svg";
import subscriptionIcon from "/assets/icons/subscription.svg";
import certificateIcon from "/assets/icons/certificate.svg";
import deleteIcon from "/assets/icons/delete.svg";
import logoutIcon from "/assets/icons/logout.svg";
import "./styles/UserProfile.css";

import AccountSettings from "./AccountSettings";
import PurchasedCourses from "./PurchasedCourses";
import Certificates from "./Certificates";
import Subscriptions from "./Subscriptions";
import DeleteAccount from "./DeleteAccount";
import Logout from "./Logout";

// Configure Axios with base URL from environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

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
  certificates: "Certificates",
  subscriptions: "Subscriptions",
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
    const savedProfilePicture = localStorage.getItem("profilePicture");
    if (savedProfilePicture) {
      setProfilePicture(savedProfilePicture);
    } else {
      const fetchProfile = async () => {
        const accessToken = localStorage.getItem("accessToken");
        const sessionToken = localStorage.getItem("sessionToken");
        if (!accessToken || !sessionToken) {
          navigate("/login", { state: { error: "Please log in to view your profile" } });
          return;
        }
        try {
          const response = await api.get("/api/user/current", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Session-Token": sessionToken,
            },
          });
          if (response.data.success && response.data.user.profilePicture) {
            setProfilePicture(response.data.user.profilePicture);
            localStorage.setItem("profilePicture", response.data.user.profilePicture);
          } else {
            setProfilePicture(userIcon); // Fallback to default icon
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          setProfilePicture(userIcon); // Fallback to default icon on error
          if (error.response?.status === 401) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("profilePicture");
            navigate("/login", { state: { error: "Session expired. Please log in again." } });
          }
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
        !document.querySelector(".profile-icon-container")?.contains(event.target)
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
    try {
      const accessToken = localStorage.getItem("accessToken");
      const sessionToken = localStorage.getItem("sessionToken");
      if (!accessToken || !sessionToken) {
        throw new Error("No authentication tokens found. Please log in again.");
      }
      // Send relative path to backend
      const response = await api.patch(
        "/api/user/update-avatar",
        { profilePicture: avatarUrl },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Session-Token": sessionToken,
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
      console.error("Error updating avatar:", error.response?.data || error.message);
      setErrorMessage(error.response?.data?.message || "Failed to update avatar. Please try again.");
      if (error.response?.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("profilePicture");
        navigate("/login", { state: { error: "Session expired. Please log in again." } });
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
    localStorage.removeItem("profilePicture");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("sessionToken");
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
        return <PurchasedCourses user={user} onBack={handleBackClick} />;
      case menuItems.certificates:
        return <Certificates user={user} onBack={handleBackClick} />;
      case menuItems.subscriptions:
        return <Subscriptions user={user} onBack={handleBackClick} />;
      case menuItems.deleteAccount:
        return <DeleteAccount user={user} onBack={handleBackClick} />;
      case menuItems.logout:
        return <Logout onLogout={handleLogoutConfirm} onBack={handleBackClick} />;
      default:
        return null;
    }
  };

  const renderMenuItems = () => {
    const iconMap = {
      accountSettings: settingsIcon,
      purchasedCourses: coursesIcon,
      certificates: certificateIcon,
      subscriptions: subscriptionIcon,
      deleteAccount: deleteIcon,
      logout: logoutIcon,
    };
    return (
      <nav className="profile-menu">
        <ul className="profile-menu-list">
          {Object.entries(menuItems).map(([key, value]) => (
            <li
              key={key}
              className={`profile-menu-item ${key.includes("delete") ? "profile-menu-item-danger" : ""}`}
              onClick={() => handleSectionClick(value)}
            >
              <img src={iconMap[key]} alt={`${value} icon`} className="profile-menu-icon" />
              <span>{value}</span>
            </li>
          ))}
        </ul>
      </nav>
    );
  };

  return (
    <div className="profile-icon-container" ref={dropdownRef}>
      <button
        className="profile-icon-button"
        onClick={toggleDropdown}
        aria-expanded={isDropdownOpen}
        aria-label="User profile menu"
      >
        <img
          src={profilePicture}
          alt="User profile"
          className="profile-icon-image"
        />
      </button>

      {isDropdownOpen && (
        <div className="profile-dropdown" role="menu">
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-avatar">
              <button
                className="profile-dropdown-avatar-button"
                onClick={handleProfilePictureClick}
                aria-label="Change profile picture"
              >
                <img
                  src={profilePicture}
                  alt="User profile"
                  className="profile-dropdown-avatar-image"
                />
              </button>
            </div>
            <div className="profile-dropdown-user-info">
              <h3 className="profile-dropdown-user-name">{user.name}</h3>
              <p className="profile-dropdown-user-email">{user.email}</p>
            </div>
          </div>
          <div className="profile-dropdown-divider" />
          {currentView === "main" ? (
            <div className="profile-dropdown-content">{renderMenuItems()}</div>
          ) : (
            <div className="profile-dropdown-section">{renderSectionContent()}</div>
          )}
        </div>
      )}

      {/* Avatar Selection Modal */}
      {isModalOpen && (
        <div className="avatar-modal-overlay">
          <div className="avatar-modal">
            {isUploading && (
              <div className="avatar-spinner" aria-label="Uploading avatar"></div>
            )}
            <h3>Choose the avatar you like</h3>
            {errorMessage && (
              <p className="error">{errorMessage}</p>
            )}
            <div className="avatar-options">
              <div className="avatar-row">
                <div className="avatar-row-options">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar.url}
                      className="avatar-option-button"
                      onClick={() => handleAvatarSelect(avatar.url)}
                      disabled={isUploading}
                    >
                      <img src={avatar.url} alt={avatar.name} className="avatar-option-image" />
                      <span>{avatar.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="avatar-modal-close"
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