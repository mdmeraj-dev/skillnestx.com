import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation(); // Get the current route path

  useEffect(() => {
    window.scrollTo(0, 0); // Scrolls to the top when route changes
  }, [pathname]);

  return null; // This component doesn't render anything
};

export default ScrollToTop;
