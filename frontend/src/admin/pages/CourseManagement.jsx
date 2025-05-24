import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../styles/CourseManagement.css";

// Lazy load forms
const CourseForm = lazy(() => import("../forms/CourseForm"));

// Simple form components for sections, lessons, and quizzes
const SectionForm = ({ section = {}, courseId, onSave }) => {
  const [title, setTitle] = useState(section.title || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    if (!title.trim()) {
      setError("Section title is required");
      setIsSubmitting(false);
      return;
    }
    if (title.length > 100) {
      setError("Section title must not exceed 100 characters");
      setIsSubmitting(false);
      return;
    }
    try {
      await onSave({ title, courseId });
      setSuccess("Section saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save section";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-course-management-form">
      <h2>{section._id ? "Update Section" : "Add Section"}</h2>
      <form onSubmit={handleSubmit}>
        <div className="admin-course-management-form-group">
          <label htmlFor="section-title">Section Title</label>
          <input
            id="section-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter section title"
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
        {error && <p className="admin-course-management-error">{error}</p>}
        {success && (
          <p className="admin-course-management-success">{success}</p>
        )}
        <div className="admin-course-management-form-actions">
          <button
            type="submit"
            className="admin-course-management-action-button save"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="course-spinner"></span> Saving...
              </>
            ) : (
              "Save Section"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const LessonForm = ({ lesson = {}, courseId, sectionId, onSave }) => {
  const [title, setTitle] = useState(lesson.title || "");
  const [content, setContent] = useState(lesson.content || "");
  const [isLocked, setIsLocked] = useState(lesson.isLocked || false);
  const [type, setType] = useState(lesson.type || "lesson");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    if (!title.trim() && !lesson._id) {
      setError("Lesson title is required");
      setIsSubmitting(false);
      return;
    }
    if (title.length > 100) {
      setError("Lesson title must not exceed 100 characters");
      setIsSubmitting(false);
      return;
    }
    if (!content.trim() && !lesson._id) {
      setError("Lesson content is required");
      setIsSubmitting(false);
      return;
    }
    if (content.length > 10000) {
      setError("Lesson content must not exceed 10000 characters");
      setIsSubmitting(false);
      return;
    }
    try {
      const payload = {};
      if (title.trim()) payload.title = title;
      if (content.trim()) payload.content = content;
      if (typeof isLocked === "boolean") payload.isLocked = isLocked;
      if (type) payload.type = type;
      await onSave({ ...payload, courseId, sectionId });
      setSuccess("Lesson saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save lesson";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-course-management-form">
      <h2>{lesson._id ? "Update Lesson" : "Add Lesson"}</h2>
      <form onSubmit={handleSubmit}>
        <div className="admin-course-management-form-group">
          <label htmlFor="lesson-title">Lesson Title</label>
          <input
            id="lesson-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter lesson title"
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
        <div className="admin-course-management-form-group">
          <label htmlFor="lesson-content">Content</label>
          <textarea
            id="lesson-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter lesson content"
            maxLength={10000}
            disabled={isSubmitting}
          />
        </div>
        <div className="admin-course-management-form-group">
          <label htmlFor="lesson-type">Type</label>
          <select
            id="lesson-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="lesson">Lesson</option>
            <option value="assessment">Assessment</option>
          </select>
        </div>
        <div className="admin-course-management-form-group lesson-lock">
          <label htmlFor="lesson-locked">
            <input
              id="lesson-locked"
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              disabled={isSubmitting}
            />
            Lock Lesson
          </label>
        </div>
        {error && <p className="admin-course-management-error">{error}</p>}
        {success && (
          <p className="admin-course-management-success">{success}</p>
        )}
        <div className="admin-course-management-form-actions">
          <button
            type="submit"
            className="admin-course-management-action-button save"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="course-spinner"></span> Saving...
              </>
            ) : (
              "Save Lesson"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const QuizForm = ({
  quiz = [],
  courseId,
  sectionId,
  lessonId,
  onSave,
  onUpdateQuestion,
  onDeleteQuestion,
}) => {
  const [questions, setQuestions] = useState(
    quiz.length > 0
      ? quiz
      : [{ question: "", options: ["", "", "", ""], correctAnswer: "" }]
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    if (field === "options") {
      newQuestions[index].options = value;
    } else {
      newQuestions[index][field] = value;
    }
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctAnswer: "" },
    ]);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    if (questions.length === 0) {
      setError("At least one question is required");
      setIsSubmitting(false);
      return;
    }
    if (
      questions.some(
        (q) =>
          (!q.question.trim() && questions.length > 0) ||
          q.question.length > 500 ||
          q.options.length !== 4 ||
          q.options.some((opt) => opt.length > 200) ||
          (!q.correctAnswer.trim() && questions.length > 0) ||
          q.correctAnswer.length > 200 ||
          (q.correctAnswer.trim() && !q.options.includes(q.correctAnswer))
      )
    ) {
      setError(
        "Each question must have a title (max 500 chars), exactly 4 options (max 200 chars each), and a correct answer that matches one of the options."
      );
      setIsSubmitting(false);
      return;
    }
    try {
      await onSave({ quiz: questions, courseId, sectionId, lessonId });
      setSuccess("Quiz saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const message = err.message || "Failed to save quiz";
      setError(
        message.includes("Quizzes can only be added to assessment lessons")
          ? "Quizzes can only be added to assessment lessons"
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateQuestion = async (index) => {
    const question = questions[index];
    setError("");
    setSuccess("");
    if (
      !question._id ||
      !question.question.trim() ||
      question.question.length > 500 ||
      question.options.length !== 4 ||
      question.options.some((opt) => opt.length > 200) ||
      !question.correctAnswer.trim() ||
      question.correctAnswer.length > 200 ||
      !question.options.includes(question.correctAnswer)
    ) {
      setError(
        "Question must have a valid ID, title (max 500 chars), exactly 4 options (max 200 chars each), and a correct answer that matches one of the options."
      );
      return;
    }
    try {
      await onUpdateQuestion({
        quizId: question._id,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        courseId,
        sectionId,
        lessonId,
      });
      setSuccess("Question updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to update question";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || message);
    }
  };

  const handleDeleteQuestion = async (index) => {
    const question = questions[index];
    setError("");
    setSuccess("");
    if (!question._id) {
      removeQuestion(index);
      return;
    }
    try {
      await onDeleteQuestion({
        quizId: question._id,
        courseId,
        sectionId,
        lessonId,
      });
      setQuestions(questions.filter((_, i) => i !== index));
      setSuccess("Question deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to delete question";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || message);
    }
  };

  return (
    <div className="admin-course-management-form">
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
      <h2>{quiz.length > 0 ? "Manage Quiz" : "Add Quiz"}</h2>
      <form onSubmit={handleSubmit}>
        {questions.map((q, index) => (
          <div key={index} className="admin-course-management-quiz-question">
            <div className="admin-course-management-form-group">
              <label htmlFor={`question-${index}`}>Question {index + 1}</label>
              <input
                id={`question-${index}`}
                type="text"
                value={q.question}
                onChange={(e) =>
                  handleQuestionChange(index, "question", e.target.value)
                }
                placeholder="Enter question"
                maxLength={500}
                disabled={isSubmitting}
              />
            </div>
            {q.options.map((opt, optIndex) => (
              <div
                key={optIndex}
                className="admin-course-management-form-group"
              >
                <label htmlFor={`option-${index}-${optIndex}`}>
                  Option {optIndex + 1}
                </label>
                <input
                  id={`option-${index}-${optIndex}`}
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...q.options];
                    newOptions[optIndex] = e.target.value;
                    handleQuestionChange(index, "options", newOptions);
                  }}
                  placeholder={`Enter option ${optIndex + 1}`}
                  maxLength={200}
                  disabled={isSubmitting}
                />
              </div>
            ))}
            <div className="admin-course-management-form-group">
              <label htmlFor={`correct-answer-${index}`}>Correct Answer</label>
              <select
                id={`correct-answer-${index}`}
                value={q.correctAnswer}
                onChange={(e) =>
                  handleQuestionChange(index, "correctAnswer", e.target.value)
                }
                disabled={isSubmitting}
              >
                <option value="">Select correct answer</option>
                {q.options.map(
                  (opt, optIndex) =>
                    opt.trim() && (
                      <option key={optIndex} value={opt}>
                        {opt}
                      </option>
                    )
                )}
              </select>
            </div>
            <div className=" admin-course-management-question-actions-container">
              <button
                type="button"
                onClick={addQuestion}
                className="admin-course-management-action-button add"
                disabled={questions.length >= 50 || isSubmitting}
              >
                Add Another Question
              </button>
              <div className="admin-course-management-question-actions">
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(index)}
                  className="admin-course-management-action-button delete"
                  disabled={isSubmitting}
                >
                  Delete Question
                </button>
              </div>
            </div>
          </div>
        ))}
        {error && <p className="admin-course-management-error">{error}</p>}
        {success && (
          <p className="admin-course-management-success">{success}</p>
        )}
        <div className="admin-course-management-form-actions">
          <button
            type="submit"
            className="admin-course-management-action-button save"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="course-spinner"></span> Saving...
              </>
            ) : (
              "Save Quiz"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Add at top of file, near imports
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Backend URL from environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Create axios instance with default headers
const api = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

// Update interceptor
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      config.headers["X-Trace-Id"] =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : generateUUID();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for token refresh and error handling
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
      const traceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : generateUUID();
      const isLoggingOut = localStorage.getItem("isLoggingOut") === "true";
      if (isLoggingOut) {
        console.debug("Skipping token refresh during logout", { traceId });
        return Promise.reject(error);
      }
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
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
        console.error("Token refresh error", {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        navigate("/login", {
          state: {
            error: "Your authentication has expired. Please log in again.",
          },
          replace: true,
        });
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

const CourseManagement = () => {
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    page: 1,
    limit: 10,
  });
  const [sort, setSort] = useState({ sortBy: "title", sortOrder: "desc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ data: [], message: "" });
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [expandedCourses, setExpandedCourses] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    totalCourses: 0,
    recentCourses: 0,
    totalCoursesData: Array(12).fill(0),
    recentCoursesData: Array(4).fill(0),
    weekLabels: ["Week 1", "Week 2", "Week 3", "Week 4"],
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [authError, setAuthError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // Dropdown options
  const years = Array.from({ length: 6 }, (_, i) => 2020 + i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  // Fetch all courses with details, including sections

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get("/api/admin/courses/details", {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          sortBy: sort.sortBy,
          sortOrder: sort.sortOrder,
          include: "sections",
        },
      });
      const { data, pagination: newPagination } = response.data;
      if (Array.isArray(data.courses)) {
        // Map syllabus to sections for consistency
        const coursesWithSections = data.courses.map((course) => ({
          ...course,
          sections: Array.isArray(course.syllabus) ? course.syllabus : [],
        }));

        setCourses(coursesWithSections);
        setPagination(newPagination);
        setMetrics((prev) => ({
          ...prev,
          totalCourses: data.totalCourses || 0,
          recentCoursesData: data.recentCoursesWeekly || Array(4).fill(0),
        }));
      } else {
        setCourses([]);
        setError("Invalid data format received from the server.");
      }
    } catch (err) {
      const message = err.response?.data?.message || "Failed to fetch courses.";
      const traceId = err.response?.data?.traceId || "N/A";
      setError(`${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, sort.sortBy, sort.sortOrder]);

  // Fetch metrics for total and recent courses
  const fetchMetrics = useCallback(async () => {
    try {
      // Fetch total courses for the selected year
      const totalResponse = await api.get("/api/admin/courses/total", {
        params: { year: selectedYear },
      });
      const totalData = totalResponse.data.data || {
        total: 0,
        history: Array(12).fill(0),
      };

      // Fetch recent courses for the selected year and month
      const recentResponse = await api.get("/api/admin/courses/recent", {
        params: { year: selectedYear, month: selectedMonth },
      });
      const recentData = recentResponse.data.data || {
        recent: 0,
        weekly: Array(4).fill(0),
      };

      // Calculate the number of weeks in the selected month
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const weeksInMonth = Math.ceil(daysInMonth / 7);
      const weekLabels = Array.from(
        { length: weeksInMonth },
        (_, i) => `Week ${i + 1}`
      );

      // Ensure recentData.weekly has the correct length
      const weeklyData = recentData.weekly?.length
        ? recentData.weekly
            .slice(0, weeksInMonth)
            .concat(Array(weeksInMonth - recentData.weekly.length).fill(0))
        : Array(weeksInMonth).fill(0);

      setMetrics({
        totalCourses: totalData.total || 0,
        totalCoursesData: totalData.history || Array(12).fill(0),
        recentCourses: recentData.recent || 0,
        recentCoursesData: weeklyData,
        weekLabels: weekLabels,
      });
    } catch (err) {
      const message = err.response?.data?.message || "Failed to fetch metrics.";
      const traceId = err.response?.data?.traceId || "N/A";
      setError(`${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  }, [selectedYear, selectedMonth]);

  // Search courses by title or category
  const searchCourses = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults({ data: [], message: "" });
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await api.get("/api/admin/courses/search", {
        params: {
          query: searchQuery.trim(),
          page: 1,
          limit: 10,
          include: "sections",
        },
      });
      const searchData = Array.isArray(response.data.data)
        ? response.data.data
        : [];
      const coursesWithSections = searchData.map((course) => ({
        ...course,
        sections: Array.isArray(course.syllabus) ? course.syllabus : [],
      }));
      setSearchResults({
        data: coursesWithSections,
        message: response.data.message || "",
      });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to search courses.";
      const traceId = err.response?.data?.traceId || "N/A";
      setError(`${message} (Trace ID: ${traceId})`);
      setSearchResults({ data: [], message: message });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults({ data: [], message: "" });
    setError("");
  };

  // Handle Enter key press for search
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      searchCourses();
    }
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // Handle sorting
  const handleSortChange = (newSortBy) => {
    setSort((prev) => ({
      sortBy: newSortBy,
      sortOrder:
        prev.sortBy === newSortBy && prev.sortOrder === "asc" ? "desc" : "asc",
    }));
  };

  // Toggle course expansion
  const toggleCourseExpansion = async (courseId) => {
    if (expandedCourses[courseId]) {
      setExpandedCourses((prev) => ({ ...prev, [courseId]: false }));
      return;
    }
    try {
      const courseInCourses = courses.find((c) => c._id === courseId);
      if (
        courseInCourses &&
        Array.isArray(courseInCourses.sections) &&
        courseInCourses.sections.length > 0
      ) {
        setExpandedCourses((prev) => ({ ...prev, [courseId]: true }));
        return;
      }
      const response = await api.get(`/api/admin/courses/${courseId}`, {
        params: { include: "sections" },
      });
      const courseData = response.data.data;
      const sections = Array.isArray(courseData.syllabus)
        ? courseData.syllabus
        : [];
      setCourses((prev) =>
        prev.map((c) =>
          c._id === courseId
            ? {
                ...c,
                sections: sections.length > 0 ? sections : c.sections || [],
              }
            : c
        )
      );
      setSearchResults((prev) => ({
        ...prev,
        data: prev.data.map((c) =>
          c._id === courseId
            ? {
                ...c,
                sections: sections.length > 0 ? sections : c.sections || [],
              }
            : c
        ),
      }));
      setExpandedCourses((prev) => ({ ...prev, [courseId]: true }));
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to fetch course sections.";
      const traceId = err.response?.data?.traceId || "N/A";
      setError(`${message} (Trace ID: ${traceId})`);
      setExpandedCourses((prev) => ({ ...prev, [courseId]: true }));
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  };

  // Add or update a course
  const handleSaveCourse = async (courseData) => {
    try {
      const endpoint = selectedCourse?._id
        ? `/api/admin/courses/${selectedCourse._id}`
        : "/api/admin/courses";
      const method = selectedCourse?._id ? "put" : "post";
      const response = await api[method](endpoint, courseData);
      setCourses((prevCourses) =>
        selectedCourse?._id
          ? prevCourses.map((course) =>
              course._id === selectedCourse._id
                ? { ...response.data.data, sections: course.sections || [] }
                : course
            )
          : [{ ...response.data.data, sections: [] }, ...prevCourses]
      );
      setSearchResults((prevResults) =>
        selectedCourse?._id
          ? {
              ...prevResults,
              data: prevResults.data.map((course) =>
                course._id === selectedCourse._id
                  ? { ...response.data.data, sections: course.sections || [] }
                  : course
              ),
            }
          : {
              ...prevResults,
              data: [
                { ...response.data.data, sections: [] },
                ...prevResults.data,
              ],
            }
      );
      setExpandedCourses((prev) => ({
        ...prev,
        [response.data.data._id]: false,
      }));
      setSelectedCourse(null);
      // Refresh data after saving course
      await Promise.all([fetchCourses(), fetchMetrics()]);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save course.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || `${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  };

  // Add or update a section
  const handleSaveSection = async ({ title, courseId }) => {
    try {
      const endpoint = selectedSection?._id
        ? `/api/admin/courses/${courseId}/sections/${selectedSection._id}`
        : `/api/admin/courses/${courseId}/sections`;
      const method = selectedSection?._id ? "put" : "post";
      const response = await api[method](endpoint, { title });
      const newSection = response.data.data;
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: selectedSection?._id
                  ? course.sections.map((section) =>
                      section._id === selectedSection._id
                        ? { ...section, title }
                        : section
                    )
                  : [
                      ...(course.sections || []),
                      { _id: newSection._id, title, lessons: [] },
                    ],
              }
            : course
        )
      );
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: selectedSection?._id
                  ? course.sections.map((section) =>
                      section._id === selectedSection._id
                        ? { ...section, title }
                        : section
                    )
                  : [
                      ...(course.sections || []),
                      { _id: newSection._id, title, lessons: [] },
                    ],
              }
            : course
        ),
      }));
      setSelectedSection(null);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save section.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || `${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  };

  // Add or update a lesson
  const handleSaveLesson = async ({
    title,
    content,
    isLocked,
    type,
    courseId,
    sectionId,
  }) => {
    try {
      const endpoint = selectedLesson?._id
        ? `/api/admin/courses/${courseId}/sections/${sectionId}/lessons/${selectedLesson._id}`
        : `/api/admin/courses/${courseId}/sections/${sectionId}/lessons`;
      const method = selectedLesson?._id ? "put" : "post";
      const response = await api[method](endpoint, {
        title,
        content,
        isLocked,
        type,
      });
      const newLesson = response.data.data;
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: selectedLesson?._id
                          ? section.lessons.map((lesson) =>
                              lesson._id === selectedLesson._id
                                ? { ...lesson, title, content, isLocked, type }
                                : lesson
                            )
                          : [
                              ...(section.lessons || []),
                              {
                                _id: newLesson._id,
                                title,
                                content,
                                isLocked,
                                type,
                                quiz: [],
                              },
                            ],
                      }
                    : section
                ),
              }
            : course
        )
      );
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: selectedLesson?._id
                          ? section.lessons.map((lesson) =>
                              lesson._id === selectedLesson._id
                                ? { ...lesson, title, content, isLocked, type }
                                : lesson
                            )
                          : [
                              ...(section.lessons || []),
                              {
                                _id: newLesson._id,
                                title,
                                content,
                                isLocked,
                                type,
                                quiz: [],
                              },
                            ],
                      }
                    : section
                ),
              }
            : course
        ),
      }));
      setSelectedLesson(null);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save lesson.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || `${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  };

  // Delete a section
  const handleDeleteSection = async ({ courseId, sectionId }) => {
    try {
      await api.delete(`/api/admin/courses/${courseId}/sections/${sectionId}`);
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.filter(
                  (section) => section._id !== sectionId
                ),
              }
            : course
        )
      );
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.filter(
                  (section) => section._id !== sectionId
                ),
              }
            : course
        ),
      }));

      toast.success("Section deleted successfully");
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to delete section.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || `${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  };

  // Delete a lesson
  const handleDeleteLesson = async ({ courseId, sectionId, lessonId }) => {
    try {
      await api.delete(
        `/api/admin/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}`
      );
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
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
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
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
        ),
      }));

      toast.success("Lesson deleted successfully");
    } catch (err) {
      const message = err.response?.data?.message || "Failed to delete lesson.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || `${message} (Trace ID: ${traceId})`);
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
    }
  };

  // Add or update a quiz
  const handleSaveQuiz = async ({ quiz, courseId, sectionId, lessonId }) => {
    try {
      const response = await api.post(
        `/api/admin/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quiz`,
        { quiz }
      );
      const newQuiz = response.data.data;
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === lessonId
                            ? { ...lesson, quiz: newQuiz }
                            : lesson
                        ),
                      }
                    : section
                ),
              }
            : course
        )
      );
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === lessonId
                            ? { ...lesson, quiz: newQuiz }
                            : lesson
                        ),
                      }
                    : section
                ),
              }
            : course
        ),
      }));
      setSelectedQuiz(null);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save quiz";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      if (err.response?.status === 401) {
        setAuthError(true);
        toast.error("Session expired. Please log in again.");
      }
      throw new Error(errors || `${message} (Trace ID: ${traceId})`);
    }
  };

  // Update a quiz question
  const handleUpdateQuizQuestion = async ({
    quizId,
    question,
    options,
    correctAnswer,
    courseId,
    sectionId,
    lessonId,
  }) => {
    try {
      const response = await api.put(
        `/api/admin/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quiz/${quizId}`,
        { question, options, correctAnswer }
      );
      const updatedQuestion = response.data.data;
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === lessonId
                            ? {
                                ...lesson,
                                quiz: lesson.quiz.map((q) =>
                                  q._id === quizId
                                    ? { ...q, question, options, correctAnswer }
                                    : q
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
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === lessonId
                            ? {
                                ...lesson,
                                quiz: lesson.quiz.map((q) =>
                                  q._id === quizId
                                    ? { ...q, question, options, correctAnswer }
                                    : q
                                ),
                              }
                            : lesson
                        ),
                      }
                    : section
                ),
              }
            : course
        ),
      }));

      return updatedQuestion;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to update quiz question.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      throw new Error(errors || `${message} (Trace ID: ${traceId})`);
    }
  };

  // Delete a quiz question
  const handleDeleteQuizQuestion = async ({
    quizId,
    courseId,
    sectionId,
    lessonId,
  }) => {
    try {
      await api.delete(
        `/api/admin/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quiz/${quizId}`
      );
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === lessonId
                            ? {
                                ...lesson,
                                quiz: lesson.quiz.filter(
                                  (q) => q._id !== quizId
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
      setSearchResults((prevResults) => ({
        ...prevResults,
        data: prevResults.data.map((course) =>
          course._id === courseId
            ? {
                ...course,
                sections: course.sections.map((section) =>
                  section._id === sectionId
                    ? {
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson._id === lessonId
                            ? {
                                ...lesson,
                                quiz: lesson.quiz.filter(
                                  (q) => q._id !== quizId
                                ),
                              }
                            : lesson
                        ),
                      }
                    : section
                ),
              }
            : course
        ),
      }));
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to delete quiz question.";
      const traceId = err.response?.data?.traceId || "N/A";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      throw new Error(errors || `${message} (Trace ID: ${traceId})`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true); // Start spinner
    try {
      if (deleteConfirm.type === "section") {
        await handleDeleteSection({
          courseId: deleteConfirm.courseId,
          sectionId: deleteConfirm.sectionId,
        });
      } else if (deleteConfirm.type === "lesson") {
        await handleDeleteLesson({
          courseId: deleteConfirm.courseId,
          sectionId: deleteConfirm.sectionId,
          lessonId: deleteConfirm.lessonId,
        });
      }
    } catch (err) {
      const message = err.response?.data?.message || "Failed to delete.";
      const traceId = err.response?.data?.traceId || "N/A";
      setError(`${message} (Trace ID: ${traceId})`);
    } finally {
      setIsDeleting(false); // Stop spinner
      setDeleteConfirm(null); // Close modal
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Check authentication on mount
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setError("Authentication required. Please log in again.");
      setAuthError(true);
      return;
    }
    fetchCourses();
    fetchMetrics();
  }, [fetchCourses, fetchMetrics]);

  // Redirect on persistent auth error
  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [authError, navigate]);

  // Clear error message for non-modal errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCourses();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCourses]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (
      selectedCourse ||
      selectedSection ||
      selectedLesson ||
      selectedQuiz ||
      deleteConfirm
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    selectedCourse,
    selectedSection,
    selectedLesson,
    selectedQuiz,
    deleteConfirm,
  ]);

  // Chart data for Total Courses (Line Chart)
  const totalCoursesChartData = {
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    datasets: [
      {
        label: "Total Courses",
        data: metrics.totalCoursesData,
        borderColor: "#3b4a68",
        backgroundColor: "rgba(59, 74, 104, 0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart data for Recent Courses (Bar Chart)
  const daysInMonthChart = new Date(selectedYear, selectedMonth, 0).getDate();
  const weeksInMonthChart = Math.ceil(daysInMonthChart / 7);
  const recentCoursesChartData = {
    labels: metrics.weekLabels,
    datasets: [
      {
        label: "Recent Courses",
        data: metrics.recentCoursesData,
        backgroundColor: "#3b4a68",
        borderColor: "#4c5e8a",
        borderWidth: 1,
      },
    ],
  };

  // Chart options for Total Courses (Line Chart)
  const totalCoursesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#202b3d",
        titleColor: "#d1d5db",
        bodyColor: "#d1d5db",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#d1d5db",
          maxTicksLimit: window.innerWidth <= 768 ? 6 : 12,
          callback: function (value, index) {
            const labels = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];
            if (window.innerWidth <= 768) {
              if (index % 2 === 0) {
                return labels[index];
              }
              return null;
            }
            return labels[index];
          },
        },
        grid: { color: "#2d3a55" },
      },
      y: {
        ticks: {
          color: "#d1d5db",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : null),
        },
        grid: { color: "#2d3a55" },
        min: 0,
        suggestedMax:
          Math.max(...metrics.totalCoursesData, metrics.totalCourses, 1) + 1,
      },
    },
  };

  // Chart options for Recent Courses (Bar Chart)
  const recentCoursesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#202b3d",
        titleColor: "#d1d5db",
        bodyColor: "#d1d5db",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#d1d5db",
          font: {
            size: window.innerWidth <= 768 ? 10 : 12,
          },
          maxRotation: 45,
          minRotation: 45,
        },
        grid: { color: "#2d3a55" },
      },
      y: {
        ticks: {
          color: "#d1d5db",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : null),
        },
        grid: { color: "#2d3a55" },
        min: 0,
        suggestedMax:
          Math.max(...metrics.recentCoursesData, metrics.recentCourses, 1) + 1,
      },
    },
  };

  return (
    <div className="admin-course-management-container">
      <h1 className="admin-course-management-title">Course Management</h1>

      {/* Metric Cards */}
      <div className="admin-course-management-metrics">
        <div className="admin-course-management-metric-card">
          <div className="admin-course-management-metric-header">
            <div className="admin-course-management-metric-title">
              Total Courses ({selectedYear})
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="admin-course-management-dropdown"
              aria-label="Select year for total courses"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-course-management-metric-value">
            {metrics.totalCourses}
          </div>

          <div className="admin-course-management-metric-chart">
            <Line
              data={totalCoursesChartData}
              options={totalCoursesChartOptions}
            />
          </div>
        </div>
        <div className="admin-course-management-metric-card">
          <div className="admin-course-management-metric-header">
            <div className="admin-course-management-metric-title">
              Recent Courses ({selectedYear}-
              {selectedMonth.toString().padStart(2, "0")})
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="admin-course-management-dropdown"
              aria-label="Select month for recent courses"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-course-management-metric-value">
            {metrics.recentCourses}
          </div>

          <div className="admin-course-management-metric-chart">
            <Bar
              data={recentCoursesChartData}
              options={recentCoursesChartOptions}
            />
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="admin-course-management-search-section">
        <svg
          className="admin-course-management-search-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search courses by title or category"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="admin-course-management-search-input"
          aria-label="Search courses by title or category"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="admin-course-management-action-button clear"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="admin-course-management-search-results">
          <h2 className="admin-course-management-search-results-title">
            Search Results
          </h2>
          {searchResults.data.length > 0 ? (
            <table className="admin-course-management-search-results-table">
              <thead>
                <tr>
                  <th></th> {/* Expand column */}
                  <th onClick={() => handleSortChange("title")}>
                    Course Name
                    {sort.sortBy === "title" && sort.sortOrder === "asc" && "↑"}
                  </th>
                  <th onClick={() => handleSortChange("category")}>
                    Category
                    {sort.sortBy === "category" &&
                      sort.sortOrder === "asc" &&
                      "↑"}
                  </th>
                  <th onClick={() => handleSortChange("oldPrice")}>
                    Old Price
                    {sort.sortBy === "oldPrice" &&
                      sort.sortOrder === "asc" &&
                      "↑"}
                  </th>
                  <th onClick={() => handleSortChange("newPrice")}>
                    New Price
                    {sort.sortBy === "newPrice" &&
                      sort.sortOrder === "asc" &&
                      "↑"}
                  </th>
                  <th onClick={() => handleSortChange("rating")}>
                    Rating Star
                    {sort.sortBy === "rating" &&
                      sort.sortOrder === "asc" &&
                      "↑"}
                  </th>
                  <th onClick={() => handleSortChange("ratingCount")}>
                    Rating Count
                    {sort.sortBy === "ratingCount" &&
                      sort.sortOrder === "asc" &&
                      "↑"}
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.data.map((course) => (
                  <React.Fragment key={course._id}>
                    <tr>
                      <td>
                        <button
                          onClick={() => toggleCourseExpansion(course._id)}
                          disabled={isLoading}
                          className="admin-course-management-action-button expand"
                          aria-label={
                            expandedCourses[course._id]
                              ? `Collapse ${course.title}`
                              : `Expand ${course.title}`
                          }
                        >
                          <span
                            className="material-icons"
                            style={{ fontSize: "16px" }}
                          >
                            {expandedCourses[course._id] ? "remove" : "add"}
                          </span>
                        </button>
                      </td>
                      <td data-label="Course Name">{course.title}</td>
                      <td data-label="Category">{course.category}</td>
                      <td data-label="Old Price">₹{course.oldPrice}</td>
                      <td data-label="New Price">₹{course.newPrice}</td>
                      <td data-label="Rating Star">
                        {course.rating.toFixed(1)}
                      </td>
                      <td data-label="Rating Count">{course.ratingCount}</td>
                      <td
                        data-label="Action"
                        className="admin-course-management-actions"
                      >
                        <button
                          onClick={() => setSelectedCourse(course)}
                          disabled={isLoading}
                          className="admin-course-management-action-button update"
                          aria-label={`Update course ${course.title}`}
                        >
                          Update
                        </button>
                        <button
                          onClick={() =>
                            setSelectedSection({ courseId: course._id })
                          }
                          disabled={isLoading}
                          className="admin-course-management-action-button add"
                          aria-label={`Add section to ${course.title}`}
                        >
                          Add Section
                        </button>
                      </td>
                    </tr>
                    {expandedCourses[course._id] && (
                      <tr className="admin-course-management-expanded-row">
                        <td colSpan={8}>
                          <div className="admin-course-management-expanded-content">
                            <h4>Sections</h4>
                            {Array.isArray(course.sections) &&
                            course.sections.length > 0 ? (
                              course.sections.map((section) => (
                                <div
                                  key={section._id}
                                  className="admin-course-management-section-item"
                                >
                                  <div className="admin-course-management-section-details">
                                    <span>{section.title}</span>
                                    <div className="admin-course-management-section-actions">
                                      <button
                                        onClick={() =>
                                          setSelectedSection({
                                            ...section,
                                            courseId: course._id,
                                          })
                                        }
                                        disabled={isLoading}
                                        className="admin-course-management-action-button update"
                                        aria-label={`Update section ${section.title}`}
                                      >
                                        Update
                                      </button>
                                      <button
                                        onClick={() =>
                                          setSelectedLesson({
                                            courseId: course._id,
                                            sectionId: section._id,
                                          })
                                        }
                                        disabled={isLoading}
                                        className="admin-course-management-action-button add"
                                        aria-label={`Add lesson to ${section.title}`}
                                      >
                                        Add Lesson
                                      </button>
                                      <button
                                        onClick={() =>
                                          setDeleteConfirm({
                                            type: "section",
                                            courseId: course._id,
                                            sectionId: section._id,
                                            title: section.title,
                                          })
                                        }
                                        disabled={isLoading}
                                        className="admin-course-management-action-button delete"
                                        aria-label={`Delete section ${section.title}`}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  {section.lessons &&
                                    section.lessons.length > 0 && (
                                      <div className="admin-course-management-lesson-list">
                                        {section.lessons.map((lesson) => (
                                          <div
                                            key={lesson._id}
                                            className="admin-course-management-lesson-item"
                                          >
                                            <div className="admin-course-management-lesson-details">
                                              <span>
                                                {lesson.title} ({lesson.type})
                                              </span>
                                              <div className="admin-course-management-lesson-actions">
                                                <button
                                                  onClick={() =>
                                                    setSelectedLesson({
                                                      ...lesson,
                                                      courseId: course._id,
                                                      sectionId: section._id,
                                                    })
                                                  }
                                                  disabled={isLoading}
                                                  className="admin-course-management-action-button update"
                                                  aria-label={`Update lesson ${lesson.title}`}
                                                >
                                                  Update
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    setSelectedQuiz({
                                                      courseId: course._id,
                                                      sectionId: section._id,
                                                      lessonId: lesson._id,
                                                      quiz: lesson.quiz || [],
                                                    })
                                                  }
                                                  disabled={isLoading}
                                                  className="admin-course-management-action-button add"
                                                  aria-label={
                                                    lesson.quiz &&
                                                    lesson.quiz.length > 0
                                                      ? `Manage quiz for ${lesson.title}`
                                                      : `Add quiz to ${lesson.title}`
                                                  }
                                                >
                                                  {lesson.quiz &&
                                                  lesson.quiz.length > 0
                                                    ? "Manage Quiz"
                                                    : "Add Quiz"}
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    setDeleteConfirm({
                                                      type: "lesson",
                                                      courseId: course._id,
                                                      sectionId: section._id,
                                                      lessonId: lesson._id,
                                                      title: lesson.title,
                                                    })
                                                  }
                                                  disabled={isLoading}
                                                  className="admin-course-management-action-button delete"
                                                  aria-label={`Delete lesson ${lesson.title}`}
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              ))
                            ) : (
                              <p>No sections available.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-course-management-empty">
              {searchResults.message ||
                "No courses found with this name/category"}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="admin-course-management-actions">
        <button
          onClick={() => setSelectedCourse({})}
          className="admin-course-management-action-button add"
          aria-label="Add new course"
        >
          Add Course
        </button>
      </div>

      {/* Only non-modal errors are displayed here */}
      {error && <p className="admin-course-management-error">{error}</p>}

      {/* Courses Table */}
      {isLoading ? (
        <div>
          {Array(5)
            .fill()
            .map((_, index) => (
              <div key={index} className="admin-course-management-skeleton" />
            ))}
        </div>
      ) : courses.length === 0 && !searchResults.data.length ? (
        <p className="admin-course-management-empty">No courses found.</p>
      ) : (
        <>
          <table className="admin-course-management-course-list">
            <thead>
              <tr>
                <th></th> {/* Expand column */}
                <th onClick={() => handleSortChange("title")}>
                  Course Name
                  {sort.sortBy === "title" && sort.sortOrder === "asc" && "↑"}
                </th>
                <th onClick={() => handleSortChange("category")}>
                  Category
                  {sort.sortBy === "category" &&
                    sort.sortOrder === "asc" &&
                    "↑"}
                </th>
                <th onClick={() => handleSortChange("oldPrice")}>
                  Old Price
                  {sort.sortBy === "oldPrice" &&
                    sort.sortOrder === "asc" &&
                    "↑"}
                </th>
                <th onClick={() => handleSortChange("newPrice")}>
                  New Price
                  {sort.sortBy === "newPrice" &&
                    sort.sortOrder === "asc" &&
                    "↑"}
                </th>
                <th onClick={() => handleSortChange("rating")}>
                  Rating Star
                  {sort.sortBy === "rating" && sort.sortOrder === "asc" && "↑"}
                </th>
                <th onClick={() => handleSortChange("ratingCount")}>
                  Rating Count
                  {sort.sortBy === "ratingCount" &&
                    sort.sortOrder === "asc" &&
                    "↑"}
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <React.Fragment key={course._id}>
                  <tr>
                    <td>
                      <button
                        onClick={() => toggleCourseExpansion(course._id)}
                        disabled={isLoading}
                        className="admin-course-management-action-button expand"
                        aria-label={
                          expandedCourses[course._id]
                            ? `Collapse ${course.title}`
                            : `Expand ${course.title}`
                        }
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: "16px" }}
                        >
                          {expandedCourses[course._id] ? "remove" : "add"}
                        </span>
                      </button>
                    </td>
                    <td data-label="Course Name">{course.title}</td>
                    <td data-label="Category">{course.category}</td>
                    <td data-label="Old Price">₹{course.oldPrice}</td>
                    <td data-label="New Price">₹{course.newPrice}</td>
                    <td data-label="Rating Star">{course.rating.toFixed(1)}</td>
                    <td data-label="Rating Count">{course.ratingCount}</td>
                    <td
                      data-label="Action"
                      className="admin-course-management-actions"
                    >
                      <button
                        onClick={() => setSelectedCourse(course)}
                        disabled={isLoading}
                        className="admin-course-management-action-button update"
                        aria-label={`Update course ${course.title}`}
                      >
                        Update
                      </button>
                      <button
                        onClick={() =>
                          setSelectedSection({ courseId: course._id })
                        }
                        disabled={isLoading}
                        className="admin-course-management-action-button add"
                        aria-label={`Add section to ${course.title}`}
                      >
                        Add Section
                      </button>
                    </td>
                  </tr>
                  {expandedCourses[course._id] && (
                    <tr className="admin-course-management-expanded-row">
                      <td colSpan={8}>
                        <div className="admin-course-management-expanded-content">
                          <h4>Sections</h4>
                          {Array.isArray(course.sections) &&
                          course.sections.length > 0 ? (
                            course.sections.map((section) => (
                              <div
                                key={section._id}
                                className="admin-course-management-section-item"
                              >
                                <div className="admin-course-management-section-details">
                                  <span>{section.title}</span>
                                  <div className="admin-course-management-section-actions">
                                    <button
                                      onClick={() =>
                                        setSelectedSection({
                                          ...section,
                                          courseId: course._id,
                                        })
                                      }
                                      disabled={isLoading}
                                      className="admin-course-management-action-button update"
                                      aria-label={`Update section ${section.title}`}
                                    >
                                      Update
                                    </button>
                                    <button
                                      onClick={() =>
                                        setSelectedLesson({
                                          courseId: course._id,
                                          sectionId: section._id,
                                        })
                                      }
                                      disabled={isLoading}
                                      className="admin-course-management-action-button add"
                                      aria-label={`Add lesson to ${section.title}`}
                                    >
                                      Add Lesson
                                    </button>
                                    <button
                                      onClick={() =>
                                        setDeleteConfirm({
                                          type: "section",
                                          courseId: course._id,
                                          sectionId: section._id,
                                          title: section.title,
                                        })
                                      }
                                      disabled={isLoading}
                                      className="admin-course-management-action-button delete"
                                      aria-label={`Delete section ${section.title}`}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                {section.lessons &&
                                  section.lessons.length > 0 && (
                                    <div className="admin-course-management-lesson-list">
                                      {section.lessons.map((lesson) => (
                                        <div
                                          key={lesson._id}
                                          className="admin-course-management-lesson-item"
                                        >
                                          <div className="admin-course-management-lesson-details">
                                            <span>
                                              {lesson.title} ({lesson.type})
                                            </span>
                                            <div className="admin-course-management-lesson-actions">
                                              <button
                                                onClick={() =>
                                                  setSelectedLesson({
                                                    ...lesson,
                                                    courseId: course._id,
                                                    sectionId: section._id,
                                                  })
                                                }
                                                disabled={isLoading}
                                                className="admin-course-management-action-button update"
                                                aria-label={`Update lesson ${lesson.title}`}
                                              >
                                                Update
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setSelectedQuiz({
                                                    courseId: course._id,
                                                    sectionId: section._id,
                                                    lessonId: lesson._id,
                                                    quiz: lesson.quiz || [],
                                                  })
                                                }
                                                disabled={isLoading}
                                                className="admin-course-management-action-button add"
                                                aria-label={
                                                  lesson.quiz &&
                                                  lesson.quiz.length > 0
                                                    ? `Manage quiz for ${lesson.title}`
                                                    : `Add quiz to ${lesson.title}`
                                                }
                                              >
                                                {lesson.quiz &&
                                                lesson.quiz.length > 0
                                                  ? "Manage Quiz"
                                                  : "Add Quiz"}
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setDeleteConfirm({
                                                    type: "lesson",
                                                    courseId: course._id,
                                                    sectionId: section._id,
                                                    lessonId: lesson._id,
                                                    title: lesson.title,
                                                  })
                                                }
                                                disabled={isLoading}
                                                className="admin-course-management-action-button delete"
                                                aria-label={`Delete lesson ${lesson.title}`}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            ))
                          ) : (
                            <p>No sections available.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {/* Pagination Controls */}
          <div className="admin-course-management-pagination">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="admin-course-management-action-button"
            >
              Previous
            </button>
            <span className="page-count">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="admin-course-management-action-button"
            >
              Next
            </button>
            <select
              value={pagination.limit}
              onChange={(e) =>
                setPagination((prev) => ({
                  ...prev,
                  limit: Number(e.target.value),
                  page: 1,
                }))
              }
              className="admin-course-management-dropdown pages-limit"
            >
              {[10, 20, 50].map((limit) => (
                <option key={limit} value={limit}>
                  {limit} per page
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Modals for Forms */}
      <Suspense fallback={<div>Loading form...</div>}>
        {selectedCourse && (
          <div className="admin-course-management-modal-overlay">
            <div className="admin-course-management-modal-content">
              <button
                className="admin-course-management-modal-close"
                onClick={() => setSelectedCourse(null)}
                aria-label="Close course form"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-icons" style={{ fontSize: "20px" }}>
                  close
                </span>
              </button>
              <CourseForm course={selectedCourse} onSave={handleSaveCourse} />
            </div>
          </div>
        )}
        {selectedSection && (
          <div className="admin-course-management-modal-overlay">
            <div className="admin-course-management-modal-content">
              <button
                className="admin-course-management-modal-close"
                onClick={() => setSelectedSection(null)}
                aria-label="Close section form"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-icons" style={{ fontSize: "20px" }}>
                  close
                </span>
              </button>
              <SectionForm
                section={selectedSection}
                courseId={selectedSection.courseId}
                onSave={handleSaveSection}
              />
            </div>
          </div>
        )}
        {selectedLesson && (
          <div className="admin-course-management-modal-overlay">
            <div className="admin-course-management-modal-content">
              <button
                className="admin-course-management-modal-close"
                onClick={() => setSelectedLesson(null)}
                aria-label="Close lesson form"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-icons" style={{ fontSize: "20px" }}>
                  close
                </span>
              </button>
              <LessonForm
                lesson={selectedLesson}
                courseId={selectedLesson.courseId}
                sectionId={selectedLesson.sectionId}
                onSave={handleSaveLesson}
              />
            </div>
          </div>
        )}
        {selectedQuiz && (
          <div className="admin-course-management-modal-overlay">
            <div className="admin-course-management-modal-content">
              <button
                className="admin-course-management-modal-close"
                onClick={() => setSelectedQuiz(null)}
                aria-label="Close quiz form"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-icons" style={{ fontSize: "20px" }}>
                  close
                </span>
              </button>
              <QuizForm
                quiz={selectedQuiz.quiz || []}
                courseId={selectedQuiz.courseId}
                sectionId={selectedQuiz.sectionId}
                lessonId={selectedQuiz.lessonId}
                onSave={handleSaveQuiz}
                onUpdateQuestion={handleUpdateQuizQuestion}
                onDeleteQuestion={handleDeleteQuizQuestion}
              />
            </div>
          </div>
        )}
        {deleteConfirm && (
          <div className="admin-course-management-modal-overlay">
            <div className="admin-course-management-delete-modal">
              <h2>Confirm Deletion</h2>
              <p>
                Are you sure you want to delete{" "}
                {deleteConfirm.type === "section" ? "section" : "lesson"} "
                {deleteConfirm.title}"? This action cannot be undone.
              </p>
              <div className="admin-course-management-delete-modal-actions">
                <button
                  onClick={confirmDelete}
                  className="admin-course-management-action-button delete"
                  aria-label="Confirm deletion"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span>
                      <span className="course-spinner"></span>
                      Deleting...
                    </span>
                  ) : (
                    "Confirm"
                  )}
                </button>
                <button
                  onClick={cancelDelete}
                  className="admin-course-management-action-button cancel"
                  aria-label="Cancel deletion"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Suspense>
    </div>
  );
};

export default CourseManagement;
