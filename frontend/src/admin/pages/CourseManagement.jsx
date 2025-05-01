import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import axios from "axios";
import "../styles/CourseManagement.css";

// Lazy load forms for better performance
const CourseForm = lazy(() => import("../forms/CourseForm"));
const SectionForm = lazy(() => import("../forms/SectionForm"));
const LessonForm = lazy(() => import("../forms/LessonForm"));
const QuizForm = lazy(() => import("../forms/QuizForm"));

// Backend URL constant
const BACKEND_URL = "https://api.skillnestx.com";

const CourseManagement = () => {
  // State for courses, search, and selected entities
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCourses, setFilteredCourses] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch all courses
  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axios.get(`${BACKEND_URL}/api/courses`);
      if (Array.isArray(response.data)) {
        setCourses(response.data);
        setFilteredCourses(response.data);
      } else {
        setCourses([]);
        setFilteredCourses([]);
        setError("Invalid data format received from the server.");
      }
    } catch (err) {
      setError("Failed to fetch courses. Please try again later.");
      console.error("Error fetching courses:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search courses by title or ID
  const searchCourses = useCallback(async () => {
    if (!searchQuery) {
      setFilteredCourses(courses);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await axios.get(`${BACKEND_URL}/api/courses/${searchQuery}`);
      if (response.data) {
        setFilteredCourses([response.data]); // Display the single course found
      } else {
        setFilteredCourses([]); // No course found
      }
    } catch (err) {
      setError("Failed to search for course. Please try again later.");
      console.error("Error searching for course:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, courses]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      searchCourses();
    }
  };

  // Generic function to handle API errors
  const handleApiError = (err, defaultMessage) => {
    setError(err.response?.data?.message || defaultMessage);
    console.error("API Error:", err);
  };

  // Add or update a course
  const handleSaveCourse = async (courseData) => {
    try {
      const endpoint = selectedCourse?._id
        ? `${BACKEND_URL}/api/courses/${selectedCourse._id}`
        : `${BACKEND_URL}/api/courses`;
      const method = selectedCourse?._id ? "put" : "post";
      const response = await axios[method](endpoint, courseData);

      setCourses((prevCourses) =>
        selectedCourse?._id
          ? prevCourses.map((course) =>
              course._id === selectedCourse._id ? response.data.course : course
            )
          : [...prevCourses, response.data.course]
      );
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      handleApiError(err, "Failed to save course. Please try again later.");
    }
  };

  // Delete a course
  const handleDeleteCourse = async (courseId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/courses/${courseId}`);
      setCourses((prevCourses) =>
        prevCourses.filter((course) => course._id !== courseId)
      );
      setSelectedCourse(null);
    } catch (err) {
      handleApiError(err, "Failed to delete course. Please try again later.");
    }
  };

  // Add or update a section
  const handleSaveSection = async (sectionData) => {
    try {
      const endpoint = selectedSection?._id
        ? `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}`
        : `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections`;
      const method = selectedSection?._id ? "put" : "post";
      const response = await axios[method](endpoint, sectionData);

      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === selectedCourse._id ? response.data.course : course
        )
      );
      setSelectedSection(null);
    } catch (err) {
      handleApiError(err, "Failed to save section. Please try again later.");
    }
  };

  // Delete a section
  const handleDeleteSection = async (sectionId) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${sectionId}`
      );
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === selectedCourse._id
            ? {
                ...course,
                syllabus: course.syllabus.filter(
                  (section) => section._id !== sectionId
                ),
              }
            : course
        )
      );
      setSelectedSection(null);
    } catch (err) {
      handleApiError(err, "Failed to delete section. Please try again later.");
    }
  };

  // Add or update a lesson
  const handleSaveLesson = async (lessonData) => {
    try {
      const endpoint = selectedLesson?._id
        ? `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}/lessons/${selectedLesson._id}`
        : `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}/lessons`;
      const method = selectedLesson?._id ? "put" : "post";
      const response = await axios[method](endpoint, lessonData);

      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === selectedCourse._id ? response.data.course : course
        )
      );
      setSelectedLesson(null);
    } catch (err) {
      handleApiError(err, "Failed to save lesson. Please try again later.");
    }
  };

  // Delete a lesson
  const handleDeleteLesson = async (lessonId) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}/lessons/${lessonId}`
      );
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === selectedCourse._id
            ? {
                ...course,
                syllabus: course.syllabus.map((section) =>
                  section._id === selectedSection._id
                    ? {
                        ...section,
                        lessons: section.lessons.filter(
                          (lesson) => lesson._id !== lessonId
                        ),
                      }
                    : section
                ),
              }
            : course
        )
      );
      setSelectedLesson(null);
    } catch (err) {
      handleApiError(err, "Failed to delete lesson. Please try again later.");
    }
  };

  // Add or update a quiz
  const handleSaveQuiz = async (quizData) => {
    try {
      const endpoint = selectedQuiz?._id
        ? `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}/lessons/${selectedLesson._id}/quiz/${selectedQuiz._id}`
        : `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}/lessons/${selectedLesson._id}/quiz`;
      const method = selectedQuiz?._id ? "put" : "post";
      const response = await axios[method](endpoint, quizData);

      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === selectedCourse._id ? response.data.course : course
        )
      );
      setSelectedQuiz(null);
    } catch (err) {
      handleApiError(err, "Failed to save quiz. Please try again later.");
    }
  };

  // Delete a quiz
  const handleDeleteQuiz = async (quizId) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/api/courses/${selectedCourse._id}/sections/${selectedSection._id}/lessons/${selectedLesson._id}/quiz/${quizId}`
      );
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === selectedCourse._id
            ? {
                ...course,
                syllabus: course.syllabus.map((section) =>
                  section._id === selectedSection._id
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === selectedLesson._id
                            ? {
                                ...lesson,
                                quiz: lesson.quiz.filter(
                                  (quiz) => quiz._id !== quizId
                                ),
                              }
                            : lesson
                        ),
                      }
                    : section
                ),
              }
            : course
        )
      );
      setSelectedQuiz(null);
    } catch (err) {
      handleApiError(err, "Failed to delete quiz. Please try again later.");
    }
  };

  // Fetch courses on component mount
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Update filtered courses whenever searchQuery or courses change
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCourses(courses); // Reset to all courses if search query is empty
    }
  }, [searchQuery, courses]);

  return (
    <div className="course-management">
      <h1>Course Management</h1>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search courses by title or ID"
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyPress={handleKeyPress}
          aria-label="Search courses"
        />
        <button onClick={searchCourses} aria-label="Search">
          🔍 Search
        </button>
      </div>

      {/* Buttons for Adding New Entities */}
      <div className="management-buttons">
        <button onClick={() => setSelectedCourse({})} aria-label="Add Course">
          ➕ Add New Course
        </button>
        <button onClick={() => setSelectedSection({})} aria-label="Add Section">
          ➕ Add New Section
        </button>
        <button onClick={() => setSelectedLesson({})} aria-label="Add Lesson">
          ➕ Add New Lesson
        </button>
        <button onClick={() => setSelectedQuiz({})} aria-label="Add Quiz">
          ➕ Add New Quiz
        </button>
      </div>

      {/* Display Courses */}
      <div className="course-list">
        {filteredCourses.map((course) => (
          <div key={course._id} className="course-item">
            <h2>{course.title}</h2>
            <button onClick={() => setSelectedCourse(course)} aria-label="Edit Course">
              🖊 Edit
            </button>
            <button onClick={() => handleDeleteCourse(course._id)} aria-label="Delete Course">
              🗑 Delete
            </button>

            {/* Display Sections */}
            {course.syllabus?.map((section) => (
              <div key={section._id} className="section-item">
                <h3>{section.title}</h3>
                <button onClick={() => setSelectedSection(section)} aria-label="Edit Section">
                  🖊 Edit
                </button>
                <button onClick={() => handleDeleteSection(section._id)} aria-label="Delete Section">
                  🗑 Delete
                </button>

                {/* Display Lessons */}
                {section.lessons?.map((lesson) => (
                  <div key={lesson._id} className="lesson-item">
                    <h4>{lesson.title}</h4>
                    <button onClick={() => setSelectedLesson(lesson)} aria-label="Edit Lesson">
                      🖊 Edit
                    </button>
                    <button onClick={() => handleDeleteLesson(lesson._id)} aria-label="Delete Lesson">
                      🗑 Delete
                    </button>

                    {/* Display Quizzes */}
                    {lesson.quiz?.map((quiz) => (
                      <div key={quiz._id} className="quiz-item">
                        <h5>{quiz.question}</h5>
                        <button onClick={() => setSelectedQuiz(quiz)} aria-label="Edit Quiz">
                          🖊 Edit
                        </button>
                        <button onClick={() => handleDeleteQuiz(quiz._id)} aria-label="Delete Quiz">
                          🗑 Delete
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Forms for Adding/Editing Entities */}
      <Suspense fallback={<div>Loading form...</div>}>
        {selectedCourse && (
          <CourseForm
            course={selectedCourse}
            onSave={handleSaveCourse}
            onCancel={() => setSelectedCourse(null)}
          />
        )}
        {selectedSection && (
          <SectionForm
            section={selectedSection}
            onSave={handleSaveSection}
            onCancel={() => setSelectedSection(null)}
          />
        )}
        {selectedLesson && (
          <LessonForm
            lesson={selectedLesson}
            onSave={handleSaveLesson}
            onCancel={() => setSelectedLesson(null)}
          />
        )}
        {selectedQuiz && (
          <QuizForm
            quiz={selectedQuiz}
            onSave={handleSaveQuiz}
            onCancel={() => setSelectedQuiz(null)}
          />
        )}
      </Suspense>

      {/* Error and Loading Messages */}
      {error && <p className="error">{error}</p>}
      {isLoading && <p>Loading...</p>}
    </div>
  );
};

export default CourseManagement;