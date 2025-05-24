import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import "../styles/CourseCard.css";
import { useEffect, useState, lazy, Suspense } from "react";
import axios from "axios";
import { toast } from "react-toastify";

// Lazy load the CourseCard image for better performance
const LazyImage = lazy(() => import("./LazyImage"));

const CourseCard = ({
  course,
  onCourseClick,
  onAddToCart,
  onEnrollNow,
  isAddedToCart,
  auth,
}) => {
  const navigate = useNavigate();
  const [localCartState, setLocalCartState] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Check if the course is already in the cart or saved for the current user on component mount
  useEffect(() => {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const userId = auth?.user?._id || "guest";
    const isCourseInCart = cart.some(
      (item) => item._id === course._id && item.userId === userId
    );
    setLocalCartState(isAddedToCart || isCourseInCart);

    // Check if course is saved via API
    const checkSavedStatus = async () => {
      if (!userId || userId === "guest") {
        setIsSaved(false);
        return;
      }
      const traceId = crypto.randomUUID();
      const cacheKey = `savedCourses_${userId}`;
      const cachedSavedCourses = localStorage.getItem(cacheKey);

      try {
        // Load cached data immediately
        if (cachedSavedCourses) {
          const parsedSavedCourses = JSON.parse(cachedSavedCourses);
          const isCourseSaved = parsedSavedCourses.some(
            (item) => item._id === course._id
          );
          setIsSaved(isCourseSaved);
        }

        const accessToken = localStorage.getItem("accessToken");
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/saved-courses`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Trace-Id": traceId,
            },
          }
        );
        const savedCourses = response.data.data || [];
        const isCourseSaved = savedCourses.some(
          (item) => item._id === course._id
        );
        setIsSaved(isCourseSaved);
        // Cache the fetched saved courses
        localStorage.setItem(cacheKey, JSON.stringify(savedCourses));
      } catch (err) {
        console.error(
          "Error checking saved status:",
          err.response?.data?.message || err.message
        );
        // Only set isSaved to false if no cached data was used
        if (!cachedSavedCourses) {
          setIsSaved(false);
        }
      }
    };
    checkSavedStatus();
  }, [course._id, isAddedToCart, auth?.user?._id]);

  // Normalize validity to match PaymentPage.jsx expectations
  const normalizeValidity = (duration) => {
    const normalized = duration?.toLowerCase();
    if (normalized?.includes("year") || normalized?.includes("12 months")) {
      return "1year";
    }
    if (normalized?.includes("6 months")) {
      return "6months";
    }
    if (normalized?.includes("month")) {
      return "1month";
    }
    return "1year"; // Default for courses
  };

  // Handle click on the course card
  const handleCourseClick = (e) => {
    if (onCourseClick) {
      onCourseClick(course._id, course);
    } else {
      navigate(`/course/${course._id}`, { state: { course } });
    }
  };

  // Handle Save button click
  const handleSaveClick = async (e) => {
    e.preventDefault(); // Prevent default browser behavior
    e.stopPropagation();
    const userId = auth?.user?._id;
    if (!userId) {
      navigate("/login", { state: { from: `/course/${course._id}` } });
      toast.error("Please log in to save courses.");
      return;
    }

    const traceId = crypto.randomUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("No access token found. Please log in.");
      }

      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/saved-courses/toggle`,
        { courseId: course._id, userId },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        setIsSaved(response.data.isSaved);
        // Update cache after toggling
        const cacheKey = `savedCourses_${userId}`;
        const cachedSavedCourses = localStorage.getItem(cacheKey);
        let savedCourses = cachedSavedCourses
          ? JSON.parse(cachedSavedCourses)
          : [];
        if (response.data.isSaved) {
          savedCourses.push({ _id: course._id, title: course.title }); // Add minimal course data
        } else {
          savedCourses = savedCourses.filter((item) => item._id !== course._id);
        }
        localStorage.setItem(cacheKey, JSON.stringify(savedCourses));
        toast.success(response.data.message);
      } else {
        throw new Error(response.data.message || "Failed to toggle saved course");
      }
    } catch (err) {
      console.error("Error toggling saved course:", err.response?.data?.message || err.message);
      toast.error(err.response?.data?.message || "Failed to toggle saved course");
    }
  };

  // Handle Enroll Now button click
  const handleEnrollNowClick = (e) => {
    e.stopPropagation();
    const userId = auth?.user?._id;
    if (!userId) {
      navigate("/login", { state: { from: `/course/${course._id}` } });
      return;
    }

    if (typeof course.newPrice !== "number" || isNaN(course.newPrice)) {
      console.error(`Invalid price for course: ${course.title}`);
      alert("Invalid course price. Please try again.");
      return;
    }

    const metadata = {
      purchaseType: "course",
      userId,
      courseId: course._id,
      duration: normalizeValidity(course.duration || "1 Year"),
      amount: course.newPrice,
    };

    const courseDetails = {
      id: course._id,
      name: course.title,
      type: "course",
      price: course.newPrice,
      validity: normalizeValidity(course.duration),
    };

    if (onEnrollNow) {
      onEnrollNow(course);
    }

    // Save to localStorage for fallback
    localStorage.setItem("selectedCourse", JSON.stringify(courseDetails));
    navigate("/payment", { state: { courseDetails, ...metadata } });
  };

  // Handle Add to Cart button click
  const handleAddToCartClick = (e) => {
    e.stopPropagation();
    const userId = auth?.user?._id;
    if (!userId) {
      navigate("/login", { state: { from: `/course/${course._id}` } });
      return;
    }

    if (!localCartState) {
      if (typeof course.newPrice !== "number" || isNaN(course.newPrice)) {
        console.error(`Invalid price for course: ${course.title}`);
        alert("Invalid course price. Please try again.");
        return;
      }

      const cart = JSON.parse(localStorage.getItem("cart")) || [];

      if (
        !cart.some((item) => item._id === course._id && item.userId === userId)
      ) {
        const metadata = {
          purchaseType: "course",
          userId,
          courseId: course._id,
          duration: normalizeValidity(course.duration || "1 Year"),
          amount: course.newPrice,
        };

        const courseDetails = {
          _id: course._id,
          title: course.title,
          newPrice: course.newPrice,
          validity: normalizeValidity(course.duration),
          type: "course",
          duration: course.duration || "1 Year",
          userId,
        };

        cart.push(courseDetails);
        localStorage.setItem("cart", JSON.stringify(cart));

        // Verify cart was saved correctly
        const savedCart = JSON.parse(localStorage.getItem("cart")) || [];
        if (
          !savedCart.some(
            (item) => item._id === course._id && item.userId === userId
          )
        ) {
          console.error("Cart save failed or was overwritten:", savedCart);
          alert("Failed to add course to cart. Please try again.");
          return;
        }

        setLocalCartState(true);
      }
      if (onAddToCart) {
        onAddToCart(course);
      }
    }
  };

  // Check if user is authenticated and has access (active subscription or purchased course)
  const isAuthenticated = auth?.isAuthenticated;
  const hasActiveSubscription =
    auth?.user?.activeSubscription?.status === "active" &&
    auth?.user?.activeSubscription?.endDate &&
    new Date(auth.user.activeSubscription.endDate) > new Date();
  const hasPurchasedCourse = auth?.user?.purchasedCourses?.some(
    (c) => (c.courseId?.$oid || c.courseId) === course._id
  );

  const discount = Math.round(
    ((course.oldPrice - course.newPrice) / course.oldPrice) * 100
  );
  const randomTag =
    course.tags?.length > 0
      ? course.tags[Math.floor(Math.random() * course.tags.length)]
      : null;

  return (
    <div className="primary-course-card" onClick={handleCourseClick}>
      <div className="primary-course-image-container">
        {randomTag && (
          <span className="primary-course-card-tag">{randomTag}</span>
        )}
        <span
          className={`material-icons save-icon ${isSaved ? "saved" : ""}`}
          onClick={handleSaveClick}
          title={isSaved ? "Remove from Saved" : "Save Course"}
        >
          {isSaved ? "bookmark" : "bookmark_border"}
        </span>
        <Suspense
          fallback={<div className="image-placeholder">Loading...</div>}
        >
          <LazyImage src={course.imageUrl} alt={course.title} />
        </Suspense>
      </div>
      <div className="primary-course-info-container">
        <div className="primary-course-title-container">
          <h3 className="primary-course-title">{course.title}</h3>
        </div>
        <div className="primary-course-description">
          <p>{course.description}</p>
        </div>
        <div className="primary-course-rating-container">
          <div className="primary-course-rating">
            <span className="rating-value">{course.rating}</span>
            <span
              className="material-icons"
              style={{
                fontSize: "16px",
                color: "#fff",
              }}
            >
              star_border
            </span>
          </div>
          <span className="rating-count">({course.ratingCount})</span>
        </div>
        {isAuthenticated && hasPurchasedCourse && !hasActiveSubscription ? (
          <div className="primary-course-buttons">
            <button className="already-enrolled" disabled>
              Already Enrolled
            </button>
          </div>
        ) : !isAuthenticated ||
          (!hasActiveSubscription && !hasPurchasedCourse) ? (
          <>
            <div className="primary-course-price">
              <span className="old-price">₹{course.oldPrice}</span>
              <span className="new-price">₹{course.newPrice}</span>
              <span className="discount">({discount}% off)</span>
            </div>
            <div className="primary-course-buttons">
              <button
                className="add-to-cart"
                onClick={handleAddToCartClick}
                disabled={localCartState}
              >
                {localCartState ? "Added to Cart" : "Add to Cart"}
              </button>
              <button className="enroll-now" onClick={handleEnrollNowClick}>
                Enroll Now
              </button>
            </div>
          </>
        ) : null}
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
    imageUrl: PropTypes.string.isRequired,
    oldPrice: PropTypes.number.isRequired,
    newPrice: PropTypes.number.isRequired,
    rating: PropTypes.number.isRequired,
    ratingCount: PropTypes.number.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    duration: PropTypes.string,
  }).isRequired,
  onCourseClick: PropTypes.func,
  onAddToCart: PropTypes.func,
  onEnrollNow: PropTypes.func,
  isAddedToCart: PropTypes.bool,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
      purchasedCourses: PropTypes.arrayOf(
        PropTypes.shape({
          courseId: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({ $oid: PropTypes.string }),
          ]),
        })
      ),
      activeSubscription: PropTypes.shape({
        status: PropTypes.string,
        endDate: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.shape({
            $date: PropTypes.oneOfType([
              PropTypes.string,
              PropTypes.shape({ $numberLong: PropTypes.string }),
            ]),
          }),
        ]),
      }),
    }),
  }),
};

export default CourseCard;