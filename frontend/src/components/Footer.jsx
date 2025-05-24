import { lazy, Suspense } from "react";
import "../styles/Footer.css";
import logo from "/assets/logos/company-logo.png"; // Replace with your actual logo

// Lazy-loaded components for better performance
const Link = lazy(() => import("react-router-dom").then((module) => ({ default: module.Link })));

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

const Footer = () => {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        {/* 1st Section - Company Logo & Copyright */}
        <div className="footer-company-info">
          <div className="footer-logo-container">
            <img
              src={logo}
              alt="SkillNestX Logo"
              className="footer-logo"
              loading="lazy" // Lazy load logo
            />
            <p className="footer-company-name">SkillNestX</p>
          </div>
          <p className="footer-copyright">
            © {new Date().getFullYear()} SkillNestX <br /> All rights reserved.
          </p>
        </div>

        {/* 2nd Section - Legal */}
        <div className="footer-section">
          <h3 className="footer-section-title">Legal</h3>
          <ul className="footer-links-list">
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/terms-of-service"
                  className="footer-link">
                  Terms of Service
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/privacy-policy" className="footer-link">
                  Privacy Policy
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/refund-policy" className="footer-link">
                  Refund Policy
                </Link>
              </Suspense>
            </li>
          </ul>
        </div>

        {/* 3rd Section - Pricing */}
        <div className="footer-section">
          <h3 className="footer-section-title">Pricing</h3>
          <ul className="footer-links-list">
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/subscription/personal" className="footer-link">
                  Personal Plan
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/subscription/team" className="footer-link">
                  Team Plan
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/subscription/gift" className="footer-link">
                  Gift a Plan
                </Link>
              </Suspense>
            </li>
          </ul>
        </div>

        {/* 4th Section - About */}
        <div className="footer-section">
          <h3 className="footer-section-title">About</h3>
          <ul className="footer-links-list">
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/about-us" className="footer-link">
                  About Us
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/contact-us" className="footer-link">
                  Contact Us
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link to="/careers" className="footer-link">
                  Careers
                </Link>
              </Suspense>
            </li>
          </ul>
        </div>

        {/* 5th Section - Products */}
        <div className="footer-section">
          <h3 className="footer-section-title">Products</h3>
          <ul className="footer-links-list">
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link 
                  to="/courses?category=Frontend" 
                  className="footer-link"
                  onClick={scrollToTop}
                >
                  Frontend Development
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link 
                  to="/courses?category=Backend" 
                  className="footer-link"
                  onClick={scrollToTop}
                >
                  Backend Development
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link 
                  to="/courses?category=Machine Learning" 
                  className="footer-link"
                  onClick={scrollToTop}
                >
                  Machine Learning
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link 
                  to="/courses?category=Artificial Intelligence" 
                  className="footer-link"
                  onClick={scrollToTop}
                >
                  Artificial Intelligence
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link 
                  to="/courses?category=System Design" 
                  className="footer-link"
                  onClick={scrollToTop}
                >
                  System Design
                </Link>
              </Suspense>
            </li>
            <li className="footer-link-item">
              <Suspense fallback={<span>Loading...</span>}>
                <Link 
                  to="/courses?category=Database" 
                  className="footer-link"
                  onClick={scrollToTop}
                >
                  Database
                </Link>
              </Suspense>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;