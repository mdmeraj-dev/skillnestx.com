import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { lazy, Suspense } from "react"; // Import lazy and Suspense for image
import "../styles/SavedCourseCard.css";

// Lazy load the course image for better performance
const LazyImage = lazy(() => import("./LazyImage"));

const SavedCourseCard = ({ course, onUnsave }) => {
  const navigate = useNavigate();

  const handleCourseClick = () => {
    if (!course?._id) {
      console.error("Missing course._id:", course);
      return;
    }
    navigate(`/course/${course._id}`, { state: { course } });
  };

  const handleUnsaveClick = (e) => {
    e.preventDefault(); // Prevent default browser behavior
    e.stopPropagation(); // Prevent click from bubbling to parent

    onUnsave(course._id);
  };

  return (
    <div
      className="saved-course-card"
      onClick={handleCourseClick}
      aria-label={`View ${course.title} course`}
    >
      <Suspense fallback={<div className="saved-course-image-placeholder"></div>}>
        <LazyImage
          src={course.imageUrl || "/placeholder-image.jpg"}
          alt={course.title}
          className="saved-course-card-image"
        />
      </Suspense>
      <h2 className="saved-course-card-title">{course.title}</h2>
      <span
        className="material-icons saved-course-card-unsave"
        onClick={handleUnsaveClick}
        title="Remove from saved courses"
      >
        bookmark
      </span>
    </div>
  );
};

SavedCourseCard.propTypes = {
  course: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    imageUrl: PropTypes.string,
    newPrice: PropTypes.number,
    duration: PropTypes.string,
  }).isRequired,
  onUnsave: PropTypes.func.isRequired,
};

export default SavedCourseCard;