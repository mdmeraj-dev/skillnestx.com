import { Helmet } from "react-helmet";
import "../styles/ContactUs.css"; // Import CSS

const ContactUs = () => {
  return (
    <div className="contact-container">
      {/* Set Page Title */}
      <Helmet>
        <title>Contact Us | SkillNestX</title>
      </Helmet>

      <h1>Contact Us</h1>
      <p className="contact-tagline">
        <strong>We&apos;d love to hear from you!</strong> Whether you have a
        question, need support, or want to share feedback, our team is here to
        help. Reach out to us, and we&apos;ll get back to you as soon as
        possible.
      </p>

      <div className="contact-card">
        <h2>📧 Email Support</h2>
        <p>
          Our team of experts is available to assist you via email. Whether
          you&apos;re facing an issue, have a question about our courses, or
          want to provide feedback, we&apos;re just an email away.
        </p>
        <p className="contact-email">
          <strong>Email:</strong>{" "}
          <a href="mailto:support@skillnestx.com">support@skillnestx.com</a>
        </p>
      </div>

      <div className="contact-card">
        <h2>🌍 Remote Work Policy</h2>
        <p>
          At SkillNestX, we operate as a fully remote team, bringing together
          top software developers and educators from around the world. While we
          don&apos;t have a physical office, our global presence allows us to
          deliver high-quality courses and support to learners like you.
        </p>
        <p>
          If you&apos;d like to connect with us for partnerships,
          collaborations, or career opportunities, feel free to reach out via
          email.
        </p>
      </div>

      <div className="contact-card">
        <h2>💡 Feedback & Suggestions</h2>
        <p>
          Your feedback is invaluable to us! If you have suggestions for new
          courses, improvements to our platform, or any other ideas, we&apos;d
          love to hear from you. Together, we can make SkillNestX even better.
        </p>
        <p className="contact-email">
          <strong>Email:</strong>{" "}
          <a href="mailto:feedback@skillnestx.com">feedback@skillnestx.com</a>
        </p>
      </div>
    </div>
  );
};

export default ContactUs;
