import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import LockIcon from "/assets/icons/lock.svg";
import UnLockIcon from "/assets/icons/unlock.svg";
import TickIcon from "/assets/icons/tick.svg";
import RadioIcon from "/assets/icons/radio.svg";
import PanelCloseIcon from "/assets/icons/panel-close.svg";
import arrowDown from "/assets/icons/arrow-down.svg";
import CourseProgress from "./CourseProgress";
import "../styles/CourseContent.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Generate UUID fallback
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Global traceId generator
const getTraceId = () => {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : generateUUID();
};

// Configure Axios instance
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Logger aligned with Certificate.jsx
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[WARN] ${msg}`, meta);
    }
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[DEBUG] ${msg}`, meta);
    }
  },
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken")?.trim();
    const traceId = getTraceId();
    config.headers["X-Trace-Id"] = traceId;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      logger.debug("Request headers", {
        traceId,
        headers: {
          Authorization: `Bearer ${accessToken.substring(0, 10)}...`,
          "Content-Type": config.headers["Content-Type"],
          "X-Trace-Id": traceId,
        },
      });
    } else {
      logger.warn("No access token found", { traceId });
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/api/auth/refresh-token" &&
      originalRequest.url !== "/api/auth/logout"
    ) {
      originalRequest._retry = true;
      const traceId = getTraceId();
      const isLoggingOut = localStorage.getItem("isLoggingOut") === "true";
      if (isLoggingOut) {
        logger.debug("Skipping token refresh during logout", { traceId });
        return Promise.reject(error);
      }
      try {
        const refreshToken = localStorage.getItem("refreshToken")?.trim();
        if (!refreshToken) {
          logger.warn("No refresh token available", { traceId });
          throw new Error("No refresh token available");
        }
        const response = await api.post(
          "/api/auth/refresh-token",
          { refreshToken },
          {
            headers: {
              "X-Trace-Id": traceId,
              "Content-Type": "application/json",
            },
          }
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        if (response.status === 200 && response.data.success) {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
        throw new Error("Refresh failed");
      } catch (refreshError) {
        logger.error("Token refresh error", {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href =
          "/login?error=Your authentication has expired. Please log in again.";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Lazy load LessonPage
const LessonPage = lazy(() => import("../pages/LessonPage"));

const CourseContent = ({ setShowLogin }) => {
  const [syllabus, setSyllabus] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [purchasedCourses, setPurchasedCourses] = useState([]);
  const [userName, setUserName] = useState(null);
  const [error, setError] = useState(null);
  const [progressError, setProgressError] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [visitedLessons, setVisitedLessons] = useState({});
  const [userId, setUserId] = useState(null);
  const [progressData, setProgressData] = useState({
    percentage: 0,
    color: "#e0f7e0",
    isCompleted: false,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { course } = location.state || {};

  // Load lesson status from local storage
  const loadLessonStatus = useCallback((courseId) => {
    try {
      const savedCompleted = localStorage.getItem(`completedLessons_${courseId}`);
      const savedVisited = localStorage.getItem(`visitedLessons_${courseId}`);
      return {
        completedLessons: savedCompleted ? JSON.parse(savedCompleted) : {},
        visitedLessons: savedVisited ? JSON.parse(savedVisited) : {},
      };
    } catch (error) {
      logger.error("Error loading lesson status", {
        error: error.message,
        traceId: getTraceId(),
      });
      return { completedLessons: {}, visitedLessons: {} };
    }
  }, []);

  // Save completed lessons to local storage
  const saveCompletedLessons = useCallback((courseId, completedLessons) => {
    try {
      localStorage.setItem(
        `completedLessons_${courseId}`,
        JSON.stringify(completedLessons)
      );
    } catch (error) {
      logger.error("Error saving completed lessons", {
        error: error.message,
        traceId: getTraceId(),
      });
    }
  }, []);

  // Save visited lessons to local storage
  const saveVisitedLessons = useCallback((courseId, visitedLessons) => {
    try {
      localStorage.setItem(
        `visitedLessons_${courseId}`,
        JSON.stringify(visitedLessons)
      );
    } catch (error) {
      logger.error("Error saving visited lessons", {
        error: error.message,
        traceId: getTraceId(),
      });
    }
  }, []);

  // Fetch user data, syllabus, and progress
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!course?._id || !course?.title) {
        const traceId = getTraceId();
        logger.warn("Invalid course data", { traceId, course });
        if (isMounted) {
          setError("Invalid course data. Redirecting...");
          navigate("/");
        }
        return;
      }

      const token = localStorage.getItem("accessToken")?.trim();
      if (!token) {
        const traceId = getTraceId();
        if (isMounted) {
          setError("Please log in to access the course.");
          navigate("/login", {
            state: { error: "Please log in to access the course." },
          });
          setShowLogin(true);
        }
        return;
      }

      const userCacheKey = `userData_${course._id}`;
      const syllabusCacheKey = `syllabus_${course._id}`;
      const progressCacheKey = `progress_${course._id}`;
      const cachedUser = localStorage.getItem(userCacheKey);
      const cachedSyllabus = localStorage.getItem(syllabusCacheKey);
      const cachedProgress = localStorage.getItem(progressCacheKey);

      try {
        // Load cached data immediately if all required caches exist
        if (cachedUser && cachedSyllabus && cachedProgress) {
          const traceId = getTraceId();
          logger.debug("Loading course data from localStorage", {
            traceId,
            courseId: course._id,
          });

          const { data: userData, cacheVersion: userCacheVersion } = JSON.parse(cachedUser);
          const { data: syllabusData, cacheVersion: syllabusCacheVersion } = JSON.parse(cachedSyllabus);
          const { data: progressDataResponse, cacheVersion: progressCacheVersion } = JSON.parse(cachedProgress);

          if (isMounted) {
            // Set user-related states
            setUserName(userData.name || "User");
            setUserId(userData._id);
            const sub = userData.activeSubscription;
            let endDate = null;
            if (sub) {
              if (sub.endDate?.$date?.$numberLong) {
                endDate = new Date(parseInt(sub.endDate.$date.$numberLong));
              } else if (sub.endDate?.$date) {
                endDate = new Date(sub.endDate.$date);
              } else if (sub.endDate) {
                endDate = new Date(sub.endDate);
              }
            }
            const hasActiveSubscription =
              sub && sub.status === "active" && endDate > new Date();
            setIsSubscribed(hasActiveSubscription);
            setPurchasedCourses(
              userData.purchasedCourses?.map(
                (course) => course.courseId?.$oid || course.courseId
              ) || []
            );

            // Set progress-related states
            const { completedLessons, totalLessons, progressPercentage, isCompleted } = progressDataResponse;
            const color = `hsl(120, 80%, ${Math.max(40, 90 - progressPercentage * 0.5)}%)`;
            const visitedLessons = loadLessonStatus(course._id).visitedLessons;
            setProgressData({ percentage: progressPercentage, color, isCompleted });
            setVisitedLessons(visitedLessons);

            // Update syllabus with progress
            const updatedSyllabus = syllabusData.syllabus.map((section) => ({
              ...section,
              lessons: Array.isArray(section.lessons)
                ? section.lessons.map((lesson) => {
                    const isLessonLocked = lesson.isLocked === true;
                    return {
                      ...lesson,
                      isCompleted: progressDataResponse.completedLessons.includes(lesson._id),
                      isLocked:
                        isLessonLocked &&
                        !hasActiveSubscription &&
                        !userData.purchasedCourses?.some(
                          (c) => (c.courseId?.$oid || c.courseId) === course._id
                        ),
                    };
                  })
                : [],
            }));
            setSyllabus(updatedSyllabus);
            setError(null);
            setIsLoading(false); // Render UI immediately with cached data
          }
        } else if (isMounted) {
          setIsLoading(true); // Keep loading true if any cache is missing
        }

        // Fetch all data in parallel
        const [userResponse, syllabusResponse, progressResponse] = await Promise.all([
          api.get("/api/users/current").catch((error) => ({ error })),
          api.get(`/api/courses/${course._id}/syllabus`).catch((error) => ({ error })),
          api.get(`/api/progress/${course._id}`).catch((error) => ({ error })),
        ]);

        const userTraceId = getTraceId();
        const syllabusTraceId = getTraceId();
        const progressTraceId = getTraceId();

        // Process user data
        if (userResponse.error) {
          throw new Error(`Failed to fetch user data: ${userResponse.error.message}`);
        }
        logger.debug("Raw user response", { traceId: userTraceId, data: userResponse.data });
        if (!userResponse.data.success || userResponse.status !== 200) {
          throw new Error(`Failed to fetch user data: ${userResponse.status}`);
        }
        let userData = userResponse.data.user || userResponse.data;
        if (!userData || typeof userData !== "object") {
          throw new Error("Invalid user data format");
        }
        logger.debug("Processed userData", {
          traceId: userTraceId,
          name: userData.name,
          activeSubscription: userData.activeSubscription,
          purchasedCourses: userData.purchasedCourses,
          userId: userData._id,
        });

        // Parse endDate
        let endDate = null;
        const sub = userData.activeSubscription;
        if (sub) {
          if (sub.endDate?.$date?.$numberLong) {
            endDate = new Date(parseInt(sub.endDate.$date.$numberLong));
          } else if (sub.endDate?.$date) {
            endDate = new Date(sub.endDate.$date);
          } else if (sub.endDate) {
            endDate = new Date(sub.endDate);
          } else if (sub.status === "active") {
            logger.warn("No endDate found in activeSubscription", { traceId: userTraceId, sub });
          }
        } else {
          logger.debug("No activeSubscription in userData", { traceId: userTraceId, userData });
        }

        let hasActiveSubscription = sub && sub.status === "active" && (endDate ? endDate > new Date() : false);
        logger.debug("Subscription check", {
          traceId: userTraceId,
          hasSubscription: !!sub,
          status: sub?.status,
          endDateRaw: sub?.endDate,
          endDateParsed: endDate,
          isActive: hasActiveSubscription,
          purchasedCourses: userData.purchasedCourses,
          userName: userData.name,
        });

        // Check user cache version
        const userCacheVersion = userResponse.data.cacheVersion || Date.now();
        if (cachedUser) {
          const { cacheVersion: oldVersion } = JSON.parse(cachedUser);
          if (oldVersion !== userCacheVersion) {
            localStorage.setItem(userCacheKey, JSON.stringify({ data: userData, cacheVersion: userCacheVersion }));
          }
        } else {
          localStorage.setItem(userCacheKey, JSON.stringify({ data: userData, cacheVersion: userCacheVersion }));
        }

        if (isMounted) {
          setUserName(userData.name || "User");
          setUserId(userData._id);
          setIsSubscribed(hasActiveSubscription);
          setPurchasedCourses(
            userData.purchasedCourses?.map((course) => course.courseId?.$oid || course.courseId) || []
          );
        }

        // Process syllabus
        if (syllabusResponse.error) {
          throw new Error(`Failed to fetch syllabus: ${syllabusResponse.error.message}`);
        }
        logger.debug("Fetched syllabus from API", { traceId: syllabusTraceId, syllabusData: syllabusResponse.data });
        if (!syllabusResponse.data.success || syllabusResponse.status !== 200) {
          throw new Error(`Failed to fetch syllabus: ${syllabusResponse.status}`);
        }
        let syllabusData = syllabusResponse.data;
        if (!syllabusData.success || !Array.isArray(syllabusData.syllabus)) {
          throw new Error("Invalid syllabus data format");
        }

        // Check syllabus cache version
        const syllabusCacheVersion = syllabusResponse.data.cacheVersion || Date.now();
        if (cachedSyllabus) {
          const { cacheVersion: oldVersion } = JSON.parse(cachedSyllabus);
          if (oldVersion !== syllabusCacheVersion) {
            localStorage.setItem(syllabusCacheKey, JSON.stringify({ data: syllabusData, cacheVersion: syllabusCacheVersion }));
          }
        } else {
          localStorage.setItem(syllabusCacheKey, JSON.stringify({ data: syllabusData, cacheVersion: syllabusCacheVersion }));
        }

        // Process progress
        let progressDataResponse;
        if (progressResponse.error) {
          logger.warn("Failed to fetch progress, using local storage", {
            traceId: progressTraceId,
            error: progressResponse.error.message,
            response: progressResponse.error.response?.data,
          });
          const { completedLessons } = loadLessonStatus(course._id);
          const totalLessons = syllabusData.syllabus.reduce(
            (total, section) => total + (section.lessons?.length || 0),
            0
          );
          const completedCount = Object.values(completedLessons).filter(Boolean).length;
          progressDataResponse = {
            completedLessons: Object.keys(completedLessons).filter((id) => completedLessons[id]),
            totalLessons,
            progressPercentage: totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0,
            isCompleted: false,
          };
        } else {
          logger.debug("Progress response received", {
            traceId: progressTraceId,
            status: progressResponse.status,
            data: progressResponse.data,
          });
          if (!progressResponse.data.success || progressResponse.status !== 200) {
            throw new Error(`Progress fetch failed: ${progressResponse.status}`);
          }
          progressDataResponse = progressResponse.data.data.courseProgress;
        }

        // Check progress cache version
        const progressCacheVersion = progressResponse.data?.cacheVersion || Date.now();
        if (cachedProgress) {
          const { cacheVersion: oldVersion } = JSON.parse(cachedProgress);
          if (oldVersion !== progressCacheVersion) {
            localStorage.setItem(progressCacheKey, JSON.stringify({ data: progressDataResponse, cacheVersion: progressCacheVersion }));
          }
        } else {
          localStorage.setItem(progressCacheKey, JSON.stringify({ data: progressDataResponse, cacheVersion: progressCacheVersion }));
        }

        // Update syllabus with progress
        const { completedLessons, totalLessons, progressPercentage, isCompleted } = progressDataResponse;
        const color = `hsl(120, 80%, ${Math.max(40, 90 - progressPercentage * 0.5)}%)`;
        const visitedLessons = loadLessonStatus(course._id).visitedLessons;
        const updatedSyllabus = syllabusData.syllabus.map((section) => ({
          ...section,
          lessons: Array.isArray(section.lessons)
            ? section.lessons.map((lesson) => {
                const isLessonLocked = lesson.isLocked === true;
                logger.debug(`Processing Lesson ${lesson.title}`, {
                  traceId: syllabusTraceId,
                  apiIsLocked: lesson.isLocked,
                  computedIsLocked:
                    isLessonLocked &&
                    !hasActiveSubscription &&
                    !userData.purchasedCourses?.some(
                      (c) => (c.courseId?.$oid || c.courseId) === course._id
                    ),
                  isSubscribed: hasActiveSubscription,
                  isPurchased: userData.purchasedCourses?.some(
                    (c) => (c.courseId?.$oid || c.courseId) === course._id
                  ),
                });
                return {
                  ...lesson,
                  isCompleted: completedLessons.includes(lesson._id),
                  isLocked:
                    isLessonLocked &&
                    !hasActiveSubscription &&
                    !userData.purchasedCourses?.some(
                      (c) => (c.courseId?.$oid || c.courseId) === course._id
                    ),
                };
              })
            : [],
        }));

        if (isMounted) {
          setSyllabus(updatedSyllabus);
          setVisitedLessons(visitedLessons);
          setProgressData({ percentage: progressPercentage, color, isCompleted });
          setError(null);
        }
        logger.debug("Data fetch completed", {
          traceId: syllabusTraceId,
          syllabusLength: updatedSyllabus.length,
          isCompleted,
        });
      } catch (error) {
        const errorTraceId = getTraceId();
        logger.error("Error fetching data", {
          traceId: errorTraceId,
          message: error.message,
          response: error.response?.data,
          stack: error.stack,
        });
        // Only clear states if no cached data was used
        if (!cachedUser || !cachedSyllabus || !cachedProgress) {
          if (isMounted) {
            setError("Failed to load course content. Please try again.");
            setSyllabus([]);
            setUserName("User");
            setUserId(null);
            setIsSubscribed(false);
            setPurchasedCourses([]);
            setProgressData({ percentage: 0, color: "#e0f7e0", isCompleted: false });
          }
        }
      } finally {
        if (!cachedUser || !cachedSyllabus || !cachedProgress) {
          if (isMounted) setIsLoading(false); // Only set loading false if no cache was used
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [course, loadLessonStatus, navigate, setShowLogin]);

  // Handle subscribe
  const handleSubscribe = () => {
    navigate("/pricing");
    setShowLogin(true);
  };

  // Handle Enroll 
  const handleEnroll = (course) => {
    if (typeof course.newPrice !== "number" || isNaN(course.newPrice)) {
      console.error(`Invalid price for course: ${course.title}`);
      alert("Invalid course price. Please try again.");
      return;
    }

    const metadata = {
      purchaseType: "course",
      userId: userId || "unknown",
      courseId: course._id,
      amount: course.newPrice,
      duration: course.duration || "1 Year",
    };
    console.log("Enroll Only This clicked - Metadata:", metadata);

    const courseDetails = {
      id: course._id,
      name: course.title || "Untitled Course",
      type: "course",
      price: course.newPrice,
      duration: course.duration || "1 Year",
    };
    console.log("Enroll Only This clicked - Course Details:", courseDetails);

    localStorage.setItem("selectedCourse", JSON.stringify(courseDetails));
    navigate("/payment", { state: { courseDetails, ...metadata } });
  };

  // Handle lesson click
  const handleLessonClick = (lesson, sectionIndex, lessonIndex) => {
    const token = localStorage.getItem("accessToken")?.trim();
    if (!token) {
      navigate("/login", {
        state: { error: "Please log in to access the lesson." },
      });
      setShowLogin(true);
      return;
    }
    if (lesson.isLocked) {
      navigate("/pricing");
      setShowLogin(true);
      return;
    }
    const updatedVisited = { ...visitedLessons, [lesson._id]: true };
    setVisitedLessons(updatedVisited);
    if (course?._id) {
      saveVisitedLessons(course._id, updatedVisited);
    }
    setSelectedLesson(lesson);
    setSelectedLessonIndex({ sectionIndex, lessonIndex });
    setExpandedSections((prev) => ({
      ...prev,
      [sectionIndex]: true,
    }));
  };

  // Toggle section
  const toggleSection = (index) => {
    setExpandedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Mark lesson as completed with retry
  const markLessonAsCompleted = useCallback(
    async (lessonId, retryCount = 0) => {
      const traceId = getTraceId();
      if (!userId || !course?._id) {
        logger.warn("Cannot save progress: missing userId or courseId", {
          traceId,
          userId,
          courseId: course?._id,
        });
        setProgressError("Cannot save progress: missing user or course data.");
        return;
      }

      try {
        // Optimistically update UI
        setSyllabus((prevSyllabus) => {
          const updatedSyllabus = prevSyllabus.map((section) => ({
            ...section,
            lessons: Array.isArray(section.lessons)
              ? section.lessons.map((lesson) =>
                  lesson._id === lessonId
                    ? { ...lesson, isCompleted: true }
                    : lesson
                )
              : [],
          }));
          if (course?._id) {
            const completedLessons = loadLessonStatus(
              course._id
            ).completedLessons;
            completedLessons[lessonId] = true;
            saveCompletedLessons(course._id, completedLessons);
          }
          return updatedSyllabus;
        });
        if (selectedLesson?._id === lessonId) {
          setSelectedLesson((prev) => ({ ...prev, isCompleted: true }));
        }

        // Save to backend
        logger.debug("Saving lesson completion to /api/progress", {
          traceId,
          courseId: course._id,
          lessonId,
          userId,
        });
        const response = await api.post(
          "/api/progress",
          { courseId: course._id, lessonId },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Trace-Id": traceId,
            },
          }
        );
        logger.debug("Lesson completion response", {
          traceId,
          status: response.status,
          data: response.data,
        });
        if (!response.data.success) {
          throw new Error("Failed to save lesson completion");
        }

        // Update progress from backend
        const { progressPercentage, completedLessons, totalLessons } =
          response.data.data.courseProgress;
        const color = `hsl(120, 80%, ${Math.max(
          40,
          90 - progressPercentage * 0.5
        )}%)`;
        setProgressData((prev) => ({
          ...prev,
          percentage: progressPercentage,
          color,
        }));
        setSyllabus((prevSyllabus) =>
          prevSyllabus.map((section) => ({
            ...section,
            lessons: section.lessons.map((lesson) => ({
              ...lesson,
              isCompleted: completedLessons.includes(lesson._id),
            })),
          }))
        );
        setProgressError(null);

        // Update progress cache
        const progressCacheKey = `progress_${course._id}`;
        localStorage.setItem(
          progressCacheKey,
          JSON.stringify({
            data: response.data.data.courseProgress,
            cacheVersion: response.data.cacheVersion || Date.now(),
          })
        );
      } catch (error) {
        logger.error("Error marking lesson as completed in backend", {
          traceId,
          lessonId,
          courseId: course._id,
          userId,
          error: error.message,
          status: error.response?.status,
          response: error.response?.data,
          headers: error.response?.headers,
        });
        if (error.response?.status === 404 && retryCount < 2) {
          logger.warn("Retrying POST /api/progress", { traceId, retryCount });
          setTimeout(() => {
            markLessonAsCompleted(lessonId, retryCount + 1);
          }, 1000);
        } else {
          setProgressError(
            "Failed to save progress. Please try again later or contact support."
          );
        }
      }
    },
    [course, loadLessonStatus, saveCompletedLessons, selectedLesson, userId]
  );

  // Mark course as completed
  const markCourseAsCompleted = useCallback(
    async () => {
      const traceId = getTraceId();
      if (!userId || !course?._id) {
        logger.warn("Cannot mark course as completed: missing userId or courseId", {
          traceId,
          userId,
          courseId: course?._id,
        });
        setProgressError("Cannot mark course as completed: missing user or course data.");
        return;
      }

      try {
        // Optimistically update UI
        setProgressData((prev) => ({
          ...prev,
          percentage: 100,
          isCompleted: true,
        }));

        // Save to backend
        logger.debug("Marking course as completed via /api/progress/mark-completed", {
          traceId,
          courseId: course._id,
          userId,
        });
        const response = await api.post(
          "/api/progress/mark-completed",
          { courseId: course._id },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Trace-Id": traceId,
            },
          }
        );
        logger.debug("Course completion response", {
          traceId,
          status: response.status,
          data: response.data,
        });
        if (!response.data.success) {
          throw new Error("Failed to mark course as completed");
        }

        // Fetch updated progress
        const progressResponse = await api.get(`/api/progress/${course._id}`);
        if (!progressResponse.data.success) {
          throw new Error("Failed to fetch updated progress");
        }
        const { progressPercentage, completedLessons, totalLessons, isCompleted } =
          progressResponse.data.data.courseProgress;
        const color = `hsl(120, 80%, ${Math.max(
          40,
          90 - progressPercentage * 0.5
        )}%)`;
        setProgressData({
          percentage: progressPercentage,
          color,
          isCompleted,
        });
        setSyllabus((prevSyllabus) =>
          prevSyllabus.map((section) => ({
            ...section,
            lessons: section.lessons.map((lesson) => ({
              ...lesson,
              isCompleted: completedLessons.includes(lesson._id),
            })),
          }))
        );
        setProgressError(null);

        // Update progress cache
        const progressCacheKey = `progress_${course._id}`;
        localStorage.setItem(
          progressCacheKey,
          JSON.stringify({
            data: progressResponse.data.data.courseProgress,
            cacheVersion: progressResponse.data.cacheVersion || Date.now(),
          })
        );

        logger.debug("Course completed, staying on CourseContent page", { traceId });
      } catch (error) {
        logger.error("Error marking course as completed", {
          traceId,
          courseId: course._id,
          userId,
          error: error.message,
          status: error.response?.status,
          response: error.response?.data,
        });
        setProgressError(
          "Failed to mark course as completed. Please try again or contact support."
        );
        // Revert optimistic update
        setProgressData((prev) => ({
          ...prev,
          isCompleted: false,
        }));
      }
    },
    [course, userId]
  );

  // Handle next lesson
  const handleNextLesson = useCallback(() => {
    if (selectedLessonIndex) {
      const { sectionIndex, lessonIndex } = selectedLessonIndex;
      const currentSection = syllabus[sectionIndex];
      const nextLessonIndex = lessonIndex + 1;
      if (selectedLesson && !selectedLesson.isCompleted) {
        markLessonAsCompleted(selectedLesson._id);
      }
      if (nextLessonIndex < currentSection.lessons.length) {
        const nextLesson = currentSection.lessons[nextLessonIndex];
        const updatedVisited = { ...visitedLessons, [nextLesson._id]: true };
        setVisitedLessons(updatedVisited);
        if (course?._id) {
          saveVisitedLessons(course._id, updatedVisited);
        }
        setSelectedLesson(nextLesson);
        setSelectedLessonIndex({ sectionIndex, lessonIndex: nextLessonIndex });
      } else if (sectionIndex + 1 < syllabus.length) {
        const nextSection = syllabus[sectionIndex + 1];
        const nextLesson = nextSection.lessons[0];
        const updatedVisited = { ...visitedLessons, [nextLesson._id]: true };
        setVisitedLessons(updatedVisited);
        if (course?._id) {
          saveVisitedLessons(course._id, updatedVisited);
        }
        setSelectedLesson(nextLesson);
        setSelectedLessonIndex({
          sectionIndex: sectionIndex + 1,
          lessonIndex: 0,
        });
        setExpandedSections((prev) => ({
          ...prev,
          [sectionIndex + 1]: true,
        }));
      }
    }
  }, [
    selectedLessonIndex,
    syllabus,
    visitedLessons,
    course,
    saveVisitedLessons,
    selectedLesson,
    markLessonAsCompleted,
  ]);

  // Handle previous lesson
  const handlePrevLesson = useCallback(() => {
    if (selectedLessonIndex) {
      const { sectionIndex, lessonIndex } = selectedLessonIndex;
      const currentSection = syllabus[sectionIndex];
      const prevLessonIndex = lessonIndex - 1;
      if (prevLessonIndex >= 0) {
        const prevLesson = currentSection.lessons[prevLessonIndex];
        setSelectedLesson(prevLesson);
        setSelectedLessonIndex({ sectionIndex, lessonIndex: prevLessonIndex });
      } else if (sectionIndex - 1 >= 0) {
        const prevSection = syllabus[sectionIndex - 1];
        const prevLesson = prevSection.lessons[prevSection.lessons.length - 1];
        setSelectedLesson(prevLesson);
        setSelectedLessonIndex({
          sectionIndex: sectionIndex - 1,
          lessonIndex: prevSection.lessons.length - 1,
        });
        setExpandedSections((prev) => ({
          ...prev,
          [sectionIndex - 1]: true,
        }));
      }
    }
  }, [selectedLessonIndex, syllabus]);

  // Check if first or last lesson
  const isFirstLesson =
    selectedLessonIndex?.sectionIndex === 0 &&
    selectedLessonIndex?.lessonIndex === 0;
  const isLastLessonOfLastSection =
    selectedLessonIndex?.sectionIndex === syllabus.length - 1 &&
    selectedLessonIndex?.lessonIndex ===
      syllabus[syllabus.length - 1]?.lessons.length - 1;

  // Calculate section indices
  const currentSectionIndex = selectedLessonIndex?.sectionIndex ?? null;
  const totalSections = syllabus.length;

  // Handle mark as completed
  const handleMarkAsCompleted = useCallback(() => {
    const traceId = getTraceId();
    if (progressData.isCompleted) {
      logger.debug("Course already completed, redirecting to certificate", {
        traceId,
      });
      navigate("/certificate", {
        state: { course, completedAt: new Date() },
      });
      return;
    }
    // Mark the last lesson as completed if it's selected and not completed
    if (
      isLastLessonOfLastSection &&
      selectedLesson &&
      !selectedLesson.isCompleted
    ) {
      logger.debug("Marking last lesson as completed before course completion", {
        traceId,
        lessonId: selectedLesson._id,
      });
      markLessonAsCompleted(selectedLesson._id);
    }
    markCourseAsCompleted();
  }, [
    progressData.isCompleted,
    navigate,
    course,
    isLastLessonOfLastSection,
    selectedLesson,
    markLessonAsCompleted,
    markCourseAsCompleted,
  ]);

  // Handle close panel
  const handleClosePanel = () => {
    navigate("/");
  };

  // Check if all lessons completed except last
  const areAllLessonsCompletedExceptLast = useCallback(() => {
    for (let i = 0; i < syllabus.length; i++) {
      const section = syllabus[i];
      for (let j = 0; j < section.lessons.length; j++) {
        const lesson = section.lessons[j];
        if (
          !lesson.isCompleted &&
          !(i === syllabus.length - 1 && j === section.lessons.length - 1)
        ) {
          return false;
        }
      }
    }
    return true;
  }, [syllabus]);

  if (!course) {
    return (
      <div className="error-message">Course not found. Redirecting...</div>
    );
  }

  return (
    <div className="content-container">
      <div className="course-content">
        <div className="header-row">
          <button
            className="panel-close-button"
            onClick={handleClosePanel}
            aria-label="Close Course Content Panel"
          >
            <img src={PanelCloseIcon} alt="Close Panel" />
          </button>
          <div className="course-info">
            <h1 className="course-title">{course.title || "Untitled Course"}</h1>
            <h2 className="course-subtitle">Course Syllabus</h2>
          </div>
        </div>
        {isLoading && (
          <p className="loading-message">Loading course content...</p>
        )}
        {error && !isLoading && <p className="error-message">{error}</p>}
        {progressError && !isLoading && (
          <p className="error-message">{progressError}</p>
        )}
        {!isLoading && !error && (
          <div className="syllabus-container">
            {syllabus.length === 0 ? (
              <p className="no-syllabus-message">
                No syllabus sections available for this course.
              </p>
            ) : (
              syllabus.map((section, sectionIndex) => (
                <div
                  key={section._id || sectionIndex}
                  className="syllabus-section"
                >
                  <div
                    className="section-header"
                    onClick={() => toggleSection(sectionIndex)}
                  >
                    <h2>{`${sectionIndex + 1}. ${section.title}`}</h2>
                    <span
                      className={`toggle-icon ${
                        expandedSections[sectionIndex] ? "open" : ""
                      }`}
                    >
                      <img src={arrowDown} alt="Toggle Icon" />
                    </span>
                  </div>
                  {expandedSections[sectionIndex] && (
                    <div className="lesson-list">
                      {section.lessons.length === 0 ? (
                        <p className="no-lessons-message">
                          No lessons available in this section.
                        </p>
                      ) : (
                        section.lessons.map((lesson, lessonIndex) => {
                          logger.debug(`Render Lesson ${lesson.title}`, {
                            traceId: getTraceId(),
                            isLocked: lesson.isLocked,
                            isSubscribed,
                            isPurchased: purchasedCourses.includes(course._id),
                          });
                          const isActive = selectedLesson?._id === lesson._id;
                          const isCompleted = lesson.isCompleted;
                          const isLocked = lesson.isLocked;
                          const isLastLesson =
                            sectionIndex === syllabus.length - 1 &&
                            lessonIndex === section.lessons.length - 1;
                          let iconSrc, iconAlt;
                          if (isLocked) {
                            iconSrc = LockIcon;
                            iconAlt = "Locked";
                          } else if (isCompleted) {
                            iconSrc = TickIcon;
                            iconAlt = "Completed";
                          } else if (isActive) {
                            iconSrc = RadioIcon;
                            iconAlt = "Active";
                          } else {
                            iconSrc = UnLockIcon;
                            iconAlt = "Unlocked";
                          }
                          return (
                            <div
                              key={lesson._id || lessonIndex}
                              className="lesson-container"
                            >
                              <div
                                className={`lesson ${isActive ? "active" : ""}`}
                                onClick={() =>
                                  handleLessonClick(
                                    lesson,
                                    sectionIndex,
                                    lessonIndex
                                  )
                                }
                              >
                                <img
                                  src={iconSrc}
                                  alt={iconAlt}
                                  className="lesson-icon"
                                />
                                <div className="lesson-content">
                                  <h3 className="lesson-title">
                                    {lesson.title}
                                  </h3>
                                  {lesson.type === "assessment" && (
                                    <span className="assessment-tag">
                                      Assessment
                                    </span>
                                  )}
                                </div>
                              </div>
                              {selectedLesson?._id === lesson._id && (
                                <Suspense
                                  fallback={<div>Loading lesson...</div>}
                                >
                                  <div className="lesson-page-container">
                                    <LessonPage
                                      lesson={selectedLesson}
                                      onNextLesson={handleNextLesson}
                                      onPrevLesson={handlePrevLesson}
                                      onMarkAsCompleted={handleMarkAsCompleted}
                                      isFirstLesson={isFirstLesson}
                                      isLastLessonOfLastSection={
                                        isLastLessonOfLastSection
                                      }
                                      showPrevButton={!isFirstLesson}
                                      showNextButton={
                                        !isLastLessonOfLastSection
                                      }
                                      showMarkAsCompleted={
                                        isLastLessonOfLastSection &&
                                        !progressData.isCompleted
                                      }
                                      isMarkAsCompletedDisabled={
                                        isLastLessonOfLastSection &&
                                        !areAllLessonsCompletedExceptLast()
                                      }
                                      currentSectionIndex={currentSectionIndex}
                                      totalSections={totalSections}
                                    />
                                  </div>
                                </Suspense>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {!isLoading && !error && userName && course.title && (
          <CourseProgress
            syllabus={syllabus}
            progressPercentage={progressData.percentage}
            userName={userName}
            courseTitle={course.title}
            progressColor={progressData.color}
            isCompleted={progressData.isCompleted}
          />
        )}
        {!isLoading &&
          !error &&
          !isSubscribed &&
          !purchasedCourses.includes(course?._id) && (
            <div className="purchase-button-container">
              <button
                className="enroll-only-this"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnroll(course);
                }}
              >
                Enroll Only This
              </button>
              <button className="get-full-access" onClick={handleSubscribe}>
                Get Full Access
              </button>
            </div>
          )}
      </div>
    </div>
  );
};

export default CourseContent;