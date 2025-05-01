import UserProgress from "../models/UserProgress.js";

const CourseProgressController = {
  // Update or create user progress for a lesson or assessment
  async updateProgress(req, res) {
    try {
      const { userId, courseId, lessonId, isCompleted, quizScore } = req.body;

      // Validate required fields
      if (
        !userId ||
        !courseId ||
        !lessonId ||
        typeof isCompleted !== "boolean"
      ) {
        return res
          .status(400)
          .json({ message: "Missing or invalid required fields" });
      }

      // Find or create progress entry
      let progress = await UserProgress.findOne({ userId, courseId, lessonId });

      if (!progress) {
        progress = new UserProgress({
          userId,
          courseId,
          lessonId,
          isCompleted,
          quizScore,
        });
      } else {
        progress.isCompleted = isCompleted;
        if (quizScore !== undefined) {
          progress.quizScore = quizScore; // Update quiz score if provided
        }
      }

      await progress.save();

      res
        .status(200)
        .json({ message: "Progress updated successfully", progress });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating progress", error: error.message });
    }
  },

  // Get all progress entries for a user in a specific course
  async getProgress(req, res) {
    try {
      const { userId, courseId } = req.query;

      // Validate required fields
      if (!userId || !courseId) {
        return res
          .status(400)
          .json({ message: "Missing required fields: userId and courseId" });
      }

      // Fetch progress entries for the user and course
      const progress = await UserProgress.find({ userId, courseId }).populate(
        "lessonId"
      );

      if (!progress || progress.length === 0) {
        return res
          .status(404)
          .json({
            message: "No progress found for the specified user and course",
          });
      }

      res.status(200).json({ progress });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching progress", error: error.message });
    }
  },

  // Mark a lesson as completed
  async markAsCompleted(req, res) {
    try {
      const { userId, courseId, lessonId } = req.body;

      // Validate required fields
      if (!userId || !courseId || !lessonId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find the progress entry
      const progress = await UserProgress.findOne({
        userId,
        courseId,
        lessonId,
      });

      if (!progress) {
        return res.status(404).json({ message: "Progress entry not found" });
      }

      // Mark as completed and save
      await progress.markAsCompleted();

      res.status(200).json({ message: "Lesson marked as completed", progress });
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error marking lesson as completed",
          error: error.message,
        });
    }
  },

  // Update quiz score for an assessment
  async updateQuizScore(req, res) {
    try {
      const { userId, courseId, lessonId, quizScore } = req.body;

      // Validate required fields
      if (!userId || !courseId || !lessonId || typeof quizScore !== "number") {
        return res
          .status(400)
          .json({ message: "Missing or invalid required fields" });
      }

      // Find the progress entry
      const progress = await UserProgress.findOne({
        userId,
        courseId,
        lessonId,
      });

      if (!progress) {
        return res.status(404).json({ message: "Progress entry not found" });
      }

      // Update quiz score and save
      await progress.updateQuizScore(quizScore);

      res
        .status(200)
        .json({ message: "Quiz score updated successfully", progress });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating quiz score", error: error.message });
    }
  },

  // Delete a progress entry
  async deleteProgress(req, res) {
    try {
      const { userId, courseId, lessonId } = req.body;

      // Validate required fields
      if (!userId || !courseId || !lessonId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find and delete the progress entry
      const deletedProgress = await UserProgress.findOneAndDelete({
        userId,
        courseId,
        lessonId,
      });

      if (!deletedProgress) {
        return res.status(404).json({ message: "Progress entry not found" });
      }

      res
        .status(200)
        .json({
          message: "Progress entry deleted successfully",
          deletedProgress,
        });
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error deleting progress entry",
          error: error.message,
        });
    }
  },
};

export default CourseProgressController;
