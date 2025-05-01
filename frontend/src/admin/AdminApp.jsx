import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "./AdminDashboard"; // Ensure this path is correct

const AdminApp = () => {
  return (
    <Router>
      <Routes>
        {/* Redirect root path to /admin */}
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* Admin Dashboard Route */}
        <Route path="/admin/*" element={<AdminDashboard />} />

        {/* 404 - Page Not Found */}
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </Router>
  );
};

export default AdminApp;