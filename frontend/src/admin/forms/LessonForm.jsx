import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const LessonForm = ({ lesson, onSave, onCancel }) => {
  // State for form fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [type, setType] = useState("lesson");
  const [error, setError] = useState("");

  // Pre-fill form when editing a lesson
  useEffect(() => {
    if (lesson) {
      setTitle(lesson.title || "");
      setContent(lesson.content || "");
      setIsLocked(lesson.isLocked || false);
      setType(lesson.type || "lesson");
    } else {
      resetForm();
    }
  }, [lesson]);

  // Reset form fields
  const resetForm = () => {
    setTitle("");
    setContent("");
    setIsLocked(false);
    setType("lesson");
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!title || !content) {
      setError("Title and content are required.");
      return;
    }

    // Prepare lesson data
    const lessonData = {
      title,
      content,
      isLocked,
      type,
    };

    // Call the onSave function passed from CourseManagement.jsx
    onSave(lessonData);
    setError("");
  };

  return (
    <div className="lesson-form">
      <h2>{lesson ? "Edit Lesson" : "Add New Lesson"}</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="form-group">
          <label>Lesson Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter lesson title"
            required
          />
        </div>

        {/* Content */}
        <div className="form-group">
          <label>Lesson Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter lesson content"
            required
          />
        </div>

        {/* Locked Status */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
            />
            Locked
          </label>
        </div>

        {/* Lesson Type */}
        <div className="form-group">
          <label>Lesson Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            <option value="lesson">Lesson</option>
            <option value="assessment">Assessment</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button type="submit" className="btn-save">
            {lesson ? "Update Lesson" : "Add Lesson"}
          </button>
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// Prop validation
LessonForm.propTypes = {
  lesson: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
    content: PropTypes.string,
    isLocked: PropTypes.bool,
    type: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

LessonForm.defaultProps = {
  lesson: null, // Default value for lesson
};

export default LessonForm;