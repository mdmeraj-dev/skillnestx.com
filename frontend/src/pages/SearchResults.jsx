// SearchResults.jsx
import { useState, useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import { useCart } from "../hooks/useCart";
import { useNavigate } from "react-router-dom";
import "../styles/SearchResults.css";
import "../styles/CourseList.css";

const CourseCard = lazy(() => import("../components/CourseCard"));

const SearchResults = ({ searchResults }) => {
  const [addedCourses, setAddedCourses] = useState([]);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleAddToCart = (course) => {
    if (!addedCourses.includes(course._id)) {
      addToCart(course);
      setAddedCourses((prev) => [...prev, course._id]);
    }
  };

  const handleBuyNow = (course) => {
    const courseDetails = {
      type: "course", 
      name: course.title,
      validity: "1 Year",
      price: course.newPrice, 
    };
    navigate("/payment", { state: { planDetails: courseDetails } });
  };

  const handleBack = () => {
    navigate("/");
  };
 
  return (
    <div className="search-results-wrapper">
      <div className="search-results-container">
        <div className="search-results-header">
          <button className="search-back-button" onClick={handleBack}>
            <img src="/assets/icons/arrow-back.svg" alt="Back" />
            <span>Back</span>
          </button>
          <h2 className="search-results-title">Search Results</h2>
        </div>
        
        <div className="course-list-container">
          {searchResults.length === 0 ? (
            <div className="no-results-message">
              <img src="/assets/icons/search-not-found.jpg" alt="No courses found" />
              <h3>No courses found matching your search!</h3>
              <p>
                Our team is working hard to add more courses. 
                Please check back soon or try a different search term.
              </p>
              <button className="explore-button" onClick={() => navigate("/courses")}>
                Explore All Courses
              </button>
            </div>
          ) : (
            <Suspense fallback={<div className="loading-courses">Loading courses...</div>}>
              <div className={`course-grid ${searchResults.length === 1 ? 'single-course' : ''}`}>
                {searchResults.map((course) => (
                  <CourseCard
                    key={course._id}
                    course={course}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    isAddedToCart={addedCourses.includes(course._id)}
                  />
                ))}
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
};

SearchResults.propTypes = {
  searchResults: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      oldPrice: PropTypes.number.isRequired,
      newPrice: PropTypes.number.isRequired,
      image: PropTypes.string.isRequired,
      rating: PropTypes.number.isRequired,
      ratingCount: PropTypes.number.isRequired,
      tags: PropTypes.arrayOf(PropTypes.string).isRequired,
      offerTags: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
};

export default SearchResults;