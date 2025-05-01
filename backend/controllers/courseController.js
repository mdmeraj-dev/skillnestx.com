import Course from "../models/Course.js";
import { validationResult } from "express-validator";

// Utility function for error handling
const handleError = (res, error, defaultMessage) => {
  console.error(error.message);
  res.status(500).json({ 
    success: false,
    message: defaultMessage || "An unexpected error occurred. Please try again later."
  });
};

// Validate MongoDB ID format
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

// ======================
// Course Management
// ======================

// 1. Get all courses (admin-only) with pagination
export const getAllCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Validate page and limit
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    if (isNaN(pageNumber) || isNaN(limitNumber) || pageNumber < 1 || limitNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters."
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [courses, totalCourses] = await Promise.all([
      Course.find({})
        .select("-syllabus.lessons.content")
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Course.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        totalCourses,
        totalPages: Math.ceil(totalCourses / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber
      }
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch courses. Please try again later.");
  }
};

// 2. Get a course by ID
export const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format."
      });
    }

    const course = await Course.findById(courseId)
      .select("-syllabus.lessons.content")
      .lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    handleError(res, error, "Failed to fetch course. Please try again later.");
  }
};

// 3. Add a new course
export const addCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { title, description, category, image, oldPrice, newPrice, rating, tags = [], syllabus = [] } = req.body;

    // Check if the course title already exists
    const existingCourse = await Course.findOne({ title });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        message: "Course with this title already exists."
      });
    }

    // Create new course
    const newCourse = new Course({
      title,
      description,
      category,
      image,
      oldPrice,
      newPrice,
      rating,
      tags,
      syllabus
    });

    await newCourse.save();

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: newCourse
    });
  } catch (error) {
    handleError(res, error, "Failed to create course. Please try again later.");
  }
};

// 4. Update an existing course
export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updates = req.body;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format."
      });
    }

    const course = await Course.findByIdAndUpdate(
      courseId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to update course. Please try again later.");
  }
};

// 5. Delete a course
export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format."
      });
    }

    const course = await Course.findByIdAndDelete(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    res.status(200).json({
      success: true,
      message: "Course deleted successfully"
    });
  } catch (error) {
    handleError(res, error, "Failed to delete course. Please try again later.");
  }
};

// ======================
// Dashboard Overview
// ======================

// 6. Get total count of courses (for dashboard)
export const getTotalCourseCount = async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments();
    res.status(200).json({ 
      success: true,
      data: { totalCourses } 
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch total course count. Please try again later.");
  }
};

// ======================
// Section Management
// ======================

// 7. Add a new section to an existing course
export const addSectionToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, lessons = [] } = req.body;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format."
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Section title is required."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    course.syllabus.push({ title, lessons });
    await course.save();

    res.status(200).json({
      success: true,
      message: "Section added successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to add section. Please try again later.");
  }
};

// 8. Get a specific section of a course
export const getSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course or section ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    res.status(200).json({ 
      success: true,
      data: section 
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch section. Please try again later.");
  }
};

// 9. Update a specific section within a course
export const updateSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const { title } = req.body;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course or section ID format."
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Section title is required."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    section.title = title;
    await course.save();

    res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to update section. Please try again later.");
  }
};

// 10. Delete a specific section of a course
export const deleteSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course or section ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    course.syllabus.pull(sectionId);
    await course.save();

    res.status(200).json({
      success: true,
      message: "Section deleted successfully"
    });
  } catch (error) {
    handleError(res, error, "Failed to delete section. Please try again later.");
  }
};

// ======================
// Lesson Management
// ======================

// 11. Add a new lesson to an existing section within a course
export const addLessonToSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const { title, content, isLocked = false, type = "lesson", quiz = [] } = req.body;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course or section ID format."
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Lesson title and content are required."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    section.lessons.push({ title, content, isLocked, type, quiz });
    await course.save();

    res.status(200).json({
      success: true,
      message: "Lesson added successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to add lesson. Please try again later.");
  }
};

// 12. Get a specific lesson of a section
export const getLesson = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId) || !isValidObjectId(lessonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course, section, or lesson ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found."
      });
    }

    res.status(200).json({ 
      success: true,
      data: lesson 
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch lesson. Please try again later.");
  }
};

// 13. Update a specific lesson within a section
export const updateLesson = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const { title, content, isLocked, type, quiz } = req.body;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId) || !isValidObjectId(lessonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course, section, or lesson ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found."
      });
    }

    lesson.title = title || lesson.title;
    lesson.content = content || lesson.content;
    lesson.isLocked = isLocked !== undefined ? isLocked : lesson.isLocked;
    lesson.type = type || lesson.type;
    lesson.quiz = quiz || lesson.quiz;

    await course.save();

    res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to update lesson. Please try again later.");
  }
};

// 14. Delete a specific lesson of a section
export const deleteLesson = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId) || !isValidObjectId(lessonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course, section, or lesson ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found."
      });
    }

    section.lessons.pull(lessonId);
    await course.save();

    res.status(200).json({
      success: true,
      message: "Lesson deleted successfully"
    });
  } catch (error) {
    handleError(res, error, "Failed to delete lesson. Please try again later.");
  }
};

// ======================
// Quiz Management
// ======================

// 15. Get a specific quiz
export const getQuiz = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId) || !isValidObjectId(lessonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course, section, or lesson ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found."
      });
    }

    if (!lesson.quiz || lesson.quiz.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found for this lesson."
      });
    }

    res.status(200).json({ 
      success: true,
      data: lesson.quiz 
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch quiz. Please try again later.");
  }
};

// 16. Add quiz questions to a section (as a lesson)
export const addQuizToSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const { quiz } = req.body;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course or section ID format."
      });
    }

    if (!quiz || !Array.isArray(quiz)) {
      return res.status(400).json({
        success: false,
        message: "Quiz questions are required and must be an array."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    section.lessons.push({
      title: "Section Assessment",
      content: "This is the assessment for the section.",
      isLocked: false,
      type: "assessment",
      quiz: quiz,
    });

    await course.save();

    res.status(200).json({
      success: true,
      message: "Quiz added successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to add quiz. Please try again later.");
  }
};

// 17. Update a specific quiz question (within a lesson)
export const updateQuizQuestion = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId, quizId } = req.params;
    const { question, options, correctAnswer } = req.body;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId) || !isValidObjectId(lessonId) || !isValidObjectId(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course, section, lesson, or quiz ID format."
      });
    }

    if (!question || !options || !correctAnswer) {
      return res.status(400).json({
        success: false,
        message: "Question, options, and correctAnswer are required."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found."
      });
    }

    const quizQuestion = lesson.quiz.id(quizId);
    if (!quizQuestion) {
      return res.status(404).json({
        success: false,
        message: "Quiz question not found."
      });
    }

    quizQuestion.question = question || quizQuestion.question;
    quizQuestion.options = options || quizQuestion.options;
    quizQuestion.correctAnswer = correctAnswer || quizQuestion.correctAnswer;

    await course.save();

    res.status(200).json({
      success: true,
      message: "Quiz question updated successfully",
      data: course
    });
  } catch (error) {
    handleError(res, error, "Failed to update quiz question. Please try again later.");
  }
};

// 18. Delete a specific quiz question (within a lesson)
export const deleteQuizQuestion = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId, quizId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId) || !isValidObjectId(lessonId) || !isValidObjectId(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course, section, lesson, or quiz ID format."
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found."
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found."
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found."
      });
    }

    const quizQuestion = lesson.quiz.id(quizId);
    if (!quizQuestion) {
      return res.status(404).json({
        success: false,
        message: "Quiz question not found."
      });
    }

    lesson.quiz.pull(quizId);
    await course.save();

    res.status(200).json({
      success: true,
      message: "Quiz question deleted successfully"
    });
  } catch (error) {
    handleError(res, error, "Failed to delete quiz question. Please try again later.");
  }
};