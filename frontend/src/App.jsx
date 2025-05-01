import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet,
} from "react-router-dom";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { CartProvider } from "./contexts/CartContext";
import { jwtDecode } from "jwt-decode";

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
import TermsOfService from "./pages/TermsOfService";
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
import AdminDashboard from "./admin/AdminDashboard";

import "./App.css";

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
    user: PropTypes.object,
  }).isRequired,
  children: PropTypes.node,
};

// Layout component to handle common UI structure
function Layout({
  children,
  onSearch,
  auth,
  handleLogout,
  handleAuthSuccess,
  setShowLogin = () => {},
  setShowSignup = () => {},
  searchResults = [],
}) {
  const [showLogin, setShowLoginLocal] = useState(false);
  const [showSignup, setShowSignupLocal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/login") {
      setShowLoginLocal(true);
      setShowSignupLocal(false);
    } else if (location.pathname === "/signup") {
      setShowLoginLocal(false);
      setShowSignupLocal(true);
    } else {
      setShowLoginLocal(false);
      setShowSignupLocal(false);
    }
  }, [location.pathname]);

  const handleCloseModal = () => {
    setShowLoginLocal(false);
    setShowSignupLocal(false);
    setShowLogin(false);
    setShowSignup(false);
  };

  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar
        onSearch={onSearch}
        setShowLogin={setShowLogin || setShowLoginLocal}
        setShowSignup={setShowSignup || setShowSignupLocal}
        user={auth?.user}
        onLogout={handleLogout}
        onAuthSuccess={handleAuthSuccess}
      />
      <div className="main-content">
        {children}
        {showLogin && (
          <Login
            onClose={handleCloseModal}
            setShowLogin={setShowLoginLocal}
            onAuthSuccess={handleAuthSuccess}
          />
        )}
        {showSignup && (
          <SignUp
            onClose={handleCloseModal}
            setShowSignup={setShowSignupLocal}
            onAuthSuccess={handleAuthSuccess}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  onSearch: PropTypes.func.isRequired,
  searchResults: PropTypes.array,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
  handleLogout: PropTypes.func,
  handleAuthSuccess: PropTypes.func,
  setShowLogin: PropTypes.func,
  setShowSignup: PropTypes.func,
};

// Main App component
function App() {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Initialize auth state
  let initialAuth = { user: null, isAuthenticated: false };
  const accessToken = localStorage.getItem("accessToken");
  const sessionToken = localStorage.getItem("sessionToken");
  if (accessToken && sessionToken) {
    try {
      const decoded = jwtDecode(accessToken);
      // Check token expiration
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("keepLoggedIn");
      } else {
        initialAuth = {
          user: {
            _id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          },
          isAuthenticated: true,
        };
      }
    } catch (error) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("keepLoggedIn");
    }
  }

  const [auth, setAuth] = useState(initialAuth);

  useEffect(() => {
    const verifyUser = async () => {
      const traceId = Math.random().toString(36).substring(2);
      try {
        const params = new URLSearchParams(location.search);
        const accessTokenFromQuery = params.get("accessToken");
        const sessionTokenFromQuery = params.get("sessionToken");
        const errorMessage = params.get("error");

        // Handle Google OAuth or VerifyEmail redirect
        if (accessTokenFromQuery && sessionTokenFromQuery) {
          try {
            const response = await fetch(`${BASE_URL}/api/user/current`, {
              method: "GET",
              credentials: "include",
              headers: {
                Authorization: `Bearer ${accessTokenFromQuery}`,
                "X-Session-Token": sessionTokenFromQuery,
                "X-Trace-Id": traceId,
              },
            });

            const data = await response.json();
            if (response.ok && data.success) {
              setAuth({
                user: data.user,
                isAuthenticated: true,
              });
              localStorage.setItem("accessToken", accessTokenFromQuery);
              localStorage.setItem("sessionToken", sessionTokenFromQuery);
              if (localStorage.getItem("keepLoggedIn") !== "true") {
                localStorage.removeItem("keepLoggedIn");
              }
              const redirectPath =
                location.pathname === "/login" ||
                location.pathname === "/verify-email"
                  ? "/"
                  : location.pathname;
              navigate(redirectPath, { replace: true });
            } else {
              throw new Error(data.message || "Failed to authenticate");
            }
          } catch (error) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("keepLoggedIn");
            navigate("/login", {
              replace: true,
              state: { error: error.message },
            });
          }
          return;
        } else if (errorMessage) {
          navigate("/login", {
            replace: true,
            state: { error: decodeURIComponent(errorMessage) },
          });
          return;
        }

        // Verify existing tokens or attempt refresh
        if (accessToken && sessionToken) {
          try {
            const response = await fetch(`${BASE_URL}/api/user/current`, {
              method: "GET",
              credentials: "include",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "X-Session-Token": sessionToken,
                "X-Trace-Id": traceId,
              },
            });

            const data = await response.json();
            if (response.ok && data.success) {
              setAuth({
                user: data.user,
                isAuthenticated: true,
              });
              return;
            } else if (
              response.status === 401 &&
              data.code === "INVALID_SESSION_TOKEN"
            ) {
              const refreshData = await refreshTokens(traceId);
              if (refreshData) {
                const retryResponse = await fetch(
                  `${BASE_URL}/api/user/current`,
                  {
                    method: "GET",
                    credentials: "include",
                    headers: {
                      Authorization: `Bearer ${refreshData.accessToken}`,
                      "X-Session-Token": refreshData.sessionToken,
                      "X-Trace-Id": traceId,
                    },
                  }
                );
                const retryData = await retryResponse.json();
                if (retryResponse.ok && retryData.success) {
                  setAuth({
                    user: retryData.user,
                    isAuthenticated: true,
                  });
                  return;
                }
              }
              throw new Error("Token refresh failed");
            } else {
              throw new Error(data.message || "Authentication failed");
            }
          } catch (error) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("keepLoggedIn");
            setAuth({ user: null, isAuthenticated: false });
          }
        } else {
          // Skip refresh if no tokens are present and no keepLoggedIn flag
          if (localStorage.getItem("keepLoggedIn") !== "true") {
            setAuth({ user: null, isAuthenticated: false });
          } else {
            // Attempt refresh if cookies are present and keepLoggedIn is true
            const refreshData = await refreshTokens(traceId);
            if (refreshData) {
              const response = await fetch(`${BASE_URL}/api/user/current`, {
                method: "GET",
                credentials: "include",
                headers: {
                  Authorization: `Bearer ${refreshData.accessToken}`,
                  "X-Session-Token": refreshData.sessionToken,
                  "X-Trace-Id": traceId,
                },
              });
              const data = await response.json();
              if (response.ok && data.success) {
                setAuth({
                  user: data.user,
                  isAuthenticated: true,
                });
                localStorage.setItem("accessToken", refreshData.accessToken);
                localStorage.setItem("sessionToken", refreshData.sessionToken);
                return;
              }
            }
            setAuth({ user: null, isAuthenticated: false });
          }
        }
      } catch (error) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("keepLoggedIn");
        setAuth({ user: null, isAuthenticated: false });
      } finally {
        setLoading(false);
      }
    };

    // Helper function to refresh tokens
    const refreshTokens = async (traceId) => {
      try {
        const refreshResponse = await fetch(
          `${BASE_URL}/api/auth/refresh-token`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              "X-Trace-Id": traceId,
            },
          }
        );
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok && refreshData.success) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          localStorage.setItem("sessionToken", refreshData.sessionToken);
          return refreshData;
        }
        return null;
      } catch (error) {
        return null;
      }
    };

    verifyUser();
  }, [location, navigate, BASE_URL]);

  const handleAuthSuccess = (userData) => {
    setAuth({
      user: userData.user,
      isAuthenticated: true,
    });
    localStorage.setItem(
      "accessToken",
      userData.accessToken || localStorage.getItem("accessToken")
    );
    localStorage.setItem(
      "sessionToken",
      userData.sessionToken || localStorage.getItem("sessionToken")
    );
    if (userData.redirectUrl) {
      const redirectPath = new URL(userData.redirectUrl).pathname;
      navigate(redirectPath, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleLogout = async () => {
    const traceId = Math.random().toString(36).substring(2);
    const accessToken = localStorage.getItem("accessToken");
    const sessionToken = localStorage.getItem("sessionToken");

    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
          "X-Session-Token": sessionToken || undefined,
          "X-Trace-Id": traceId,
        },
      });
    } catch (error) {
      // Silently handle logout error
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("keepLoggedIn");
    localStorage.removeItem("profilePicture");
    setAuth({ user: null, isAuthenticated: false });
    setShowLogin(false);
    setShowSignup(false);
  };

  const handleAccountDeletion = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("keepLoggedIn");
    localStorage.removeItem("profilePicture");
    setAuth({ user: null, isAuthenticated: false });
    setShowLogin(false);
    setShowSignup(false);
  };

  const handleSearch = (results) => {
    setSearchResults(results);
  };

  const handleCourseClick = (courseId, course) => {
    navigate(`/course/${courseId}`, { state: { course } });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <Carousel />
              <CourseList onCourseClick={handleCourseClick} auth={auth} />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseList onCourseClick={handleCourseClick} auth={auth} />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseList
                category="Frontend"
                onCourseClick={handleCourseClick}
                auth={auth}
              />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseList
                category="Backend"
                onCourseClick={handleCourseClick}
                auth={auth}
              />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseList
                category="Machine Learning"
                onCourseClick={handleCourseClick}
                auth={auth}
              />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseList
                category="Artificial Intelligence"
                onCourseClick={handleCourseClick}
                auth={auth}
              />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseList
                category="System Design"
                onCourseClick={handleCourseClick}
                auth={auth}
              />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <Support />
            </Layout>
          }
        />
        <Route
          path="/pricing"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <SearchResults
                searchResults={searchResults}
                onCourseClick={handleCourseClick}
              />
            </Layout>
          }
        />

        {/* Cart & Payment */}
        <Route
          path="/cart"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CartPage />
            </Layout>
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
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
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
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
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
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
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
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <GiftPlan />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Legal Pages */}
        <Route
          path="/terms-of-service"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <TermsOfService />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <div />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <div />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <VerifyEmail onAuthSuccess={handleAuthSuccess} />
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
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
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
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <DeleteAccount onDeleteSuccess={handleAccountDeletion} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/AdminDashboard"
          element={
            <ProtectedRoute auth={auth}>
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <AdminDashboard user={auth.user} onLogout={handleLogout} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Course Content */}
        <Route
          path="/course/:courseId"
          element={
            <Layout
              onSearch={handleSearch}
              searchResults={searchResults}
              auth={auth}
              handleLogout={handleLogout}
              handleAuthSuccess={handleAuthSuccess}
              setShowLogin={setShowLogin}
              setShowSignup={setShowSignup}
            >
              <CourseContent setShowLogin={setShowLogin} />
            </Layout>
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
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <LessonPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* 404 Fallback */}
        <Route
          path="*"
          element={
            <Navigate to="/" state={{ from: location.pathname }} replace />
          }
        />
      </Routes>
    </CartProvider>
  );
}

// AppWrapper to provide Router context
export default function AppWrapper() {
  return (
    <Router basename="/">
      <App />
    </Router>
  );
}