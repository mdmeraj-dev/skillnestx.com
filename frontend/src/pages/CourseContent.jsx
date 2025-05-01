import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LockIcon from "/assets/icons/lock.svg";
import UnLockIcon from "/assets/icons/unlock.svg";
import TickIcon from "/assets/icons/tick.svg";
import RadioIcon from "/assets/icons/radio.svg";
import PanelCloseIcon from "/assets/icons/panel-close.svg";
import arrowDown from "/assets/icons/arrow-down.svg";
import CourseProgress from "../components/CourseProgress";
import "../styles/CourseContent.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;

// Lazy load the LessonPage component for better performance
const LessonPage = lazy(() => import("./LessonPage"));

const CourseContent = ({ setShowLogin }) => {
  const [syllabus, setSyllabus] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [purchasedCourses, setPurchasedCourses] = useState([]);
  const [error, setError] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [visitedLessons, setVisitedLessons] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { course } = location.state || {};

  // Load completed and visited lessons from localStorage
  const loadLessonStatus = useCallback((courseId) => {
    try {
      const savedCompleted = localStorage.getItem(`completedLessons_${courseId}`);
      const savedVisited = localStorage.getItem(`visitedLessons_${courseId}`);
      
      return {
        completedLessons: savedCompleted ? JSON.parse(savedCompleted) : {},
        visitedLessons: savedVisited ? JSON.parse(savedVisited) : {}
      };
    } catch (error) {
      console.error("Error loading lesson status:", error);
      return { completedLessons: {}, visitedLessons: {} };
    }
  }, []);

  // Save completed lessons to localStorage
  const saveCompletedLessons = useCallback((courseId, completedLessons) => {
    try {
      localStorage.setItem(
        `completedLessons_${courseId}`,
        JSON.stringify(completedLessons)
      );
    } catch (error) {
      console.error("Error saving completed lessons:", error);
    }
  }, []);

  // Save visited lessons to localStorage
  const saveVisitedLessons = useCallback((courseId, visitedLessons) => {
    try {
      localStorage.setItem(
        `visitedLessons_${courseId}`,
        JSON.stringify(visitedLessons)
      );
    } catch (error) {
      console.error("Error saving visited lessons:", error);
    }
  }, []);

  // Calculate course progress with dynamic color density
  const calculateProgressWithColor = useCallback(() => {
    if (!syllabus.length) return { percentage: 0, color: '#e0f7e0' };

    let totalLessons = 0;
    let completedLessons = 0;

    syllabus.forEach(section => {
      section.lessons.forEach(lesson => {
        totalLessons++;
        if (lesson.isCompleted) completedLessons++;
      });
    });

    const percentage = Math.round((completedLessons / totalLessons) * 100);
    
    const hue = 120;
    const saturation = 80;
    const lightness = 90 - (percentage * 0.5);
    const color = `hsl(${hue}, ${saturation}%, ${Math.max(40, lightness)}%)`;

    return { percentage, color };
  }, [syllabus]);

  // Redirect if course is not defined
  useEffect(() => {
    if (!course) {
      navigate("/");
    }
  }, [course, navigate]);

  // Check subscription and purchased courses status
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${BASE_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setIsSubscribed(userData.isSubscribed);
          setPurchasedCourses(userData.purchasedCourses || []);
        }
      } catch (error) {
        console.error("Error checking user access:", error);
      }
    };

    checkAccess();
  }, []);

  // Fetch course syllabus immediately and cache it
  useEffect(() => {
    const fetchSyllabus = async () => {
      if (course?._id) {
        setIsLoading(true);

        const cachedSyllabus = localStorage.getItem(`syllabus_${course._id}`);
        const { completedLessons, visitedLessons } = loadLessonStatus(course._id);
        
        if (cachedSyllabus) {
          const parsedSyllabus = JSON.parse(cachedSyllabus);
          
          const updatedSyllabus = parsedSyllabus.map((section) => ({
            ...section,
            lessons: section.lessons.map((lesson) => ({
              ...lesson,
              isCompleted: completedLessons[lesson._id] || false,
              isLocked: !isSubscribed && !purchasedCourses.includes(course._id),
            })),
          }));

          setSyllabus(updatedSyllabus);
          setVisitedLessons(visitedLessons);
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch(
            `${BASE_URL}/api/courses/${course._id}/syllabus`
          );

          if (!response.ok) throw new Error("Network response was not ok");

          const data = await response.json();
          
          const updatedSyllabus = data.syllabus.map((section) => ({
            ...section,
            lessons: section.lessons.map((lesson) => ({
              ...lesson,
              isCompleted: completedLessons[lesson._id] || false,
              isLocked: !isSubscribed && !purchasedCourses.includes(course._id),
            })),
          }));

          localStorage.setItem(
            `syllabus_${course._id}`,
            JSON.stringify(updatedSyllabus)
          );

          setSyllabus(updatedSyllabus);
          setVisitedLessons(visitedLessons);
          setError(null);
        } catch (error) {
          console.error("Error fetching syllabus:", error);
          setError("Failed to fetch syllabus. Please try again later.");
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSyllabus();
  }, [course, loadLessonStatus, isSubscribed, purchasedCourses]);

  // Update lesson locking and status
  useEffect(() => {
    if (syllabus.length > 0 && course?._id) {
      setSyllabus((prevSyllabus) => {
        const hasAccess = isSubscribed || purchasedCourses.includes(course._id);
        
        const updatedSyllabus = prevSyllabus.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) => ({
            ...lesson,
            isLocked: !hasAccess,
          })),
        }));

        if (JSON.stringify(updatedSyllabus) !== JSON.stringify(prevSyllabus)) {
          localStorage.setItem(`syllabus_${course._id}`, JSON.stringify(updatedSyllabus));
          return updatedSyllabus;
        }
        return prevSyllabus;
      });
    }
  }, [isSubscribed, purchasedCourses, course?._id, syllabus]);

  // Handle subscription button click
  const handleSubscribe = () => {
    navigate("/pricing");
    setShowLogin(true);
  };

  // Handle Buy button click
  const handleBuy = (course) => {
    const courseDetails = {
      title: course.title,
      duration: course.duration || "1 Year",
      price: `${course.newPrice}`,
    };

    localStorage.setItem("selectedCourse", JSON.stringify(courseDetails));
    navigate("/payment", { state: { courseDetails } });
  };

  // Handle lesson click
  const handleLessonClick = (lesson, sectionIndex, lessonIndex) => {
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

  // Toggle section expansion
  const toggleSection = (index) => {
    setExpandedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Mark a lesson as completed and save to localStorage
  const markLessonAsCompleted = useCallback((lessonId) => {
    setSyllabus((prevSyllabus) => {
      const updatedSyllabus = prevSyllabus.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) =>
          lesson._id === lessonId ? { ...lesson, isCompleted: true } : lesson
        ),
      }));

      if (course?._id) {
        const completedLessons = loadLessonStatus(course._id).completedLessons;
        completedLessons[lessonId] = true;
        saveCompletedLessons(course._id, completedLessons);
      }

      return updatedSyllabus;
    });

    if (selectedLesson?._id === lessonId) {
      setSelectedLesson((prev) => ({ ...prev, isCompleted: true }));
    }
  }, [course, loadLessonStatus, saveCompletedLessons, selectedLesson]);

  // Handle next lesson navigation
  const handleNextLesson = useCallback(() => {
    if (selectedLessonIndex) {
      const { sectionIndex, lessonIndex } = selectedLessonIndex;
      const currentSection = syllabus[sectionIndex];
      const nextLessonIndex = lessonIndex + 1;

      // Mark current lesson as completed before moving to next
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
  }, [selectedLessonIndex, syllabus, visitedLessons, course, saveVisitedLessons, selectedLesson, markLessonAsCompleted]);

  // Handle previous lesson navigation
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

  // Handle marking the lesson as completed
  const handleMarkAsCompleted = useCallback(() => {
    if (selectedLesson) {
      markLessonAsCompleted(selectedLesson._id);
    }
  }, [markLessonAsCompleted, selectedLesson]);

  // Handle closing the course content panel
  const handleClosePanel = () => {
    navigate("/");
  };

  // Check if the selected lesson is the first or last lesson of the last section
  const isFirstLesson =
    selectedLessonIndex?.sectionIndex === 0 &&
    selectedLessonIndex?.lessonIndex === 0;
  const isLastLessonOfLastSection =
    selectedLessonIndex?.sectionIndex === syllabus.length - 1 &&
    selectedLessonIndex?.lessonIndex ===
      syllabus[syllabus.length - 1]?.lessons.length - 1;

  // Check if all lessons (except the last lesson of the last section) are completed
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

  // Calculate currentSectionIndex and totalSections for the selected lesson
  const currentSectionIndex = selectedLessonIndex?.sectionIndex ?? null;
  const totalSections = syllabus.length;

  // Calculate progress with dynamic color
  const progressData = calculateProgressWithColor();

  if (!course) {
    return (
      <div className="error-message">Course not found. Redirecting...</div>
    );
  }

  return (
    <div className="content-container">
      <div className="course-content">
        {/* First Row: Panel Close Button and Course Title */}
        <div className="header-row">
          <button
            className="panel-close-button"
            onClick={handleClosePanel}
            aria-label="Close Course Content Panel"
          >
            <img src={PanelCloseIcon} alt="Close Panel" />
          </button>

          <div className="course-info">
            <h1 className="course-title">{course?.title}</h1>
            <h2 className=" S">Course Syllabus</h2>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <p className="loading-message">Loading course content...</p>
        )}

        {/* Error Message */}
        {error && !isLoading && <p className="error-message">{error}</p>}

        {/* Syllabus Container */}
        {!isLoading && !error && (
          <div className="syllabus-container">
            {syllabus.map((section, sectionIndex) => (
              <div key={section._id || sectionIndex} className="syllabus-section">
                {/* Section Header */}
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

                {/* Lesson List */}
                {expandedSections[sectionIndex] && (
                  <div className="lesson-list">
                    {section.lessons.map((lesson, lessonIndex) => {
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
                        <div key={lesson._id || lessonIndex} className="lesson-container">
                          {/* Lesson Title */}
                          <div
                            className={`lesson ${isActive ? "active" : ""}`}
                            onClick={() =>
                              handleLessonClick(lesson, sectionIndex, lessonIndex)
                            }
                          >
                            <img
                              src={iconSrc}
                              alt={iconAlt}
                              className="lesson-icon"
                            />

                            <div className="lesson-content">
                              <h3 className="lesson-title">{lesson.title}</h3>
                              {lesson.type === "assessment" && (
                                <span className="assessment-tag">Assessment</span>
                              )}
                            </div>
                          </div>

                          {/* Render LessonPage below the lesson title */}
                          {selectedLesson?._id === lesson._id && (
                            <Suspense fallback={<div>Loading lesson...</div>}>
                              <div className="lesson-page-container">
                                <LessonPage
                                  lesson={selectedLesson}
                                  onNextLesson={handleNextLesson}
                                  onPrevLesson={handlePrevLesson}
                                  onMarkAsCompleted={handleMarkAsCompleted}
                                  isFirstLesson={isFirstLesson}
                                  isLastLessonOfLastSection={isLastLessonOfLastSection}
                                  showPrevButton={!isFirstLesson}
                                  showNextButton={!isLastLessonOfLastSection}
                                  showMarkAsCompleted={isLastLessonOfLastSection && !isCompleted}
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
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Course Progress Component with dynamic color */}
        {!isLoading && !error && (
          <CourseProgress 
            syllabus={syllabus} 
            progressColor={progressData.color}
          />
        )}

        {/* Buy and Subscribe Buttons */}
        {!isLoading &&
          !error &&
          !isSubscribed &&
          !purchasedCourses.includes(course?._id) && (
            <div className="purchase-button-container">
              <button
                className="buy-only-this"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBuy(course);
                }}
              >
                Buy Only This
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