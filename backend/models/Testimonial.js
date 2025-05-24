import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// Testimonial Schema for storing user testimonials
const testimonialSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
      enum: {
        values: ['twitter', 'linkedin', 'facebook', 'instagram',  'email','github', 'other'],
        message: '{VALUE} is not a supported platform',
      },
    },
    userRole: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, 'Testimonial must be at least 10 characters'],
      maxlength: [500, 'Testimonial cannot exceed 500 characters'],
    },
    userImage: {
      type: String,
      trim: true,
      default: null, // Optional field for Cloudinary URL
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/undefined
          return /^https:\/\/res\.cloudinary\.com\/.*\/image\/upload\/.*/.test(v);
        },
        message: 'Invalid Cloudinary URL',
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimized queries
testimonialSchema.index({ userName: 1 });
testimonialSchema.index({ courseName: 1 });
testimonialSchema.index({ userRole: 1 });
testimonialSchema.index({ createdAt: 1 });

// Post-save hook for logging
testimonialSchema.post('save', function (doc) {
  logger.info(`Testimonial saved: ${doc._id}, user: ${doc.userName}, role: ${doc.userRole}, course: ${doc.courseName}`);
});

// Static method to find testimonials by userName
testimonialSchema.statics.findByUser = async function (userName) {
  try {
    return await this.find({ userName }).select('userName courseName platform userRole content userImage createdAt');
  } catch (error) {
    logger.error(`Error finding testimonials for user ${userName}: ${error.message}`);
    throw new Error(`Failed to find testimonials: ${error.message}`);
  }
};

// Static method to find testimonials by courseName
testimonialSchema.statics.findByCourse = async function (courseName) {
  try {
    return await this.find({ courseName }).select('userName courseName platform userRole content userImage createdAt');
  } catch (error) {
    logger.error(`Error finding testimonials for course ${courseName}: ${error.message}`);
    throw new Error(`Failed to find testimonials: ${error.message}`);
  }
};

// Static method to find testimonials by userRole
testimonialSchema.statics.findByRole = async function (userRole) {
  try {
    return await this.find({ userRole }).select('userName courseName platform userRole content userImage createdAt');
  } catch (error) {
    logger.error(`Error finding testimonials for role ${userRole}: ${error.message}`);
    throw new Error(`Failed to find testimonials: ${error.message}`);
  }
};

// Create and export Testimonial model
const Testimonial = mongoose.model('Testimonial', testimonialSchema);
export default Testimonial;