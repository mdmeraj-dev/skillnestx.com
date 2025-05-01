import { Link, useLocation } from "react-router-dom";

import dashboardIcon from "../assets/icons/dashboard.svg";
import usersIcon from "../assets/icons/users.svg";
import coursesIcon from "../assets/icons/courses.svg";
import subscriptionsIcon from "../assets/icons/subscriptions.svg";
import transactionsIcon from "../assets/icons/transactions.svg";
import discountIcon from "../assets/icons/discount.svg";
import helpIcon from "../assets/icons/help.svg";
import logoutIcon from "../assets/icons/logout.svg";

const AdminSidebar = () => {
  const location = useLocation(); // Get current path

  return (
    <div className="admin-sidebar">
     

      {/* Navigation Links */}
      <ul className="sidebar-menu">
        <li className={location.pathname === "/admin" ? "active" : ""}>
          <Link to="/admin">
            <img src={dashboardIcon} alt="Dashboard" />
            <span>Dashboard</span>
          </Link>
        </li>

        <li className={location.pathname === "/admin/users" ? "active" : ""}>
          <Link to="/admin/users">
            <img src={usersIcon} alt="Users" />
            <span>Users</span>
          </Link>
        </li>

       

        <li className={location.pathname === "/admin/courses" ? "active" : ""}>
          <Link to="/admin/courses">
            <img src={coursesIcon} alt="Courses" />
            <span>Courses</span>
          </Link>
        </li>

        <li className={location.pathname === "/admin/subscriptions" ? "active" : ""}>
          <Link to="/admin/subscriptions">
            <img src={subscriptionsIcon} alt="Subscriptions" />
            <span>Subscriptions</span>
          </Link>
        </li>

        <li className={location.pathname === "/admin/transactions" ? "active" : ""}>
          <Link to="/admin/transactions">
            <img src={transactionsIcon} alt="Transactions" />
            <span>Transactions</span>
          </Link>
        </li>

        <li className={location.pathname === "/admin/discount-codes" ? "active" : ""}>
          <Link to="/admin/discount-codes">
            <img src={discountIcon} alt="Discount Codes" />
            <span>Discount Codes</span>
          </Link>
        </li>

        <li className={location.pathname === "/admin/help-feedback" ? "active" : ""}>
          <Link to="/admin/help-feedback">
            <img src={helpIcon} alt="Help & Feedback" />
            <span>Help & Feedback</span>
          </Link>
        </li>
      </ul>

      {/* Logout Button */}
      <div className="logout-section">
        <button className="logout-button" onClick={() => alert("Logout Clicked")}>
          <img src={logoutIcon} alt="Logout" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;