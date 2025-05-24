import React, { useEffect, useState, memo } from "react";
import { NavLink } from "react-router-dom";
import "../styles/AdminSidebar.css";

const AdminSidebar = ({ isOpen, toggleSidebar }) => {
  const [sidebarOpen, setSidebarOpen] = useState(isOpen);

  // Sync sidebar state with prop and handle resize
  useEffect(() => {
    setSidebarOpen(isOpen);

    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (window.innerWidth < 768 && isOpen) {
          toggleSidebar(); // Close sidebar on mobile/tablet resize
        }
      }, 200); // Debounce for performance
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, [isOpen, toggleSidebar]);

  const navItems = [
    { path: "/admin/home", label: "Dashboard", icon: "dashboard" },
    { path: "/admin/users", label: "Users", icon: "people" },
    { path: "/admin/courses", label: "Courses", icon: "book" },
    { path: "/admin/subscriptions", label: "Subscriptions", icon: "subscriptions" },
     { path: "/admin/testimonials", label: "Testimonials", icon: "star" },
    { path: "/admin/transactions", label: "Transactions", icon: "payment" },
   
  ];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
      <aside
        className={`admin-sidebar ${sidebarOpen ? "admin-sidebar-open" : "admin-sidebar-closed"}`}
        role="complementary"
        aria-label="Admin Sidebar Navigation"
        id="admin-sidebar"
      >
        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `admin-sidebar-nav-link ${isActive ? "admin-sidebar-nav-link-active" : ""}`
              }
              onClick={() => window.innerWidth < 768 && toggleSidebar()}
              aria-label={`Navigate to ${item.label}`}
              aria-current={({ isActive }) => (isActive ? "page" : undefined)}
            >
              <span
                className="admin-sidebar-nav-icon material-icons"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="admin-sidebar-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default memo(AdminSidebar);