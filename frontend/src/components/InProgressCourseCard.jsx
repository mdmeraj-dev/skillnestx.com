import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import { lazy, Suspense } from "react"; // Import lazy and Suspense for image
import "../styles/InProgressCourseCard.css";

// Lazy load the course image for better performance
const LazyImage = lazy(() => import("./LazyImage"));

const InProgressCourseCard = ({ course, onCourseClick = null, auth }) => {
  const { _id, title, imageUrl, progressPercentage, newPrice, duration } = course;
  const displayProgress = Number.isFinite(progressPercentage) ? progressPercentage : 0;
  const navigate = useNavigate();

  const normalizeValidity = (duration) => {
    // Normalize duration to a standard format, e.g., "1 Year"
    return duration || "1 Year";
  };

  const handleContinueLearning = (e) => {
    e.stopPropagation();

    // Get userId from auth or access token
    let userId = auth?.user?._id;
    if (!userId) {
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
          const decoded = jwtDecode(accessToken);
          userId = decoded.userId || decoded.id; // Adjust based on your token structure
        }
      } catch (err) {
        console.error("Failed to decode access token:", err);
      }
    }

    // Validate required fields for CourseContent.jsx
    if (!_id || !title || typeof newPrice !== "number" || !duration || !userId) {
      console.error("Invalid course data:", { _id, title, newPrice, duration, userId });
      toast.error("Cannot load course: Missing required course information.");
      return;
    }

    const metadata = {
      purchaseType: "course",
      userId,
      courseId: _id,
      duration: normalizeValidity(duration),
      amount: newPrice,
    };

    const normalizedCourse = {
      _id,
      title,
      imageUrl,
      progressPercentage,
      newPrice,
      duration,
      metadata,
    };

    if (onCourseClick) {
      onCourseClick(_id, normalizedCourse);
    } else {
      navigate(`/course/${_id}/syllabus`, { state: { course: normalizedCourse } });
    }
  };

  return (
    <div className="progress-course-card">
      <Suspense fallback={<div className="progress-course-image-placeholder"></div>}>
        <LazyImage
          src={imageUrl || "placeholder-image.jpg"}
          alt={title || "Course Image"}
          className="progress-course-card-image"
        />
      </Suspense>
      <div className="progress-course-content">
        <h3 className="progress-course-card-title">{title || "Untitled Course"}</h3>
        <div className="progress-course-progress">
          <div className="progress-course-progress-bar">
            <div
              className="progress-course-progress-fill"
              style={{ width: `${displayProgress}%` }}
            ></div>
          </div>
          <span>{displayProgress.toFixed(0)}%</span>
        </div>
        <button
          className="progress-continue-button"
          onClick={handleContinueLearning}
        >
          Continue Learning
        </button>
      </div>
    </div>
  );
};

InProgressCourseCard.propTypes = {
  course: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    imageUrl: PropTypes.string,
    progressPercentage: PropTypes.number,
    newPrice: PropTypes.number.isRequired,
    duration: PropTypes.string.isRequired,
  }).isRequired,
  onCourseClick: PropTypes.func,
  auth: PropTypes.shape({
    user: PropTypes.shape({
      _id: PropTypes.string,
    }),
  }),
};

export default InProgressCourseCard;