import { useState } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import PropTypes from "prop-types";

// Import components
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Carousel from "./components/Carousel";
import CourseList from "./components/CourseList";
import TrustedPage from "./pages/TrustedPage";
import Testimonial from "./components/Testimonial";
import FAQSection from "./components/FAQSection";
import DeleteAccount from "./components/profile/DeleteAccount";

// Import pages
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import Careers from "./pages/Careers";
import Support from "./pages/Support";
import Login from "./pages/Login";
import SignUp from "./pages/Signup";
import PricingPage from "./pages/PricingPage";
import SearchResults from "./pages/SearchResults";
import CartPage from "./pages/CartPage";
import PaymentPage from "./pages/PaymentPage";
import PersonalPlan from "./pages/PersonalPlan";
import TeamPlan from "./pages/TeamPlan";
import GiftPlan from "./pages/GiftPlan";
import CourseContent from "./pages/CourseContent";
import LessonPage from "./pages/LessonPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";

// ProtectedRoute component to handle authenticated routes
const ProtectedRoute = ({ auth, children }) => {
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children ? children : <Outlet />;
};

ProtectedRoute.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
      isVerified: PropTypes.bool,
    }),
  }).isRequired,
  children: PropTypes.node,
};

function Layout({ children, onSearch, auth, handleLogout, handleAuthSuccess }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const handleCloseModal = () => {
    setShowLogin(false);
    setShowSignup(false);
  };

  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar
        onSearch={onSearch}
        setShowLogin={setShowLogin}
        setShowSignup={setShowSignup}
        user={auth?.user}
        onLogout={handleLogout}
        onAuthSuccess={handleAuthSuccess}
        showLogin={showLogin}
      />
      <div className="main-content">
        {children}
        {showLogin && (
          <Login onClose={handleCloseModal} onAuthSuccess={handleAuthSuccess} />
        )}
        {showSignup && (
          <SignUp onClose={handleCloseModal} onAuthSuccess={handleAuthSuccess} />
        )}
      </div>
      <Footer />
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  onSearch: PropTypes.func.isRequired,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
      isVerified: PropTypes.bool,
    }),
  }),
  handleLogout: PropTypes.func,
  handleAuthSuccess: PropTypes.func,
};

export default function HomePage({
  auth,
  onAuthSuccess,
  onLogout,
  onAccountDeletion,
}) {
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = (results) => {
    setSearchResults(results);
  };

  return (
    <CartProvider>
      <Routes>
        {/* Home Route */}
        <Route
          path="/"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <Carousel />
              <CourseList />
              <TrustedPage />
              <Testimonial />
              <FAQSection />
            </Layout>
          }
        />

        {/* Courses Routes */}
        <Route
          path="/courses"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <CourseList />
            </Layout>
          }
        />
        <Route
          path="/courses/frontend"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <CourseList category="Frontend" />
            </Layout>
          }
        />
        <Route
          path="/courses/backend"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <CourseList category="Backend" />
            </Layout>
          }
        />
        <Route
          path="/courses/machine-learning"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <CourseList category="Machine Learning" />
            </Layout>
          }
        />
        <Route
          path="/courses/artificial-intelligence"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <CourseList category="Artificial Intelligence" />
            </Layout>
          }
        />
        <Route
          path="/courses/system-design"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <CourseList category="System Design" />
            </Layout>
          }
        />

        {/* Main Pages */}
        <Route
          path="/about"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <AboutUs />
            </Layout>
          }
        />
        <Route
          path="/support"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <Support />
            </Layout>
          }
        />
        <Route
          path="/pricing"
          element={
            <Layout
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <PricingPage />
            </Layout>
          }
        />
        <Route
          path="/search-results"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <SearchResults searchResults={searchResults} />
            </Layout>
          }
        />

        {/* Cart & Payment */}
        <Route
          path="/cart"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <CartPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <PaymentPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Subscription Pages */}
        <Route
          path="/subscription/personal"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <PersonalPlan />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription/team"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <TeamPlan />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription/gift"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <GiftPlan />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Legal Pages */}
        <Route
          path="/terms-and-conditions"
          element={
            <Layout
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <TermsAndConditions />
            </Layout>
          }
        />
        <Route
          path="/privacy-policy"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <PrivacyPolicy />
            </Layout>
          }
        />
        <Route
          path="/refund-policy"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <RefundPolicy />
            </Layout>
          }
        />
        <Route
          path="/about-us"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <AboutUs />
            </Layout>
          }
        />
        <Route
          path="/contact-us"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <ContactUs />
            </Layout>
          }
        />
        <Route
          path="/careers"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <Careers />
            </Layout>
          }
        />

        {/* Auth Pages */}
        <Route
          path="/login"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <Login onAuthSuccess={onAuthSuccess} />
            </Layout>
          }
        />
        <Route
          path="/signup"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <SignUp onAuthSuccess={onAuthSuccess} />
            </Layout>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <ForgotPassword />
            </Layout>
          }
        />
        <Route
          path="/verify-email"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <VerifyEmail onAuthSuccess={onAuthSuccess} />
            </Layout>
          }
        />
        <Route
          path="/reset-password"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={onLogout}
              handleAuthSuccess={onAuthSuccess}
            >
              <ResetPassword />
            </Layout>
          }
        />
        <Route
          path="/delete-account"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <DeleteAccount onDeleteSuccess={onAccountDeletion} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Course Content */}
        <Route
          path="/course/:courseId"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <CourseContent />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson/:lessonId"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={onLogout}
                handleAuthSuccess={onAuthSuccess}
              >
                <LessonPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CartProvider>
  );
}

HomePage.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
      isVerified: PropTypes.bool,
    }),
  }).isRequired,
  onAuthSuccess: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onAccountDeletion: PropTypes.func.isRequired,
};