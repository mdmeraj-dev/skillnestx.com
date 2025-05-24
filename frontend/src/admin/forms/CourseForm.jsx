import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";

const CourseForm = ({ course = null, onSave }) => {
  // State for form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [rating, setRating] = useState("");
  const [ratingCount, setRatingCount] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available categories (aligned with backend ALLOWED_CATEGORIES)
  const categories = [
    "Frontend",
    "Backend",
    "Machine Learning",
    "Artificial Intelligence",
    "System Design",
    "Database",
  ];

  // Pre-fill form when editing a course
  useEffect(() => {
    if (course?._id) {
      setTitle(course.title || "");
      setDescription(course.description || "");
      setCategory(course.category || "");
      setImageUrl(course.imageUrl || "");
      setOldPrice(
        course.oldPrice ? Math.floor(course.oldPrice).toString() : ""
      );
      setNewPrice(
        course.newPrice ? Math.floor(course.newPrice).toString() : ""
      );
      setRating(course.rating ? course.rating.toString() : "");
      setRatingCount(course.ratingCount ? course.ratingCount.toString() : "");
      setTags(course.tags ? course.tags.join(", ") : "");
    } else {
      resetForm();
    }
  }, [course]);

  // Reset form fields
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setImageUrl("");
    setOldPrice("");
    setNewPrice("");
    setRating("");
    setRatingCount("");
    setTags("");
    setError("");
    setIsSubmitting(false);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Validate fields
    if (!title.trim()) {
      setError("Title is required.");
      setIsSubmitting(false);
      return;
    }
    if (title.length > 200) {
      setError("Title must not exceed 200 characters.");
      setIsSubmitting(false);
      return;
    }
    if (!description.trim() && !course?._id) {
      setError("Description is required.");
      setIsSubmitting(false);
      return;
    }
    if (description.length < 10 && description.trim()) {
      setError("Description must be at least 10 characters.");
      setIsSubmitting(false);
      return;
    }
    if (description.length > 2000) {
      setError("Description must not exceed 2000 characters.");
      setIsSubmitting(false);
      return;
    }
    if (!category && !course?._id) {
      setError("Category is required.");
      setIsSubmitting(false);
      return;
    }
    if (category && !categories.includes(category)) {
      setError("Invalid category. Please select from the provided options.");
      setIsSubmitting(false);
      return;
    }
    if (!imageUrl.trim() && !course?._id) {
      setError("Image URL is required.");
      setIsSubmitting(false);
      return;
    }
    if (imageUrl && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(imageUrl)) {
      setError(
        "Please enter a valid URL for the image (e.g., https://example.com/image.jpg)."
      );
      setIsSubmitting(false);
      return;
    }
    if (!oldPrice && !course?._id) {
      setError("Old price is required.");
      setIsSubmitting(false);
      return;
    }
    const parsedOldPrice = parseInt(oldPrice, 10);
    if (
      oldPrice &&
      (isNaN(parsedOldPrice) ||
        parsedOldPrice < 0 ||
        !Number.isInteger(parsedOldPrice))
    ) {
      setError("Old price must be a non-negative integer.");
      setIsSubmitting(false);
      return;
    }
    if (!newPrice && !course?._id) {
      setError("New price is required.");
      setIsSubmitting(false);
      return;
    }
    const parsedNewPrice = parseInt(newPrice, 10);
    if (
      newPrice &&
      (isNaN(parsedNewPrice) ||
        parsedNewPrice < 0 ||
        !Number.isInteger(parsedNewPrice))
    ) {
      setError("New price must be a non-negative integer.");
      setIsSubmitting(false);
      return;
    }
    if (oldPrice && newPrice && parsedNewPrice > parsedOldPrice) {
      setError("New price cannot be greater than old price.");
      setIsSubmitting(false);
      return;
    }
    if (!rating && !course?._id) {
      setError("Rating is required.");
      setIsSubmitting(false);
      return;
    }
    if (
      rating &&
      (isNaN(parseFloat(rating)) ||
        parseFloat(rating) < 0 ||
        parseFloat(rating) > 5)
    ) {
      setError("Rating must be a number between 0 and 5.");
      setIsSubmitting(false);
      return;
    }
    if (!ratingCount && !course?._id) {
      setError("Rating count is required.");
      setIsSubmitting(false);
      return;
    }
    if (
      ratingCount &&
      (isNaN(parseInt(ratingCount)) || parseInt(ratingCount) < 0)
    ) {
      setError("Rating count must be a non-negative integer.");
      setIsSubmitting(false);
      return;
    }
    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag)
      : [];
    if (tagsArray.length > 20) {
      setError("Maximum 20 tags are allowed.");
      setIsSubmitting(false);
      return;
    }
    if (tagsArray.some((tag) => tag.length > 50)) {
      setError("Each tag must not exceed 50 characters.");
      setIsSubmitting(false);
      return;
    }

    // Prepare course data (only include changed fields for updates)
    const courseData = {};
    if (title.trim()) courseData.title = title;
    if (description.trim()) courseData.description = description;
    if (category) courseData.category = category;
    if (imageUrl.trim()) courseData.imageUrl = imageUrl;
    if (oldPrice && !isNaN(parsedOldPrice))
      courseData.oldPrice = parsedOldPrice;
    if (newPrice && !isNaN(parsedNewPrice))
      courseData.newPrice = parsedNewPrice;
    if (rating && !isNaN(parseFloat(rating)))
      courseData.rating = parseFloat(rating);
    if (ratingCount && !isNaN(parseInt(ratingCount)))
      courseData.ratingCount = parseInt(ratingCount);
    courseData.tags = tagsArray;
    if (!course?._id) {
      courseData.ratingCount = courseData.ratingCount || 0; // Default for new courses
      courseData.syllabus = []; // Default empty syllabus
    }

    try {
      await onSave(courseData);
      toast.success(
        course?._id
          ? "Course updated successfully"
          : "Course added successfully"
      );
      setError("");
      if (!course?._id) resetForm();
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save course.";
      const errors =
        err.response?.data?.errors?.map((e) => e.msg).join(", ") || "";
      setError(errors || message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-course-management-form">
      <h2>{course?._id ? "Update Course" : "Add New Course"}</h2>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-title">Title</label>
          <input
            id="course-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter course title"
            maxLength={200}
            disabled={isSubmitting}
            aria-label="Course title"
          />
        </div>

        {/* Description */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-description">Description</label>
          <textarea
            id="course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter course description"
            maxLength={2000}
            disabled={isSubmitting}
            aria-label="Course description"
          />
        </div>

        {/* Category */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-category">Category</label>
          <select
            id="course-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSubmitting}
            aria-label="Course category"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Image URL */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-image-url">Image URL</label>
          <input
            id="course-image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
            maxLength={1000}
            disabled={isSubmitting}
            aria-label="Course image URL"
          />
        </div>

        {/* Old Price */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-old-price">Old Price (₹)</label>
          <input
            id="course-old-price"
            type="number"
            value={oldPrice}
            onChange={(e) => setOldPrice(e.target.value)}
            placeholder="Enter old price"
            min="0"
            step="1"
            disabled={isSubmitting}
            aria-label="Old price"
          />
        </div>

        {/* New Price */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-new-price">New Price (₹)</label>
          <input
            id="course-new-price"
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Enter new price"
            min="0"
            step="1"
            disabled={isSubmitting}
            aria-label="New price"
          />
        </div>

        {/* Rating */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-rating">Rating (0-5)</label>
          <input
            id="course-rating"
            type="number"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="Enter course rating"
            min="0"
            max="5"
            step="0.1"
            disabled={isSubmitting}
            aria-label="Course rating"
          />
        </div>

        {/* Rating Count */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-rating-count">Rating Count</label>
          <input
            id="course-rating-count"
            type="number"
            value={ratingCount}
            onChange={(e) => setRatingCount(e.target.value)}
            placeholder="Enter number of ratings"
            min="0"
            step="1"
            disabled={isSubmitting}
            aria-label="Course rating count"
          />
        </div>

        {/* Tags */}
        <div className="admin-course-management-form-group">
          <label htmlFor="course-tags">Tags (comma-separated)</label>
          <input
            id="course-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Enter tags (e.g., web development, javascript)"
            maxLength={500}
            disabled={isSubmitting}
            aria-label="Course tags"
          />
        </div>

        {error && <p className="admin-course-management-error">{error}</p>}

        {/* Buttons */}
        <div className="admin-course-management-form-actions">
          <button
            type="submit"
            className="admin-course-management-action-button add"
            disabled={isSubmitting}
            aria-label={course?._id ? "Update course" : "Add course"}
          >
            {isSubmitting
              ? course?._id
                ? "Updating..."
                : "Adding..."
              : course?._id
              ? "Update Course"
              : "Add Course"}
          </button>
        </div>
      </form>
    </div>
  );
};

// Prop validation
CourseForm.propTypes = {
  course: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    category: PropTypes.string,
    imageUrl: PropTypes.string,
    oldPrice: PropTypes.number,
    newPrice: PropTypes.number,
    rating: PropTypes.number,
    ratingCount: PropTypes.number,
    tags: PropTypes.arrayOf(PropTypes.string),
    syllabus: PropTypes.array,
  }),
  onSave: PropTypes.func.isRequired,
};

export default CourseForm;