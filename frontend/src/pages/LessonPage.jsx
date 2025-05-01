import { useState, useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import "../styles/LessonPage.css";
import detectLang from "lang-detector";

// Lazy-loaded components for better performance
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({
    default: module.Prism,
  }))
);
const CopyToClipboard = lazy(() => import("react-copy-to-clipboard"));
const vscDarkPlus = lazy(() =>
  import("react-syntax-highlighter/dist/esm/styles/prism").then((module) => ({
    default: module.vscDarkPlus,
  }))
);

// Function to detect language using lang-detector
const detectLanguage = (code) => {
  const detected = detectLang(code);
  return detected || "plaintext"; // Default to plaintext if no match
};

// Map detected language to a supported language by react-syntax-highlighter
const mapLanguage = (language) => {
  const languageMap = {
    javascript: "javascript",
    js: "javascript",
    jsx: "javascript",
    typescript: "typescript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    css: "css",
    scss: "scss",
    python: "python",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    bash: "bash",
    sh: "bash",
    json: "json",
    xml: "xml",
    markdown: "markdown",
    md: "markdown",
    sql: "sql",
    php: "php",
    ruby: "ruby",
    rb: "ruby",
    go: "go",
    rust: "rust",
    rs: "rust",
    kotlin: "kotlin",
    kt: "kotlin",
    swift: "swift",
    plaintext: "plaintext", // Fallback
  };
  return languageMap[language.toLowerCase()] || "plaintext";
};

const LessonPage = ({
  lesson = {
    _id: "default-id",
    title: "Default Lesson Title",
    content: "Default lesson content.",
    isLocked: false,
    isCompleted: false,
    type: "lesson",
    quiz: [],
  },
  onNextLesson = () => console.log("Next Lesson"),
  onPrevLesson = () => console.log("Previous Lesson"),
  onMarkAsCompleted = () => console.log("Mark as Completed"),
  isFirstLesson = false,
  isLastLessonOfLastSection = false,
  showPrevButton = true,
  showNextButton = true,
  showMarkAsCompleted = false,
  isMarkAsCompletedDisabled = false,
  currentSectionIndex = 0,
  totalSections = 1,
}) => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Load cached user answers and quiz results from localStorage
  useEffect(() => {
    const cachedAnswers = localStorage.getItem(`userAnswers_${lesson._id}`);
    const cachedResults = localStorage.getItem(`quizResults_${lesson._id}`);
    if (cachedAnswers) setUserAnswers(JSON.parse(cachedAnswers));
    if (cachedResults) setQuizResults(JSON.parse(cachedResults));
  }, [lesson._id]);

  // Save user answers and quiz results to localStorage
  useEffect(() => {
    localStorage.setItem(`userAnswers_${lesson._id}`, JSON.stringify(userAnswers));
    localStorage.setItem(`quizResults_${lesson._id}`, JSON.stringify(quizResults));
  }, [userAnswers, quizResults, lesson._id]);

  const handleMarkAsCompleted = () => {
    console.log("Mark as Completed clicked for lesson:", lesson._id);
    onMarkAsCompleted();
  };

  const renderContentWithCode = (content) => {
    const codeBlockRegex = /<code>(.*?)<\/code>/gs;
    const parts = content.split(codeBlockRegex);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const detectedLanguage = detectLanguage(part);
        const language = mapLanguage(detectedLanguage);

        return (
          <div key={index} className="code-container">
            <div className="code-block">
              <div className="code-header">
                <span className="language-tag">{language.toLowerCase()}</span>
                <Suspense fallback={<div>Loading...</div>}>
                  <CopyToClipboard
                    text={part}
                    onCopy={() => {
                      setCopiedIndex(index);
                      setTimeout(() => setCopiedIndex(null), 1500);
                    }}
                  >
                    <button className="copy-button">
                      {copiedIndex === index ? "Copied!" : "Copy Code"}
                    </button>
                  </CopyToClipboard>
                </Suspense>
              </div>
              <Suspense fallback={<div>Loading Syntax Highlighter...</div>}>
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  tabWidth={4}
                  showLineNumbers
                  wrapLines
                >
                  {part}
                </SyntaxHighlighter>
              </Suspense>
            </div>
          </div>
        );
      } else {
        return <p key={index}>{part}</p>;
      }
    });
  };

  const handleQuizOptionSelect = (questionIndex, option) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: option,
    }));
  };

  const handleQuizSubmit = () => {
    const quizQuestions = lesson.quiz || [];
    const results = {};

    quizQuestions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      results[index] = { isCorrect, correctAnswer: question.correctAnswer };
    });

    setQuizResults(results);
    setShowQuizResults(true);
  };

  const getAssessmentTitle = () => {
    if (typeof currentSectionIndex !== "number" || typeof totalSections !== "number") {
      return "Assessment: Test Your Understanding of This Section";
    }
    if (currentSectionIndex === totalSections - 1) {
      return "Final Assessment: Prove Your Expertise in This Section";
    } else {
      return `Assessment ${currentSectionIndex + 1}: Showcase Your Mastery of This Section`;
    }
  };

  return (
    <div className="lesson-page">
      {/* Show "We Will Learn" only for lessons, not assessments */}
      {lesson.type !== "assessment" && (
        <h2 className="lesson-page-title">We Will Learn: {lesson.title}</h2>
      )}

      {/* Render Quiz for Assessments */}
      {lesson.type === "assessment" ? (
        <>
          <div className="quiz-section">
            <h3>{getAssessmentTitle()}</h3>
            {lesson.quiz.map((question, questionIndex) => (
              <div key={questionIndex} className="quiz-question">
                <h4>{`${questionIndex + 1}. ${question.question}`}</h4>
                <div className="quiz-options">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`quiz-option ${
                        userAnswers[questionIndex] === option ? "selected" : ""
                      } ${
                        showQuizResults
                          ? option === question.correctAnswer
                            ? "correct"
                            : userAnswers[questionIndex] === option
                              ? "incorrect"
                              : ""
                          : ""
                      }`}
                      onClick={() =>
                        handleQuizOptionSelect(questionIndex, option)
                      }
                    >
                      <input
                        type="radio"
                        name={`question-${questionIndex}`}
                        checked={userAnswers[questionIndex] === option}
                        onChange={() => {}}
                      />
                      <span>{option}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Quiz Results */}
            {showQuizResults && (
              <div className="quiz-results">
                <h4>Quiz Results</h4>
                <p>
                  Correct Answers:{" "}
                  <span className="result-value">
                    {
                      Object.values(quizResults).filter(
                        (result) => result.isCorrect
                      ).length
                    }{" "}
                    / {lesson.quiz.length}
                  </span>
                </p>
              </div>
            )}

            {/* Submit button for quiz (only shown before submission) */}
            {!showQuizResults && (
              <div className="quiz-submit-container">
                <button
                  className="nav-button submit-button"
                  onClick={handleQuizSubmit}
                >
                  Submit
                </button>
              </div>
            )}
          </div>

          {/* Navigation buttons for assessments */}
          {showQuizResults && (
            <div className="quiz-navigation">
              {showPrevButton && (
                <button
                  className="nav-button prev-button"
                  onClick={onPrevLesson}
                >
                  <img src="/assets/icons/arrow-back.svg" alt="Arrow Back" />
                  <span> Prev</span>
                </button>
              )}
              {showNextButton && (
                <button
                  className="nav-button next-button"
                  onClick={onNextLesson}
                >
                  <span> Next</span>
                  <img src="/assets/icons/arrow-next.svg" alt="Arrow Next" />
                </button>
              )}
              {showMarkAsCompleted && (
                <button
                  className="nav-button mark-completed-button"
                  onClick={handleMarkAsCompleted}
                  disabled={isMarkAsCompletedDisabled}
                >
                  Mark as Completed
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* Render Regular Lesson Content */
        <div className="lesson-content">
          {renderContentWithCode(lesson.content)}
          
          /* Navigation buttons for regular lessons */
          <div className="lesson-navigation">
            {showPrevButton && (
              <button className="nav-button prev-button" onClick={onPrevLesson}>
                <img src="/assets/icons/arrow-back.svg" alt="Arrow Back" />
                <span> Prev</span>
              </button>
            )}
            {showNextButton && (
              <button className="nav-button next-button" onClick={onNextLesson}>
                <span> Next</span>
                <img src="/assets/icons/arrow-next.svg" alt="Arrow Next" />
              </button>
            )}
            {showMarkAsCompleted && (
              <button
                className="nav-button mark-completed-button"
                onClick={handleMarkAsCompleted}
                disabled={isMarkAsCompletedDisabled}
              >
                Mark as Completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

LessonPage.propTypes = {
  lesson: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
    content: PropTypes.string,
    isLocked: PropTypes.bool,
    isCompleted: PropTypes.bool,
    type: PropTypes.string,
    quiz: PropTypes.arrayOf(
      PropTypes.shape({
        question: PropTypes.string,
        options: PropTypes.arrayOf(PropTypes.string),
        correctAnswer: PropTypes.string,
      })
    ),
  }),
  onNextLesson: PropTypes.func,
  onPrevLesson: PropTypes.func,
  onMarkAsCompleted: PropTypes.func,
  isFirstLesson: PropTypes.bool,
  isLastLessonOfLastSection: PropTypes.bool,
  showPrevButton: PropTypes.bool,
  showNextButton: PropTypes.bool,
  showMarkAsCompleted: PropTypes.bool,
  isMarkAsCompletedDisabled: PropTypes.bool,
  currentSectionIndex: PropTypes.number,
  totalSections: PropTypes.number,
};

export default LessonPage;