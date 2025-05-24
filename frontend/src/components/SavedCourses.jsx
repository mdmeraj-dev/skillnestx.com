import { useState, useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/SavedCourses.css";

const SavedCourseCard = lazy(() => import("./SavedCourseCard"));

const SavedCourses = ({ auth = { isAuthenticated: false, user: null }, onCourseClick }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSavedCourses = async () => {
      if (!auth?.isAuthenticated || !auth?.user?._id) {
        setCourses([]);
        setLoading(false);
        toast.error("Please log in to view saved courses.");
        return;
      }

      const traceId = crypto.randomUUID();
      const cacheKey = `savedCourses_${auth.user._id}`;
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
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/saved-courses`,
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
          throw new Error(response.data.message || "Failed to fetch saved courses");
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || "Failed to fetch saved courses";
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

    fetchSavedCourses();
  }, [auth?.isAuthenticated, auth?.user?._id]);

  return (
    <div className="saved-courses-container">
      <h2 className="saved-courses-title">Saved Courses</h2>
      {loading ? (
        <div className="saved-courses-skeleton">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-title"></div>
              <div className="skeleton-price"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="saved-courses-empty">{error}</div>
      ) : courses.length === 0 ? (
        <p className="saved-courses-empty">
          No saved courses found. Save a course to see it here.
        </p>
      ) : (
        <Suspense
          fallback={
            <div className="saved-courses-skeleton">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="skeleton-card">
                  <div className="skeleton-image"></div>
                  <div className="skeleton-title"></div>
                  <div className="skeleton-price"></div>
                </div>
              ))}
            </div>
          }
        >
          <div className="saved-courses-grid">
            {courses.map((course) => (
              <SavedCourseCard
                key={course._id}
                course={{
                  _id: course._id,
                  title: course.title,
                  imageUrl: course.imageUrl,
                  newPrice: course.newPrice,
                  duration: course.duration,
                }}
                auth={auth}
                onCourseClick={(courseId) => {
                  if (!auth?.user?._id) {
                    toast.error("Please log in to continue.");
                    return;
                  }
                  const normalizedCourse = {
                    _id: course._id,
                    title: course.title,
                    imageUrl: course.imageUrl,
                    newPrice: course.newPrice,
                    duration: course.duration,
                    metadata: {
                      purchaseType: "course",
                      userId: auth.user._id,
                      courseId: course._id,
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

SavedCourses.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
  onCourseClick: PropTypes.func.isRequired,
};

export default SavedCourses;