import React from "react";
import "../styles/AdminFooter.css";

const AdminFooter = ({ isSidebarOpen }) => {
  return (
    <footer
      className="admin-footer"
      data-sidebar-open={isSidebarOpen}
      role="contentinfo"
      aria-label="Admin Footer"
    >
      <div className="admin-footer-container">
        <p>© {new Date().getFullYear()} SkillNestX. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default React.memo(AdminFooter);