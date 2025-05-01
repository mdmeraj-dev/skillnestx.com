import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const QuizForm = ({ quiz, onSave, onCancel }) => {
  // State for form fields
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]); // 4 options by default
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [error, setError] = useState("");

  // Pre-fill form when editing a quiz
  useEffect(() => {
    if (quiz) {
      setQuestion(quiz.question || "");
      setOptions(quiz.options || ["", "", "", ""]);
      setCorrectAnswer(quiz.correctAnswer || "");
    } else {
      resetForm();
    }
  }, [quiz]);

  // Reset form fields
  const resetForm = () => {
    setQuestion("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("");
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!question || options.some((option) => !option) || !correctAnswer) {
      setError("All fields are required.");
      return;
    }

    // Prepare quiz data
    const quizData = {
      question,
      options,
      correctAnswer,
    };

    // Call the onSave function passed from CourseManagement.jsx
    onSave(quizData);
    setError("");
  };

  // Handle option change
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="quiz-form">
      <h2>{quiz ? "Edit Quiz" : "Add New Quiz"}</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Question */}
        <div className="form-group">
          <label>Question</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter quiz question"
            required
          />
        </div>

        {/* Options */}
        <div className="form-group">
          <label>Options</label>
          {options.map((option, index) => (
            <input
              key={index}
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              required
            />
          ))}
        </div>

        {/* Correct Answer */}
        <div className="form-group">
          <label>Correct Answer</label>
          <select
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            required
          >
            <option value="" disabled>
              Select the correct answer
            </option>
            {options.map((option, index) => (
              <option key={index} value={option}>
                {option || `Option ${index + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button type="submit" className="btn-save">
            {quiz ? "Update Quiz" : "Add Quiz"}
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
QuizForm.propTypes = {
  quiz: PropTypes.shape({
    _id: PropTypes.string,
    question: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string),
    correctAnswer: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

QuizForm.defaultProps = {
  quiz: null, // Default value for quiz
};

export default QuizForm;