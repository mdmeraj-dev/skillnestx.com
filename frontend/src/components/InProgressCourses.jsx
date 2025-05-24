import { useState, useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/InProgressCourses.css";

const InProgressCourseCard = lazy(() => import("./InProgressCourseCard"));

const InProgressCourses = ({ auth = { isAuthenticated: false, user: null }, onCourseClick }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInProgressCourses = async () => {
      if (!auth?.isAuthenticated || !auth?.user?._id) {
        setCourses([]);
        setLoading(false);
        toast.error("Please log in to view in-progress courses.");
        return;
      }

      const traceId = crypto.randomUUID();
      const cacheKey = `inProgressCourses_${auth.user._id}`;
      const cachedCourses = localStorage.getItem(cacheKey);

      try {
        // Load cached data immediately
        if (cachedCourses) {
          const parsedCourses = JSON.parse(cachedCourses);
          setCourses(parsedCourses || []);
          setError(null);
          setLoading(false); // Render UI immediately with cached data
        } else {
          setLoading(true); // Keep loading true if no cache
        }

        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          throw new Error("No access token found. Please log in.");
        }

        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/progress/in-progress/${auth.user._id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Trace-Id": traceId,
            },
          }
        );

        if (response.data.success) {
          const fetchedCourses = response.data.data || [];
          setCourses(fetchedCourses);
          setError(null);
          // Cache the fetched courses
          localStorage.setItem(cacheKey, JSON.stringify(fetchedCourses));
        } else {
          throw new Error(response.data.message || "Failed to fetch in-progress courses");
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || "Failed to fetch in-progress courses";
        setError(errorMessage);
        toast.error(errorMessage);
        // Only clear courses if no cached data was used
        if (!cachedCourses) {
          setCourses([]);
        }
      } finally {
        if (!cachedCourses) {
          setLoading(false); // Only set loading false if no cache was used
        }
      }
    };

    fetchInProgressCourses();
  }, [auth?.isAuthenticated, auth?.user?._id]);

  return (
    <div className="in-progress-courses-container">
      <h2 className="in-progress-courses-title">In Progress Courses</h2>
      {loading ? (
        <div className="in-progress-courses-skeleton">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-title"></div>
              <div className="skeleton-progress"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="in-progress-courses-empty">{error}</div>
      ) : courses.length === 0 ? (
        <p className="in-progress-courses-empty">
          No in-progress courses found. Start a course to track your progress here.
        </p>
      ) : (
        <Suspense fallback={<div className="in-progress-courses-skeleton">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-title"></div>
              <div className="skeleton-progress"></div>
            </div>
          ))}
        </div>}>
          <div className="in-progress-courses-grid">
            {courses.map((course) => (
              <InProgressCourseCard
                key={course.courseId}
                course={{
                  _id: course.courseId,
                  title: course.courseTitle,
                  imageUrl: course.imageUrl,
                  progressPercentage: course.progressPercentage,
                  duration: course.duration,
                  newPrice: course.newPrice,
                }}
                auth={auth}
                onCourseClick={(courseId) => {
                  if (!auth?.user?._id) {
                    toast.error("Please log in to continue.");
                    return;
                  }
                  const normalizedCourse = {
                    _id: course.courseId,
                    title: course.courseTitle,
                    imageUrl: course.imageUrl,
                    progressPercentage: course.progressPercentage,
                    duration: course.duration,
                    newPrice: course.newPrice,
                    metadata: {
                      purchaseType: "course",
                      userId: auth.user._id,
                      courseId: course.courseId,
                      duration: course.duration || "1 Year",
                      amount: course.newPrice,
                    },
                  };
                  onCourseClick(courseId, normalizedCourse);
                }}
              />
            ))}
          </div>
        </Suspense>
      )}
    </div>
  );
};

InProgressCourses.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
  onCourseClick: PropTypes.func.isRequired,
};

export default InProgressCourses;