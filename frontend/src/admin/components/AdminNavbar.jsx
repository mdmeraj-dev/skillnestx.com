import React, { lazy, Suspense, memo } from "react";
import "../styles/AdminNavbar.css";

// Lazy-load AdminProfile
const AdminProfile = lazy(() => import("./AdminProfile/AdminProfile"));

const AdminNavbar = ({ user, onLogout, toggleSidebar, isSidebarOpen = false }) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
      <nav
        className="admin-navbar"
        role="navigation"
        aria-label="Admin Navigation"
      >
        {/* Menu Toggle Button */}
        <button
          className="admin-navbar-menu-icon"
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          aria-expanded={isSidebarOpen}
          aria-controls="admin-sidebar"
          type="button"
        >
          <span className="material-icons" aria-hidden="true">
            {isSidebarOpen ? "chevron_left" : "menu"}
          </span>
        </button>

        {/* Brand Logo and Title */}
        <div className="admin-navbar-brand">
          <img
            src="/assets/logos/company-logo.png"
            alt="SkillNestX Logo"
            className="admin-navbar-logo"
            loading="lazy"
            onError={(e) => {
              e.target.src = "/assets/logos/fallback-logo.png"; // Fallback image
            }}
          />
          <span className="admin-navbar-title">SkillNestX</span>
        </div>

        {/* Admin Profile */}
        <div className="admin-navbar-profile">
          {user ? (
            <Suspense fallback={<div className="admin-navbar-profile-placeholder">Loading...</div>}>
              <AdminProfile user={user} onLogout={onLogout} />
            </Suspense>
          ) : (
            <div className="admin-navbar-profile-placeholder" aria-live="polite">
              Not Signed In
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

// Export with memo to prevent unnecessary re-renders
export default memo(AdminNavbar);