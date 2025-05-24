import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const LazyImage = ({ src, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [src]);

  return (
    <div className="lazy-image-container">
      {!isLoaded && <div className="image-placeholder">Loading...</div>}
      {isLoaded && <img src={src} alt={alt} className="course-image" />}
    </div>
  );
};

// Add PropTypes validation
LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
};

export default LazyImage;