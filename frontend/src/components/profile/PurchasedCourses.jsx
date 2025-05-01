import { useEffect } from "react";
import PropTypes from "prop-types";
import closeIcon from "/assets/icons/close.svg";
import "./styles/PurchasedCourses.css";

const PurchasedCourses = ({ onBack }) => {
  // Sample data for purchased courses (increased to trigger scrollbar)
  const courses = [
    {
      id: 1,
      name: "React Mastery",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/react-mastery",
      progress: 75,
    },
    {
      id: 2,
      name: "Advanced JavaScript",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/advanced-javascript",
      progress: 40,
    },
    {
      id: 3,
      name: "Node.js Fundamentals",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/nodejs-fundamentals",
      progress: 10,
    },
    {
      id: 4,
      name: "Web Development Bootcamp",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/web-dev-bootcamp",
      progress: 60,
    },
    {
      id: 5,
      name: "CSS Mastery",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/css-mastery",
      progress: 85,
    },
    {
      id: 6,
      name: "Python for Beginners",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/python-beginners",
      progress: 20,
    },
    {
      id: 7,
      name: "Data Science Fundamentals",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/data-science",
      progress: 50,
    },
    {
      id: 8,
      name: "AWS Certified Developer",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/aws-developer",
      progress: 30,
    },
    {
      id: 9,
      name: "UI/UX Design",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/ui-ux-design",
      progress: 70,
    },
    {
      id: 10,
      name: "Cybersecurity Essentials",
      thumbnail: "https://via.placeholder.com/150",
      link: "https://example.com/cybersecurity",
      progress: 15,
    },
  ];

  // Prevent background scrolling
  useEffect(() => {
    document.body.classList.add("login-modal-open");
    return () => {
      document.body.classList.remove("login-modal-open");
    };
  }, []);

  const handleCourseClick = (link) => {
    window.open(link, "_blank");
  };

  return (
    <div
      className="purchased-courses-modal-overlay"
      role="dialog"
      aria-labelledby="purchased-courses-title"
    >
      <div className="purchased-courses-modal-container">
        <button
          className="purchased-courses-close-button"
          onClick={onBack}
          aria-label="Close purchased courses"
        >
          <img
            src={closeIcon}
            alt=""
            className="purchased-courses-close-icon"
          />
        </button>

        <div className="purchased-courses-header">
          <h2
            id="purchased-courses-title"
            className="purchased-courses-title"
          >
            Purchased Courses
          </h2>
        </div>

        <div className="purchased-courses-course-list">
          {courses.map((course) => (
            <div
              key={course.id}
              className="purchased-courses-course-item"
              onClick={() => handleCourseClick(course.link)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleCourseClick(course.link);
                }
              }}
              aria-label={`View ${course.name}`}
            >
              <img
                src={course.thumbnail}
                alt={course.name}
                className="purchased-courses-course-thumbnail"
              />
              <div className="purchased-courses-course-details">
                <p className="purchased-courses-course-name">
                  {course.name}
                </p>
                <button
                  className="purchased-courses-continue-learning-button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering course-item click
                    handleCourseClick(course.link);
                  }}
                  aria-label={`Continue learning ${course.name}`}
                >
                  Continue Learning
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

PurchasedCourses.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default PurchasedCourses;