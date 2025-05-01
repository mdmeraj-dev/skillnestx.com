import PropTypes from 'prop-types'; // Import PropTypes
import MenuIcon from '../assets/icons/menu.svg'; // Import menu icon
import CloseIcon from '../assets/icons/close.svg'; // Import close icon
import NotificationIcon from '../assets/icons/notification.svg'; // Import notification icon
import AdminAvatar from '../assets/icons/profile.svg'; // Import admin avatar

const AdminNavbar = ({ onToggleSidebar, isSidebarVisible }) => {
  return (
    <div className="admin-navbar">
      {/* Navbar Left Section */}
      <div className="navbar-left">
        {/* Menu Icon (Visible in Mobile View) */}
        <button className="menu-icon" onClick={onToggleSidebar} aria-label="Toggle Sidebar">
          <img
            src={isSidebarVisible ? CloseIcon : MenuIcon} // Toggle between menu and close icon
            alt={isSidebarVisible ? 'Close' : 'Menu'}
          />
        </button>
      </div>

      {/* Navbar Center Section */}
      <div className="navbar-center">
        {/* Company Name */}
        <h1 className="company-name">SkillNestX</h1>
      </div>

      {/* Navbar Right Section */}
      <div className="navbar-right">
        {/* Notification Icon */}
        <button className="notification-icon" aria-label="Notifications">
          <img src={NotificationIcon} alt="Notifications" />
          <span className="notification-count">3</span> {/* Notification count */}
        </button>

        {/* Admin Account */}
        <div className="admin-account">
          <img src={AdminAvatar} alt="Admin Avatar" className="admin-avatar" />
          <span className="admin-name">John Doe</span>
        </div>
      </div>
    </div>
  );
};

// PropTypes Validation
AdminNavbar.propTypes = {
  onToggleSidebar: PropTypes.func.isRequired, // onToggleSidebar must be a function
  isSidebarVisible: PropTypes.bool.isRequired, // isSidebarVisible must be a boolean
};

export default AdminNavbar;