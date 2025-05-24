import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "../styles/LessonPage.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CopyToClipboard from "react-copy-to-clipboard";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml"; // Covers HTML and XML
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";

// Register languages with highlight.js
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("html", xml); // XML module covers HTML
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("scss", scss);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", c);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);

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
    plaintext: "plaintext",
  };
  const normalizedLanguage = language ? language.toLowerCase() : "plaintext";
  const mapped = languageMap[normalizedLanguage] || "plaintext";
  return mapped;
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
  onNextLesson = () => {},
  onPrevLesson = () => {},
  onMarkAsCompleted = () => {},
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
    onMarkAsCompleted();
  };

  const renderContentWithCode = (content) => {
    const codeBlockRegex = /<code>(.*?)<\/code>/gs;
    const parts = content.split(codeBlockRegex);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const trimmedPart = part.trim();
        const result = hljs.highlightAuto(trimmedPart);
        const detectedLanguage = result.language || "plaintext";
        const mappedLanguage = mapLanguage(detectedLanguage);

        return (
          <div key={index} className="code-container">
            <div className="code-block">
              <div className="code-header">
                <span className="language-tag">{mappedLanguage}</span>
                <CopyToClipboard
                  text={trimmedPart}
                  onCopy={() => {
                    setCopiedIndex(index);
                    setTimeout(() => setCopiedIndex(null), 1500);
                  }}
                >
                  <button className="copy-button">
                    <img
                      src="/assets/icons/copy.svg"
                      alt="Copy"
                      className="copy-icon"
                    />
                    <span>{copiedIndex === index ? "Copied!" : "Copy"}</span>
                  </button>
                </CopyToClipboard>
              </div>
              <SyntaxHighlighter
                language={mappedLanguage}
                style={vscDarkPlus}
                tabWidth={4}
                showLineNumbers
                wrapLines
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  borderRadius: "0 0 8px 8px",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  background: "#1e1e1e",
                }}
              >
                {trimmedPart}
              </SyntaxHighlighter>
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
      {lesson.isLocked ? (
        <div className="locked-message">
          <h3>This lesson is locked. Please purchase the course or subscribe to access it.</h3>
        </div>
      ) : (
        <>
          {lesson.type !== "assessment" && (
            <h2 className="lesson-page-title">We Will Learn: {lesson.title}</h2>
          )}
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
            <div className="lesson-content">
              {renderContentWithCode(lesson.content)}
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
        </>
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