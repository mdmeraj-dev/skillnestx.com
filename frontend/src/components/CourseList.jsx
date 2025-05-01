import { useState, useEffect, Suspense, lazy } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useCart } from "../hooks/useCart";
import "../styles/CourseList.css";

// Lazy load the CourseCard component for better performance
const CourseCard = lazy(() => import("./CourseCard"));

const categories = [
  "Frontend",
  "Backend",
  "Machine Learning",
  "Artificial Intelligence",
  "System Design",
  "Database",
];

const CourseList = ({ category, onCourseClick, auth = { isAuthenticated: false, user: null } }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(category || "Frontend");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addedCourses, setAddedCourses] = useState([]);

  const { addToCart, cart } = useCart();

  // Initialize addedCourses from localStorage or cart
  useEffect(() => {
    const cartItems = JSON.parse(localStorage.getItem("cart")) || [];
    const cartCourseIds = cartItems.map((item) => item._id);
    setAddedCourses(cartCourseIds);
  }, []);

  // Extract category from URL query parameters or prop
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const urlCategory = queryParams.get("category");

    if (category) {
      setSelectedCategory(category);
    } else if (urlCategory && categories.includes(urlCategory)) {
      setSelectedCategory(urlCategory);
    } else {
      setSelectedCategory("Frontend");
    }
  }, [location.search, category]);

  // Fetch courses based on the selected category
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const cacheKey = `courses:${selectedCategory}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setCourses(parsedData);
            setLoading(false);
            return;
          }
        }

        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/courses/category/${selectedCategory}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch courses: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.courses)) {
          throw new Error("Invalid data format: Expected an array of courses");
        }

        setCourses(data.courses);
        localStorage.setItem(cacheKey, JSON.stringify(data.courses));
      } catch (error) {
        setCourses([]);
      }
      setLoading(false);
    };

    fetchCourses();
  }, [selectedCategory]);

  // Handle category click
  const handleCategoryClick = (category) => {
    navigate(`?category=${category}`);
    setSelectedCategory(category);
  };

  // Handle adding a course to the cart
  const handleAddToCart = (course) => {
    if (!addedCourses.includes(course._id)) {
      addToCart(course);
      setAddedCourses((prev) => [...prev, course._id]);
    }
  };

  // Handle buying a course immediately
  const handleBuyNow = (course) => {
    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }

    const courseDetails = {
      type: "course",
      name: course.title,
      validity: "1 Year",
      price: course.newPrice,
    };

    navigate("/payment", { state: { planDetails: courseDetails } });
  };

  // Skeleton Loading Component
  const SkeletonLoader = () => (
    <div className="skeleton-loader">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton-image"></div>
          <div className="skeleton-title"></div>
          <div className="skeleton-description"></div>
          <div className="skeleton-price"></div>
          <div className="skeleton-buttons"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="course-category">
      <h2 className="course-category-title">Browse Courses by Category</h2>

      <div className="course-category-tabs">
        {categories.map((category) => (
          <button
            key={category}
            className={`course-category-tab ${
              selectedCategory === category ? "course-category-tab-active" : ""
            }`}
            onClick={() => handleCategoryClick(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="course-category-list">
        {loading ? (
          <SkeletonLoader />
        ) : courses.length === 0 ? (
          <p className="course-category-no-courses">No courses available in this category.</p>
        ) : (
          <Suspense fallback={<SkeletonLoader />}>
            {courses.map((course) => (
              <CourseCard
                key={course._id}
                course={course}
                onCourseClick={onCourseClick}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                isAddedToCart={addedCourses.includes(course._id)}
                auth={auth}
              />
            ))}
          </Suspense>
        )}
      </div>
    </div>
  );
};

CourseList.propTypes = {
  category: PropTypes.string,
  onCourseClick: PropTypes.func,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
};

export default CourseList;