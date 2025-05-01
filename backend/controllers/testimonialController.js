import Testimonial from "../models/Testimonial.js"; // Import the Testimonial model

// Add a new testimonial
export const addTestimonial = async (req, res) => {
  try {
    const { name, role, testimonial, image, socialMedia } = req.body;

    // Validate required fields
    if (!name || !role || !testimonial || !image || !socialMedia) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create a new testimonial
    const newTestimonial = new Testimonial({
      name,
      role,
      testimonial,
      image,
      socialMedia,
    });

    // Save the testimonial to the database
    await newTestimonial.save();

    // Send success response
    res.status(201).json({
      message: "Testimonial added successfully",
      testimonial: newTestimonial,
    });
  } catch (error) {
    console.error("Error adding testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a testimonial by ID
export const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the testimonial
    const deletedTestimonial = await Testimonial.findByIdAndDelete(id);

    // Check if the testimonial exists
    if (!deletedTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    // Send success response
    res.status(200).json({
      message: "Testimonial deleted successfully",
      testimonial: deletedTestimonial,
    });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Fetch all testimonials
export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find();
   
    res.status(200).json(testimonials); // Send the testimonials as a JSON response
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a testimonial by ID (supports partial updates)
export const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, testimonial, image, socialMedia } = req.body;

    // Check if at least one field is provided for update
    if (!name && !role && !testimonial && !image && !socialMedia) {
      return res.status(400).json({ message: "At least one field is required for update" });
    }

    // Create an update object with only the provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (testimonial) updateData.testimonial = testimonial;
    if (image) updateData.image = image;
    if (socialMedia) updateData.socialMedia = socialMedia;

    // Find and update the testimonial
    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      id,
      updateData,
      { new: true } // Return the updated document
    );

    // Check if the testimonial exists
    if (!updatedTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    // Send success response
    res.status(200).json({
      message: "Testimonial updated successfully",
      testimonial: updatedTestimonial,
    });
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};