import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import StarIcon from "/assets/icons/star.svg";
import "../styles/CourseCard.css";
import { useEffect, useState, lazy, Suspense } from "react";

// Lazy load the CourseCard image for better performance
const LazyImage = lazy(() => import("./LazyImage"));

const CourseCard = ({ 
  course, 
  onCourseClick, 
  onAddToCart, 
  onBuyNow, 
  isAddedToCart, 
  auth = { isAuthenticated: false, user: null } 
}) => {
  const navigate = useNavigate();
  const [localCartState, setLocalCartState] = useState(false);

  // Check if the course is already in the cart on component mount
  useEffect(() => {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const isCourseInCart = cart.some((item) => item._id === course._id);
    setLocalCartState(isAddedToCart || isCourseInCart);
  }, [course._id, isAddedToCart]);

  // Handle click on the course card
  const handleCourseClick = (e) => {
    if (onCourseClick) {
      onCourseClick(course._id, course);
    } else {
      navigate(`/course/${course._id}`, { state: { course } });
    }
  };

  // Handle Buy Now button click
  const handleBuyNowClick = (e) => {
    e.stopPropagation();
    if (onBuyNow) {
      onBuyNow(course);
    } else {
      const courseDetails = {
        title: course.title,
        duration: course.duration || "1 Year",
        price: `₹${course.newPrice}`,
      };
      navigate("/payment", { state: { courseDetails } });
    }
  };

  // Handle Add to Cart button click
  const handleAddToCartClick = (e) => {
    e.stopPropagation();
    if (!localCartState) {
      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      if (!cart.some((item) => item._id === course._id)) {
        cart.push(course);
        localStorage.setItem("cart", JSON.stringify(cart));
        setLocalCartState(true);
      }
      if (onAddToCart) {
        onAddToCart(course);
      }
    }
  };

  const discount = Math.round(
    ((course.oldPrice - course.newPrice) / course.oldPrice) * 100
  );
  const randomTag =
    course.tags?.length > 0
      ? course.tags[Math.floor(Math.random() * course.tags.length)]
      : null;

  return (
    <div className="course-item" onClick={handleCourseClick}>
      <div className="course-image-container">
        {randomTag && <span className="course-tag">{randomTag}</span>}
        <Suspense fallback={<div className="image-placeholder">Loading...</div>}>
          <LazyImage src={course.image} alt={course.title} />
        </Suspense>
      </div>
      <div className="course-info-container">
        <div className="course-title-container">
          <h3 className="course-title">{course.title}</h3>
        </div>
        <p className="course-description">{course.description}</p>
        <div className="rating-container">
          <div className="course-rating">
            <span className="rating-value">{course.rating}</span>
            <img src={StarIcon} alt="Star Icon" className="star-icon" />
          </div>
          <span className="rating-count">({course.ratingCount})</span>
        </div>
        <div className="course-price">
          <span className="old-price">₹{course.oldPrice}</span>
          <span className="new-price">₹{course.newPrice}</span>
          <span className="discount">({discount}% off)</span>
        </div>
        <div className="course-buttons">
          <button
            className="add-to-cart"
            onClick={handleAddToCartClick}
            disabled={localCartState}
          >
            {localCartState ? "Added to Cart" : "Add to Cart"}
          </button>
          <button className="buy-now" onClick={handleBuyNowClick}>
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};

// Add prop type validation
CourseCard.propTypes = {
  course: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    oldPrice: PropTypes.number.isRequired,
    newPrice: PropTypes.number.isRequired,
    rating: PropTypes.number.isRequired,
    ratingCount: PropTypes.number.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    duration: PropTypes.string,
  }).isRequired,
  onCourseClick: PropTypes.func,
  onAddToCart: PropTypes.func,
  onBuyNow: PropTypes.func,
  isAddedToCart: PropTypes.bool,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
};

export default CourseCard;