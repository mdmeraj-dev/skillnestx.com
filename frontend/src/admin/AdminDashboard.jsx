import  { useState } from 'react'; // Import useState for sidebar toggle
import './AdminDashboard.css'; // Import your CSS file
import { Routes, Route } from 'react-router-dom'; // Import routing components

// Import your components (replace with your actual file paths)
import AdminSidebar from './components/AdminSidebar';
import AdminNavbar from './components/AdminNavbar';
import AdminFooter from './components/AdminFooter';

// Import your main content components
import DashboardOverview from './pages/DashboardOverview';
import UserManagement from './pages/UserManagement';
import CourseManagement from './pages/CourseManagement';
import SubscriptionManagement from './pages/SubscriptionManagement';
import TransactionManagement from './pages/TransactionManagement';

const AdminDashboard = () => {
  // State to manage sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Function to toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className={`admin-sidebar ${isSidebarOpen ? 'active' : ''}`}>
        <AdminSidebar />
      </div>

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Navbar */}
        <div className="admin-navbar">
          <AdminNavbar toggleSidebar={toggleSidebar} />
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Define your routes here */}
          <Routes>
            {/* Default route for the admin dashboard */}
            <Route path="/" element={<DashboardOverview />} />

            {/* Routes for other admin pages */}
            <Route path="/users" element={<UserManagement />} />
            <Route path="/courses" element={<CourseManagement />} />
            <Route path="/subscriptions" element={<SubscriptionManagement />} />
            <Route path="/transactions" element={<TransactionManagement />} />

            {/* 404 - Page Not Found */}
            <Route path="*" element={<h1>404 - Admin Page Not Found</h1>} />
          </Routes>
        </div>

        {/* Footer */}
        <div className="admin-footer">
          <AdminFooter />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;