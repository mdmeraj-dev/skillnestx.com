import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const SectionForm = ({ section, onSave, onCancel }) => {
  // State for form fields
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  // Pre-fill form when editing a section
  useEffect(() => {
    if (section) {
      setTitle(section.title || "");
    } else {
      resetForm();
    }
  }, [section]);

  // Reset form fields
  const resetForm = () => {
    setTitle("");
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!title) {
      setError("Section title is required.");
      return;
    }

    // Prepare section data
    const sectionData = {
      title,
    };

    // Call the onSave function passed from CourseManagement.jsx
    onSave(sectionData);
    setError("");
  };

  return (
    <div className="section-form">
      <h2>{section ? "Edit Section" : "Add New Section"}</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="form-group">
          <label>Section Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter section title"
            required
          />
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button type="submit" className="btn-save">
            {section ? "Update Section" : "Add Section"}
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
SectionForm.propTypes = {
  section: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

SectionForm.defaultProps = {
  section: null, // Default value for section
};

export default SectionForm;