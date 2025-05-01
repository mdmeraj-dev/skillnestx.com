import { useState } from "react";
import PropTypes from "prop-types";
import "../styles/CourseProgress.css";
import LikeIcon from "/assets/icons/like.svg";
import DislikeIcon from "/assets/icons/dislike.svg";
import DownloadIcon from "/assets/icons/download.svg";

const CourseProgress = ({
  syllabus = [],
  userName = "User name",
  courseTitle = "Course title",
  progressColor = "#4CAF50",
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState({
    liked: null,
  });

  // Calculate progress
  const totalLessons = syllabus.reduce(
    (total, section) => total + section.lessons.length,
    0
  );
  const completedLessons = syllabus.reduce(
    (total, section) =>
      total + section.lessons.filter((lesson) => lesson.isCompleted).length,
    0
  );
  const progressPercentage = Math.round(
    (completedLessons / totalLessons) * 100
  );

  // Check if the course is completed
  const isCourseCompleted = completedLessons === totalLessons;

  // Function to handle certificate download
  const handleDownloadCertificate = async () => {
    if (!userName || !courseTitle) {
      alert("User or course details are missing!");
      return;
    }

    setIsDownloading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/certificates/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: userName,
            course: courseTitle,
            completionDate: new Date().toISOString().split("T")[0],
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const certificateUrl = `${import.meta.env.VITE_BACKEND_URL}${
          data.certificateUrl.startsWith("/")
            ? data.certificateUrl
            : `/${data.certificateUrl}`
        }`;

        const link = document.createElement("a");
        link.href = certificateUrl;
        link.download = `${userName}_certificate.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error("Error downloading certificate:", error);
      alert("Failed to generate the certificate. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to handle rating
  const handleRating = (selectedRating) => {
    setRating(selectedRating);
  };

  // Function to handle like/dislike feedback
  const handleFeedback = (isLiked) => {
    if (feedback.liked === isLiked) {
      setFeedback({ liked: null });
    } else {
      setFeedback({ liked: isLiked });
    }
  };

  return (
    <div className="course-progress-container">
      <h2 className="progress-title">Course Progress</h2>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{
            width: `${progressPercentage}%`,
            backgroundColor: progressColor,
            transition: "width 0.5s ease, background-color 0.5s ease",
          }}
        ></div>
      </div>

      {/* Progress Percentage */}
      <p className="progress-percentage">
        {progressPercentage}% Completed ({completedLessons}/{totalLessons}{" "}
        Lessons)
      </p>

      {/* Certificate Section */}
      {isCourseCompleted && (
        <div className="certificate-section">
          <h3 className="certificate-title">🎉 Course Completed! 🎉</h3>
          <p className="certificate-message">
            Congratulations! You have successfully completed the course.
            Download your certificate below.
          </p>

          {/* Download Certificate Button with Icon */}
          <button
            className="download-certificate-button"
            onClick={handleDownloadCertificate}
            disabled={isDownloading}
          >
            <div className="download-button-content">
              <img
                src={DownloadIcon}
                alt="Download"
                className="download-icon"
              />
              <span>Download Certificate</span>
            </div>
          </button>

          {/* Rate This Course Section */}
          <div className="rate-course-section">
            <h3 className="rate-course-title">
              Your Feedback Impacts Millions of Learners
            </h3>
            <p className="rate-course-subtitle">
              Please share your experience to help others choose the right
              course
            </p>

            {/* Like/Dislike Feedback Section */}
            <div className="feedback-section">
              <h4 className="feedback-title">Was this course helpful?</h4>
              <div className="feedback-buttons">
                <button
                  className={`feedback-button like-button ${
                    feedback.liked === true ? "active" : ""
                  }`}
                  onClick={() => handleFeedback(true)}
                  aria-label={
                    feedback.liked === true ? "Remove like" : "Like this course"
                  }
                >
                  <img src={LikeIcon} alt="Like" />
                  <span>{feedback.liked === true ? "Liked" : "Like"}</span>
                </button>
                <button
                  className={`feedback-button dislike-button ${
                    feedback.liked === false ? "active" : ""
                  }`}
                  onClick={() => handleFeedback(false)}
                  aria-label={
                    feedback.liked === false
                      ? "Remove dislike"
                      : "Dislike this course"
                  }
                >
                  <img src={DislikeIcon} alt="Dislike" />
                  <span>
                    {feedback.liked === false ? "Disliked" : "Dislike"}
                  </span>
                </button>
              </div>
              {feedback.liked !== null && (
                <p className="feedback-thank-you">
                  Thank you for your feedback!
                </p>
              )}
            </div>

            {/* Star Rating Section */}
            <h3 className="rate-course-star-title">Please rate this course</h3>
            <div className="star-rating">
              {[...Array(5)].map((star, index) => {
                index += 1;
                return (
                  <button
                    type="button"
                    key={index}
                    className={index <= (hoverRating || rating) ? "on" : "off"}
                    onClick={() => handleRating(index)}
                    onMouseEnter={() => setHoverRating(index)}
                    onMouseLeave={() => setHoverRating(rating)}
                  >
                    <span className="star">&#9733;</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

CourseProgress.propTypes = {
  syllabus: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      lessons: PropTypes.arrayOf(
        PropTypes.shape({
          _id: PropTypes.string.isRequired,
          title: PropTypes.string.isRequired,
          isCompleted: PropTypes.bool.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  userName: PropTypes.string,
  courseTitle: PropTypes.string,
  progressColor: PropTypes.string,
};

export default CourseProgress;
