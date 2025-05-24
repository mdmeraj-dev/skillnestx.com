import { useState, useEffect } from "react";

const TestimonialForm = ({ testimonial, onSave }) => {
  const [formData, setFormData] = useState({
    userName: "",
    courseName: "",
    platform: "",
    userRole: "",
    content: "",
    userImage: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (testimonial) {
      setFormData({
        userName: testimonial.userName || "",
        courseName: testimonial.courseName || "",
        platform: testimonial.platform || "",
        userRole: testimonial.userRole || "",
        content: testimonial.content || "",
        userImage: testimonial.userImage || "",
      });
    }
  }, [testimonial]);

  const validateField = (name, value) => {
    switch (name) {
      case "userName":
        if (!value.trim()) return "Name is required.";
        if (value.trim().length < 2) return "Name must be at least 2 characters.";
        return "";
      case "courseName":
        if (!value.trim()) return "Course name is required.";
        if (value.trim().length < 3) return "Course name must be at least 3 characters.";
        return "";
      case "platform":
        if (!value) return "Platform is required.";
        const validPlatforms = ["linkedin", "twitter", "facebook", "instagram", "github", "other"];
        if (!validPlatforms.includes(value)) return "Invalid platform selected.";
        return "";
      case "userRole":
        if (!value.trim()) return "User role is required.";
        if (value.trim().length < 2) return "User role must be at least 2 characters.";
        return "";
      case "content":
        if (!value.trim()) return "Testimonial content is required.";
        if (value.trim().length < 10) return "Testimonial must be at least 10 characters.";
        return "";
      case "userImage":
        if (!value.trim()) return "User image URL is required.";
        if (!value.match(/^https?:\/\/(res\.cloudinary\.com|cloudinary\.com)\/.*\.(jpg|jpeg|png|gif)$/i)) {
          return "Please enter a valid Cloudinary image URL.";
        }
        return "";
      default:
        return "";
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors = {
      userName: validateField("userName", formData.userName),
      courseName: validateField("courseName", formData.courseName),
      platform: validateField("platform", formData.platform),
      userRole: validateField("userRole", formData.userRole),
      content: validateField("content", formData.content),
      userImage: validateField("userImage", formData.userImage),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSave(formData);
      setFormData({ userName: "", courseName: "", platform: "", userRole: "", content: "", userImage: "" });
      setErrors({});
    } catch (err) {
      setErrors({ general: "Failed to save testimonial. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-testimonial-form-container">
      <form className="admin-testimonial-form" onSubmit={handleSubmit}>
        <h2 className="admin-testimonial-form-title">
          {testimonial ? "Edit Testimonial" : "Add Testimonial"}
        </h2>

        {errors.general && <p className="admin-testimonial-form-error">{errors.general}</p>}

        <div className="admin-testimonial-form-group">
          <label htmlFor="userName" className="admin-testimonial-form-label">
            User Name
          </label>
          <input
            type="text"
            id="userName"
            name="userName"
            value={formData.userName}
            onChange={handleChange}
            className="admin-testimonial-form-input"
            placeholder="Enter author's name"
            aria-describedby={errors.userName ? "userName-error" : undefined}
            disabled={isSubmitting}
          />
          {errors.userName && (
            <p id="userName-error" className="admin-testimonial-form-error">
              {errors.userName}
            </p>
          )}
        </div>

        <div className="admin-testimonial-form-group">
          <label htmlFor="userRole" className="admin-testimonial-form-label">
            User Role
          </label>
          <input
            type="text"
            id="userRole"
            name="userRole"
            value={formData.userRole}
            onChange={handleChange}
            className="admin-testimonial-form-input"
            placeholder="Enter user role (e.g., Software Developer)"
            aria-describedby={errors.userRole ? "userRole-error" : undefined}
            disabled={isSubmitting}
          />
          {errors.userRole && (
            <p id="userRole-error" className="admin-testimonial-form-error">
              {errors.userRole}
            </p>
          )}
        </div>

        <div className="admin-testimonial-form-group">
          <label htmlFor="userImage" className="admin-testimonial-form-label">
            User Image
          </label>
          <input
            type="text"
            id="userImage"
            name="userImage"
            value={formData.userImage}
            onChange={handleChange}
            className="admin-testimonial-form-input"
            placeholder="Enter Cloudinary image URL"
            aria-describedby={errors.userImage ? "userImage-error" : undefined}
            disabled={isSubmitting}
          />
          {errors.userImage && (
            <p id="userImage-error" className="admin-testimonial-form-error">
              {errors.userImage}
            </p>
          )}
        </div>

        <div className="admin-testimonial-form-group">
          <label htmlFor="courseName" className="admin-testimonial-form-label">
            Course Name
          </label>
          <input
            type="text"
            id="courseName"
            name="courseName"
            value={formData.courseName}
            onChange={handleChange}
            className="admin-testimonial-form-input"
            placeholder="Enter course name"
            aria-describedby={errors.courseName ? "courseName-error" : undefined}
            disabled={isSubmitting}
          />
          {errors.courseName && (
            <p id="courseName-error" className="admin-testimonial-form-error">
              {errors.courseName}
            </p>
          )}
        </div>

        <div className="admin-testimonial-form-group">
          <label htmlFor="platform" className="admin-testimonial-form-label">
            Platform
          </label>
          <select
            id="platform"
            name="platform"
            value={formData.platform}
            onChange={handleChange}
            className="admin-testimonial-form-select"
            aria-describedby={errors.platform ? "platform-error" : undefined}
            disabled={isSubmitting}
          >
            <option value="">Select platform</option>
            <option value="linkedin">LinkedIn</option>
            <option value="twitter">Twitter</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="github">GitHub</option>
            <option value="other">Other</option>
          </select>
          {errors.platform && (
            <p id="platform-error" className="admin-testimonial-form-error">
              {errors.platform}
            </p>
          )}
        </div>

        <div className="admin-testimonial-form-group">
          <label htmlFor="content" className="admin-testimonial-form-label">
            Testimonial
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            className="admin-testimonial-form-textarea"
            placeholder="Enter testimonial content"
            rows={5}
            aria-describedby={errors.content ? "content-error" : undefined}
            disabled={isSubmitting}
          />
          {errors.content && (
            <p id="content-error" className="admin-testimonial-form-error">
              {errors.content}
            </p>
          )}
        </div>

        <div className="admin-testimonial-form-actions">
          <button
            type="submit"
            className="admin-testimonial-form-button save"
            disabled={isSubmitting}
            aria-label="Save testimonial"
          >
            {isSubmitting ? (
              <span>
                <span className="admin-testimonial-spinner"></span>
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestimonialForm;