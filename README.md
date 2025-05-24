# SkillNestX - E-Learning Platform for Computer Science Courses

![SkillNestX Logo](https://via.placeholder.com/150?text=SkillNestX+Logo) <!-- Replace with actual logo URL -->

SkillNestX is a professional e-learning platform offering high-quality, text-based computer science courses. Built with Vite, React, Node.js, Express, MongoDB, and Razorpay for secure payments, it provides a seamless learning experience with course progress tracking, customizable user profiles, and professional course completion certificates.

## Features

- **Course Management**:
  - Browse and filter courses by category.
  - Search courses using a powerful search bar.
  - Save or unsave courses for future reference.
  - Track in-progress courses with real-time updates.

- **User Profile Management**:
  - Create and update profiles with customizable avatars.
  - View purchased courses and download professional certificates.
  - Securely delete accounts with confirmation.

- **Flexible Purchase Options**:
  - Purchase individual courses or multiple courses via cart.
  - Choose from various subscription plans.
  - Secure payments powered by Razorpay.

- **Refunds and Support**:
  - Request refunds within a 3-day policy via email.
  - Dedicated support: [support@skillnestx.com](mailto:support@skillnestx.com), [feedback@skillnestx.com](mailto:feedback@skillnestx.com), [careers@skillnestx.com](mailto:careers@skillnestx.com).

- **Email Notifications**:
  - Automated emails for signup, welcome, account updates, deletion, purchases, and refunds.

- **Professional UI/UX**:
  - Stunning homepage with carousel and testimonials.
  - Responsive design for all devices.

## Technologies Used

- **Frontend**:
  - Vite + React: For building the user interface (JavaScript, ES6).
  - Vanilla CSS: For styling and responsive design.
  - React Router: For navigation.
  - Lazy loading: For optimized performance.

- **Backend**:
  - Node.js + Express: For server-side logic.
  - MongoDB + Mongoose: For data management.
  - Firebase: For authentication (email/password, Google sign-in).
  - Razorpay: For secure payment processing.

- **Other Tools**:
  - Nodemailer: For email notifications.
  - LocalStorage: For client-side data persistence.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/MdMeraj/SkillNestX.git
   cd SkillNestX


Install dependencies:

For the frontend:
cd frontend
npm install


For the backend:
cd backend
npm install




Set up environment variables:

Create a .env file in the backend directory using backend/.env.example.
Add MongoDB URI, Firebase credentials, Razorpay keys, and email service configuration.


Run the application:

Start the backend server:
cd backend
npm run dev


Start the frontend development server:
cd frontend
npm run dev




Access the application:

Open your browser and navigate to http://localhost:5173 (or the port specified by Vite).



Configuration
Set the following environment variables in backend/.env:
# MongoDB
MONGO_URI=mongodb://localhost:27017/skillnestx

# Firebase (for authentication)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id

# Razorpay (for payments)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email Service (Nodemailer)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password

# JWT Secret
JWT_SECRET=your_jwt_secret

Replace placeholders with your actual credentials. Ensure MongoDB is running locally or use a cloud-hosted instance.
Usage

User Registration and Authentication:

Sign up using email/password or Google authentication.
Verify your email via the confirmation link.
Log in to access your personalized dashboard.


Browsing and Purchasing Courses:

Explore courses via the homepage carousel or category filters.
Add courses to the cart or purchase directly via Razorpay.
Subscribe to plans for extended access.


Managing Profile and Progress:

Update profile details and upload avatars.
Track in-progress courses and view completed lessons.
Download professional course completion certificates.


Refunds and Support:

Request refunds within 3 days via support@skillnestx.com.
Provide feedback or inquire about careers via dedicated emails.



Project Structure
SkillNestX is a large-scale project with over 150 files, including a robust frontend (100+ files) and a modular backend (50+ files). Below is a simplified yet complete overview of the key directories and representative files:
skillnestx/
├── backend/
│   ├── config/
│   │   ├── connectDB.js        # MongoDB connection setup
│   │   └── passport.js         # Passport.js for authentication
│   ├── controllers/
│   │   ├── authController.js   # Authentication logic
│   │   ├── certificateController.js # Certificate generation
│   │   ├── courseController.js # Course management
│   │   ├── courseListController.js # Course listing
│   │   ├── dashboardController.js # Dashboard data
│   │   ├── paymentController.js # Payment processing
│   │   ├── purchasedCourseController.js # Purchased courses
│   │   ├── savedCoursesController.js # Saved courses
│   │   ├── subscriptionController.js # Subscriptions
│   │   ├── testimonialController.js # Testimonials
│   │   ├── transactionController.js # Transactions
│   │   ├── userController.js    # User profiles
│   │   └── userProgressController.js # Course progress
│   ├── emailTemplates/
│   │   ├── account-deletion.html # Account deletion email
│   │   ├── course-purchase-confirmation.html # Purchase confirmation
│   │   ├── signup-email.html    # Signup confirmation
│   │   ├── welcome-email.html   # Welcome email
│   │   └── [other templates]    # Additional email templates
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT authentication
│   │   ├── errorMiddleware.js   # Error handling
│   │   ├── validateIds.js       # ID validation
│   │   ├── validateMiddleware.js # Request validation
│   │   └── validateRequest.js   # Request validation
│   ├── models/
│   │   ├── Certificate.js       # Certificate schema
│   │   ├── Course.js            # Course schema
│   │   ├── Payment.js           # Payment schema
│   │   ├── SavedCourse.js       # Saved courses schema
│   │   ├── Subscription.js      # Subscription schema
│   │   ├── TempUser.js          # Temporary user schema
│   │   ├── Testimonial.js       # Testimonial schema
│   │   ├── Transaction.js       # Transaction schema
│   │   ├── User.js              # User schema
│   │   └── UserProgress.js      # Progress schema
│   ├── public/
│   │   └── certificate-template.jpg # Certificate template
│   ├── routes/
│   │   ├── authRoutes.js        # Authentication routes
│   │   ├── certificateRoutes.js # Certificate routes
│   │   ├── courseListRoutes.js  # Course listing routes
│   │   ├── courseRoutes.js      # Course routes
│   │   ├── dashboardRoutes.js   # Dashboard routes
│   │   ├── paymentRoutes.js     # Payment routes
│   │   ├── purchasedCourseRoutes.js # Purchased course routes
│   │   ├── savedCoursesRoutes.js # Saved course routes
│   │   ├── subscriptionRoutes.js # Subscription routes
│   │   ├── testimonialRoutes.js # Testimonial routes
│   │   ├── transactionRoutes.js # Transaction routes
│   │   ├── userProgressRoutes.js # Progress routes
│   │   └── userRoutes.js        # User routes
│   ├── seed/
│   │   └── seedCourses.js       # Course seeding script
│   ├── utils/
│   │   ├── cronJobs.js          # Scheduled tasks
│   │   ├── dateUtils.js         # Date utilities
│   │   ├── generateToken.js     # JWT token generation
│   │   ├── loadEmailTemplate.js # Email template loader
│   │   ├── logger.js            # Logging utility
│   │   ├── razorpay.js          # Razorpay configuration
│   │   ├── sendEmail.js         # Email sending
│   │   └── sendResetLink.js     # Password reset link
│   ├── config.js                # Backend configuration
│   ├── server.js                # Main server file
│   ├── .env.development         # Development environment
│   ├── .env.production          # Production environment
│   ├── .gitignore               # Git ignore file
│   ├── package.json             # Backend dependencies
│   └── package-lock.json        # Dependency lock file
├── frontend/
│   ├── public/
│   │   └── assets/
│   │       ├── avatars/         # User avatar images
│   │       ├── favicon/         # Favicon assets
│   │       ├── icons/           # UI icons
│   │       ├── logos/           # Company and payment logos
│   │       └── certificate-templte.jpg # Certificate template
│   ├── src/
│   │   ├── admin/
│   │   │   ├── components/
│   │   │   │   ├── AdminFooter.jsx   # Admin footer
│   │   │   │   ├── AdminMainContent.jsx # Admin content
│   │   │   │   ├── AdminNavbar.jsx   # Admin navbar
│   │   │   │   ├── AdminSidebar.jsx  # Admin sidebar
│   │   │   │   └── AdminProfile/
│   │   │   │       ├── AdminProfile.jsx # Admin profile
│   │   │   │       ├── components/
│   │   │   │       │   ├── AdminAccountSettings.jsx # Account settings
│   │   │   │       │   ├── AdminDeleteAccount.jsx # Account deletion
│   │   │   │       │   └── AdminLogout.jsx # Logout
│   │   │   │       └── styles/
│   │   │   │           ├── AdminAccountSettings.css
│   │   │   │           ├── AdminDeleteAccount.css
│   │   │   │           ├── AdminLogout.css
│   │   │   │           └── AdminProfile.css
│   │   │   ├── forms/
│   │   │   │   ├── CourseForm.jsx    # Course management form
│   │   │   │   ├── RefundForm.jsx    # Refund request form
│   │   │   │   └── TestimonialForm.jsx # Testimonial form
│   │   │   ├── pages/
│   │   │   │   ├── CourseManagement.jsx # Course management
│   │   │   │   ├── Dashboard.jsx     # Admin dashboard
│   │   │   │   ├── LoadingSpinner.jsx # Loading spinner
│   │   │   │   ├── SubscriptionManagement.jsx # Subscription management
│   │   │   │   ├── TestimonialManagement.jsx # Testimonial management
│   │   │   │   ├── TransactionManagement.jsx # Transaction management
│   │   │   │   └── UserManagement.jsx # User management
│   │   │   └── styles/
│   │   │       ├── AdminDashboard.css
│   │   │       ├── AdminFooter.css
│   │   │       ├── AdminMainContent.css
│   │   │       ├── AdminNavbar.css
│   │   │       ├── AdminSidebar.css
│   │   │       ├── CourseManagement.css
│   │   │       ├── Dashboard.css
│   │   │       ├── RefundForm.css
│   │   │       ├── SubscriptionManagement.css
│   │   │       ├── TestimonialManagement.css
│   │   │       ├── TransactionManagement.css
│   │   │       └── UserManagement.css
│   │   ├── components/
│   │   │   ├── Carousel.jsx          # Homepage carousel
│   │   │   ├── CertificateDownload.jsx # Certificate download
│   │   │   ├── CourseCard.jsx        # Course card
│   │   │   ├── CourseContent.jsx     # Course content
│   │   │   ├── CourseList.jsx        # Course listing
│   │   │   ├── CourseProgress.jsx    # Progress tracking
│   │   │   ├── ErrorBoundary.jsx     # Error handling
│   │   │   ├── FAQSection.jsx        # FAQ section
│   │   │   ├── Footer.jsx            # Footer
│   │   │   ├── HeroSection.jsx       # Hero section
│   │   │   ├── InProgressCourseCard.jsx # In-progress course card
│   │   │   ├── InProgressCourses.jsx # In-progress courses
│   │   │   ├── LazyImage.jsx         # Lazy-loaded image
│   │   │   ├── LazySwiperSlide.jsx   # Lazy-loaded swiper
│   │   │   ├── LoadingSpinner.jsx    # Loading spinner
│   │   │   ├── Navbar.jsx            # Navigation bar
│   │   │   ├── SavedCourseCard.jsx   # Saved course card
│   │   │   ├── SavedCourses.jsx      # Saved courses
│   │   │   ├── ScrollToTop.jsx       # Scroll-to-top
│   │   │   ├── Testimonial.jsx       # Testimonial
│   │   │   ├── TimerComponent.jsx    # Timer
│   │   │   └── profile/
│   │   │       ├── AccountSettings.jsx # Account settings
│   │   │       ├── Certificates.jsx   # Certificates
│   │   │       ├── DeleteAccount.jsx  # Account deletion
│   │   │       ├── Logout.jsx         # Logout
│   │   │       ├── PurchasedCourses.jsx # Purchased courses
│   │   │       ├── Subscriptions.jsx  # Subscriptions
│   │   │       ├── UserProfile.jsx    # User profile
│   │   │       └── styles/
│   │   │           ├── AccountSettings.css
│   │   │           ├── Certificate.css
│   │   │           ├── DeleteAccount.css
│   │   │           ├── Logout.css
│   │   │           ├── PurchasedCourses.css
│   │   │           ├── Subscription.css
│   │   │           └── UserProfile.css
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx       # Authentication context
│   │   │   └── CartContext.jsx       # Cart context
│   │   ├── hooks/
│   │   │   ├── useAuth.js            # Authentication hook
│   │   │   └── useCart.js            # Cart hook
│   │   ├── utils/
│   │   │   ├── auth.js               # Authentication utilities
│   │   │   └── checkCourseAccess.js  # Course access checker
│   │   ├── App.css                   # App styles
│   │   ├── App.jsx                   # Main app component
│   │   ├── index.css                 # Global styles
│   │   ├── lang-detector.d.ts        # TypeScript declaration
│   │   ├── main.jsx                  # Vite entry point
│   │   └── pages/
│   │       ├── AboutUs.jsx           # About us
│   │       ├── Careers.jsx           # Careers
│   │       ├── CartPage.jsx          # Cart
│   │       ├── ContactUs.jsx         # Contact us
│   │       ├── Dashboard.jsx         # User dashboard
│   │       ├── ForgotPassword.jsx    # Forgot password
│   │       ├── GiftPlan.jsx          # Gift plan
│   │       ├── LessonPage.jsx        # Lesson content
│   │       ├── Login.jsx             # Login
│   │       ├── PaymentPage.jsx       # Payment
│   │       ├── PersonalPlan.jsx      # Personal plan
│   │       ├── PricingPage.jsx       # Pricing
│   │       ├── PrivacyPolicy.jsx     # Privacy policy
│   │       ├── RefundPolicy.jsx      # Refund policy
│   │       ├── ResetPassword.jsx     # Reset password
│   │       ├── SearchResults.jsx     # Search results
│   │       ├── Signup.jsx            # Signup
│   │       ├── Success.jsx           # Success page
│   │       ├── Support.jsx           # Support
│   │       ├── TeamPlan.jsx          # Team plan
│   │       ├── TermsOfService.jsx    # Terms of service
│   │       ├── TrustedPage.jsx       # Trusted page
│   │       └── VerifyEmail.jsx       # Email verification
│   ├── razorpay-test.html            # Razorpay test page
│   ├── vite.config.js                # Vite configuration
│   ├── vercel.json                   # Vercel configuration
│   ├── .env.development              # Development environment
│   ├── .env.production               # Production environment
│   ├── .gitignore                    # Git ignore file
│   ├── eslint.config.js              # ESLint configuration
│   ├── index.html                    # Main HTML
│   ├── package.json                  # Frontend dependencies
│   └── package-lock.json             # Dependency lock file
├── .gitignore                        # Root git ignore
├── package.json                      # Root project metadata
├── README.md                         # Project documentation
└── LICENSE                           # MIT License

Note: The project contains over 150 files, with 100+ in the frontend and 50+ in the backend. Generated files (e.g., node_modules, backend/public/generated-certificates) are excluded from the repository. Some directories (e.g., emailTemplates) contain additional files not listed for brevity. Explore the repository for the full structure.
Contributing
Contributions are welcome! To contribute to SkillNestX:

Clone the repository:
git clone https://github.com/MdMeraj/SkillNestX.git


Create a new branch:
git checkout -b feature/your-feature


Make changes and commit:
git commit -m 'Add your feature'


Push to the branch:
git push origin feature/your-feature


Open a pull request with a detailed description.


Ensure code follows the project's standards and includes tests.
Support
For inquiries, contact our support team:

General Support: support@skillnestx.com
Feedback: feedback@skillnestx.com
Careers: careers@skillnestx.com

License
This project is licensed under the MIT License. See the LICENSE file for details.
Made with ❤️ by Md Meraj


# SkillNestX - E-Learning Platform for Computer Science Courses

![SkillNestX Logo](https://via.placeholder.com/150?text=SkillNestX+Logo) <!-- Replace with actual logo URL -->

SkillNestX is a professional e-learning platform offering high-quality, text-based computer science courses. Built with Vite, React, Node.js, Express, MongoDB, and Razorpay for secure payments, it provides a seamless learning experience with course progress tracking, customizable user profiles, and professional course completion certificates.

## Features

- **Course Management**:
  - Browse and filter courses by category.
  - Search courses using a powerful search bar.
  - Save or unsave courses for future reference.
  - Track in-progress courses with real-time updates.

- **User Profile Management**:
  - Create and update profiles with customizable avatars.
  - View purchased courses and download professional certificates.
  - Securely delete accounts with confirmation.

- **Flexible Purchase Options**:
  - Purchase individual courses or multiple courses via cart.
  - Choose from various subscription plans.
  - Secure payments powered by Razorpay.

- **Refunds and Support**:
  - Request refunds within a 3-day policy via email.
  - Dedicated support: [support@skillnestx.com](mailto:support@skillnestx.com), [feedback@skillnestx.com](mailto:feedback@skillnestx.com), [careers@skillnestx.com](mailto:careers@skillnestx.com).

- **Email Notifications**:
  - Automated emails for signup, welcome, account updates, deletion, purchases, and refunds.

- **Professional UI/UX**:
  - Stunning homepage with carousel and testimonials.
  - Responsive design for all devices.

## Technologies Used

- **Frontend**:
  - Vite + React: For building the user interface (JavaScript, ES6).
  - Vanilla CSS: For styling and responsive design.
  - React Router: For navigation.
  - Lazy loading: For optimized performance.

- **Backend**:
  - Node.js + Express: For server-side logic.
  - MongoDB + Mongoose: For data management.
  - Firebase: For authentication (email/password, Google sign-in).
  - Razorpay: For secure payment processing.

- **Other Tools**:
  - Nodemailer: For email notifications.
  - LocalStorage: For client-side data persistence.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/MdMeraj/SkillNestX.git
   cd SkillNestX


Install dependencies:

For the frontend:
cd frontend
npm install


For the backend:
cd backend
npm install




Set up environment variables:

Create a .env file in the backend directory using backend/.env.example.
Add MongoDB URI, Firebase credentials, Razorpay keys, and email service configuration.


Run the application:

Start the backend server:
cd backend
npm run dev


Start the frontend development server:
cd frontend
npm run dev




Access the application:

Open your browser and navigate to http://localhost:5173 (or the port specified by Vite).



Configuration
Set the following environment variables in backend/.env:
# MongoDB
MONGO_URI=mongodb://localhost:27017/skillnestx

# Firebase (for authentication)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id

# Razorpay (for payments)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email Service (Nodemailer)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password

# JWT Secret
JWT_SECRET=your_jwt_secret

Replace placeholders with your actual credentials. Ensure MongoDB is running locally or use a cloud-hosted instance.
Usage

User Registration and Authentication:

Sign up using email/password or Google authentication.
Verify your email via the confirmation link.
Log in to access your personalized dashboard.


Browsing and Purchasing Courses:

Explore courses via the homepage carousel or category filters.
Add courses to the cart or purchase directly via Razorpay.
Subscribe to plans for extended access.


Managing Profile and Progress:

Update profile details and upload avatars.
Track in-progress courses and view completed lessons.
Download professional course completion certificates.


Refunds and Support:

Request refunds within 3 days via support@skillnestx.com.
Provide feedback or inquire about careers via dedicated emails.



Project Structure
SkillNestX is a large-scale project with over 150 files, including a robust frontend (100+ files) and a modular backend (50+ files). Below is a simplified yet complete overview of the key directories and representative files:
skillnestx/
├── backend/
│   ├── config/
│   │   ├── connectDB.js          # MongoDB connection setup
│   │   └── passport.js           # Passport.js for authentication
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── certificateController.js # Certificate generation
│   │   ├── courseController.js   # Course management
│   │   ├── courseListController.js # Course listing
│   │   ├── dashboardController.js # Dashboard data
│   │   ├── paymentController.js  # Payment processing
│   │   ├── purchasedCourseController.js # Purchased courses
│   │   ├── savedCoursesController.js # Saved courses
│   │   ├── subscriptionController.js # Subscriptions
│   │   ├── testimonialController.js # Testimonials
│   │   ├── transactionController.js # Transactions
│   │   ├── userController.js     # User profiles
│   │   └── userProgressController.js # Course progress
│   ├── emailTemplates/
│   │   ├── account-deletion.html # Account deletion email
│   │   ├── course-purchase-confirmation.html # Purchase confirmation
│   │   ├── signup-email.html     # Signup confirmation
│   │   ├── welcome-email.html    # Welcome email
│   │   └── [other templates]     # Additional email templates
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT authentication
│   │   ├── errorMiddleware.js    # Error handling
│   │   ├── validateIds.js        # ID validation
│   │   ├── validateMiddleware.js # Request validation
│   │   └── validateRequest.js    # Request validation
│   ├── models/
│   │   ├── Certificate.js        # Certificate schema
│   │   ├── Course.js             # Course schema
│   │   ├── Payment.js            # Payment schema
│   │   ├── SavedCourse.js        # Saved courses schema
│   │   ├── Subscription.js       # Subscription schema
│   │   ├── TempUser.js           # Temporary user schema
│   │   ├── Testimonial.js        # Testimonial schema
│   │   ├── Transaction.js        # Transaction schema
│   │   ├── User.js               # User schema
│   │   └── UserProgress.js       # Progress schema
│   ├── public/
│   │   └── certificate-template.jpg # Certificate template
│   ├── routes/
│   │   ├── authRoutes.js         # Authentication routes
│   │   ├── certificateRoutes.js  # Certificate routes
│   │   ├── courseListRoutes.js   # Course listing routes
│   │   ├── courseRoutes.js       # Course routes
│   │   ├── dashboardRoutes.js    # Dashboard routes
│   │   ├── paymentRoutes.js      # Payment routes
│   │   ├── purchasedCourseRoutes.js # Purchased course routes
│   │   ├── savedCoursesRoutes.js # Saved course routes
│   │   ├── subscriptionRoutes.js # Subscription routes
│   │   ├── testimonialRoutes.js  # Testimonial routes
│   │   ├── transactionRoutes.js  # Transaction routes
│   │   ├── userProgressRoutes.js # Progress routes
│   │   └── userRoutes.js         # User routes
│   ├── seed/
│   │   └── seedCourses.js        # Course seeding script
│   ├── utils/
│   │   ├── cronJobs.js           # Scheduled tasks
│   │   ├── dateUtils.js          # Date utilities
│   │   ├── generateToken.js      # JWT token generation
│   │   ├── loadEmailTemplate.js  # Email template loader
│   │   ├── logger.js             # Logging utility
│   │   ├── razorpay.js           # Razorpay configuration
│   │   ├── sendEmail.js          # Email sending
│   │   └── sendResetLink.js      # Password reset link
│   ├── config.js                 # Backend configuration
│   ├── server.js                 # Main server file
│   ├── .env.development          # Development environment
│   ├── .env.production           # Production environment
│   ├── .gitignore                # Git ignore file
│   ├── package.json              # Backend dependencies
│   └── package-lock.json         # Dependency lock file
├── frontend/
│   ├── public/
│   │   └── assets/
│   │       ├── avatars/          # User avatar images
│   │       ├── favicon/          # Favicon assets
│   │       ├── icons/            # UI icons
│   │       ├── logos/            # Company and payment logos
│   │       └── certificate-templte.jpg # Certificate template
│   ├── src/
│   │   ├── admin/
│   │   │   ├── components/
│   │   │   │   ├── AdminFooter.jsx # Admin footer
│   │   │   │   ├── AdminMainContent.jsx # Admin content
│   │   │   │   ├── AdminNavbar.jsx # Admin navbar
│   │   │   │   ├── AdminSidebar.jsx # Admin sidebar
│   │   │   │   └── AdminProfile/
│   │   │   │       ├── AdminProfile.jsx # Admin profile
│   │   │   │       ├── components/
│   │   │   │       │   ├── AdminAccountSettings.jsx # Account settings
│   │   │   │       │   ├── AdminDeleteAccount.jsx # Account deletion
│   │   │   │       │   └── AdminLogout.jsx # Logout
│   │   │   │       └── styles/
│   │   │   │           ├── AdminAccountSettings.css
│   │   │   │           ├── AdminDeleteAccount.css
│   │   │   │           ├── AdminLogout.css
│   │   │   │           └── AdminProfile.css
│   │   │   ├── forms/
│   │   │   │   ├── CourseForm.jsx # Course management form
│   │   │   │   ├── RefundForm.jsx # Refund request form
│   │   │   │   └── TestimonialForm.jsx # Testimonial form
│   │   │   ├── pages/
│   │   │   │   ├── CourseManagement.jsx # Course management
│   │   │   │   ├── Dashboard.jsx  # Admin dashboard
│   │   │   │   ├── LoadingSpinner.jsx # Loading spinner
│   │   │   │   ├── SubscriptionManagement.jsx # Subscription management
│   │   │   │   ├── TestimonialManagement.jsx # Testimonial management
│   │   │   │   ├── TransactionManagement.jsx # Transaction management
│   │   │   │   └── UserManagement.jsx # User management
│   │   │   └── styles/
│   │   │       ├── AdminDashboard.css
│   │   │       ├── AdminFooter.css
│   │   │       ├── AdminMainContent.css
│   │   │       ├── AdminNavbar.css
│   │   │       ├── AdminSidebar.css
│   │   │       ├── CourseManagement.css
│   │   │       ├── Dashboard.css
│   │   │       ├── RefundForm.css
│   │   │       ├── SubscriptionManagement.css
│   │   │       ├── TestimonialManagement.css
│   │   │       ├── TransactionManagement.css
│   │   │       └── UserManagement.css
│   │   ├── components/
│   │   │   ├── Carousel.jsx       # Homepage carousel
│   │   │   ├── CertificateDownload.jsx # Certificate download
│   │   │   ├── CourseCard.jsx     # Course card
│   │   │   ├── CourseContent.jsx  # Course content
│   │   │   ├── CourseList.jsx     # Course listing
│   │   │   ├── CourseProgress.jsx # Progress tracking
│   │   │   ├── ErrorBoundary.jsx  # Error handling
│   │   │   ├── FAQSection.jsx     # FAQ section
│   │   │   ├── Footer.jsx         # Footer
│   │   │   ├── HeroSection.jsx    # Hero section
│   │   │   ├── InProgressCourseCard.jsx # In-progress course card
│   │   │   ├── InProgressCourses.jsx # In-progress courses
│   │   │   ├── LazyImage.jsx      # Lazy-loaded image
│   │   │   ├── LazySwiperSlide.jsx # Lazy-loaded swiper
│   │   │   ├── LoadingSpinner.jsx # Loading spinner
│   │   │   ├── Navbar.jsx         # Navigation bar
│   │   │   ├── SavedCourseCard.jsx # Saved course card
│   │   │   ├── SavedCourses.jsx   # Saved courses
│   │   │   ├── ScrollToTop.jsx    # Scroll-to-top
│   │   │   ├── Testimonial.jsx    # Testimonial
│   │   │   ├── TimerComponent.jsx # Timer
│   │   │   └── profile/
│   │   │       ├── AccountSettings.jsx # Account settings
│   │   │       ├── Certificates.jsx # Certificates
│   │   │       ├── DeleteAccount.jsx # Account deletion
│   │   │       ├── Logout.jsx     # Logout
│   │   │       ├── PurchasedCourses.jsx # Purchased courses
│   │   │       ├── Subscriptions.jsx # Subscriptions
│   │   │       ├── UserProfile.jsx # User profile
│   │   │       └── styles/
│   │   │           ├── AccountSettings.css
│   │   │           ├── Certificate.css
│   │   │           ├── DeleteAccount.css
│   │   │           ├── Logout.css
│   │   │           ├── PurchasedCourses.css
│   │   │           ├── Subscription.css
│   │   │           └── UserProfile.css
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx    # Authentication context
│   │   │   └── CartContext.jsx    # Cart context
│   │   ├── hooks/
│   │   │   ├── useAuth.js         # Authentication hook
│   │   │   └── useCart.js         # Cart hook
│   │   ├── utils/
│   │   │   ├── auth.js            # Authentication utilities
│   │   │   └── checkCourseAccess.js # Course access checker
│   │   ├── App.css                # App styles
│   │   ├── App.jsx                # Main app component
│   │   ├── index.css              # Global styles
│   │   ├── lang-detector.d.ts     # TypeScript declaration
│   │   ├── main.jsx               # Vite entry point
│   │   └── pages/
│   │       ├── AboutUs.jsx        # About us
│   │       ├── Careers.jsx        # Careers
│   │       ├── CartPage.jsx       # Cart
│   │       ├── ContactUs.jsx      # Contact us
│   │       ├── Dashboard.jsx      # User dashboard
│   │       ├── ForgotPassword.jsx # Forgot password
│   │       ├── GiftPlan.jsx       # Gift plan
│   │       ├── LessonPage.jsx     # Lesson content
│   │       ├── Login.jsx          # Login
│   │       ├── PaymentPage.jsx    # Payment
│   │       ├── PersonalPlan.jsx   # Personal plan
│   │       ├── PricingPage.jsx    # Pricing
│   │       ├── PrivacyPolicy.jsx  # Privacy policy
│   │       ├── RefundPolicy.jsx   # Refund policy
│   │       ├── ResetPassword.jsx  # Reset password
│   │       ├── SearchResults.jsx  # Search results
│   │       ├── Signup.jsx         # Signup
│   │       ├── Success.jsx        # Success page
│   │       ├── Support.jsx        # Support
│   │       ├── TeamPlan.jsx       # Team plan
│   │       ├── TermsOfService.jsx # Terms of service
│   │       ├── TrustedPage.jsx    # Trusted page
│   │       └── VerifyEmail.jsx    # Email verification
│   ├── razorpay-test.html         # Razorpay test page
│   ├── vite.config.js             # Vite configuration
│   ├── vercel.json                # Vercel configuration
│   ├── .env.development           # Development environment
│   ├── .env.production            # Production environment
│   ├── .gitignore                 # Git ignore file
│   ├── eslint.config.js           # ESLint configuration
│   ├── index.html                 # Main HTML
│   ├── package.json               # Frontend dependencies
│   └── package-lock.json          # Dependency lock file
├── .gitignore                     # Root git ignore
├── package.json                   # Root project metadata
├── README.md                      # Project documentation
└── LICENSE                        # MIT License

Note: The project contains over 150 files, with 100+ in the frontend and 50+ in the backend. Generated files (e.g., node_modules, backend/public/generated-certificates) are excluded from the repository. Some directories (e.g., emailTemplates) contain additional files not listed for brevity. Explore the repository for the full structure.
Contributing
Contributions are welcome! To contribute to SkillNestX:

Clone the repository:
git clone https://github.com/MdMeraj/SkillNestX.git


Create a new branch:
git checkout -b feature/your-feature


Make changes and commit:
git commit -m 'Add your feature'


Push to the branch:
git push origin feature/your-feature


Open a pull request with a detailed description.


Ensure code follows the project's standards and includes tests.
Support
For inquiries, contact our support team:

General Support: support@skillnestx.com
Feedback: feedback@skillnestx.com
Careers: careers@skillnestx.com

License
This project is licensed under the MIT License. See the LICENSE file for details.
Made with ❤️ by Md Meraj


