import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const CourseForm = ({ course, onSave, onCancel }) => {
  // State for form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [rating, setRating] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");

  // Pre-fill form when editing a course
  useEffect(() => {
    if (course) {
      setTitle(course.title || "");
      setDescription(course.description || "");
      setCategory(course.category || "");
      setImage(course.image || "");
      setOldPrice(course.oldPrice || "");
      setNewPrice(course.newPrice || "");
      setRating(course.rating || "");
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
    setImage("");
    setOldPrice("");
    setNewPrice("");
    setRating("");
    setTags("");
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (
      !title ||
      !description ||
      !category ||
      !image ||
      !oldPrice ||
      !newPrice ||
      !rating
    ) {
      setError("All fields are required.");
      return;
    }

    // Prepare course data
    const courseData = {
      title,
      description,
      category,
      image,
      oldPrice: parseFloat(oldPrice),
      newPrice: parseFloat(newPrice),
      rating: parseFloat(rating),
      tags: tags.split(",").map((tag) => tag.trim()), // Convert tags string to array
    };

    // Call the onSave function passed from CourseManagement.jsx
    onSave(courseData);
    setError("");
  };

  return (
    <div className="course-form">
      <h2>{course ? "Edit Course" : "Add New Course"}</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter course title"
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter course description"
            required
          />
        </div>

        {/* Category */}
        <div className="form-group">
          <label>Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Enter course category"
            required
          />
        </div>

        {/* Image URL */}
        <div className="form-group">
          <label>Image URL</label>
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Enter image URL"
            required
          />
        </div>

        {/* Old Price */}
        <div className="form-group">
          <label>Old Price</label>
          <input
            type="number"
            value={oldPrice}
            onChange={(e) => setOldPrice(e.target.value)}
            placeholder="Enter old price"
            min="0"
            required
          />
        </div>

        {/* New Price */}
        <div className="form-group">
          <label>New Price</label>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Enter new price"
            min="0"
            required
          />
        </div>

        {/* Rating */}
        <div className="form-group">
          <label>Rating</label>
          <input
            type="number"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="Enter course rating"
            min="0"
            max="5"
            step="0.1"
            required
          />
        </div>

        {/* Tags */}
        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Enter tags (e.g., web development, javascript)"
          />
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button type="submit" className="btn-save">
            {course ? "Update Course" : "Add Course"}
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
CourseForm.propTypes = {
  course: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    category: PropTypes.string,
    image: PropTypes.string,
    oldPrice: PropTypes.number,
    newPrice: PropTypes.number,
    rating: PropTypes.number,
    tags: PropTypes.arrayOf(PropTypes.string),
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

CourseForm.defaultProps = {
  course: null, // Default value for course
};

export default CourseForm;