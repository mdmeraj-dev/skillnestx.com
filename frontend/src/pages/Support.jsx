import { useState } from "react";
import "../styles/Support.css"; // Import CSS file

import arrowDown from "/assets/icons/arrow-down.svg";

const faqs = [
  {
    question: "What is SkillNestX?",
    answer: (
      <>
        SkillNestX is an <strong>online learning platform</strong> that offers{" "}
        <strong>premium, high-quality courses</strong> created by top software developers. Our
        courses are designed to help learners master <strong>in-demand skills</strong> and excel in
        their careers.
      </>
    ),
  },
  {
    question: "Who creates the courses on SkillNestX?",
    answer: (
      <>
        Our courses are created by a team of <strong>20 top-notch software developers</strong>{" "}
        working in leading MNCs. Each course is <strong>meticulously designed</strong> to provide
        practical, industry-relevant knowledge.
      </>
    ),
  },
  {
    question: "Do you offer a free trial?",
    answer: (
      <>
        Yes, we offer <strong>free previews</strong> for only selected courses. You can explore
        some course content and curriculum before making a purchase.
      </>
    ),
  },
  {
    question: "What is your refund policy?",
    answer: (
      <>
        We offer a <strong>3-day refund policy</strong> for all purchases. If you are
        unsatisfied with your purchase, you can request a refund within 3 days of
        the purchase date. However, <strong>no refund will be issued</strong> if you have
        completed any course or consumed a significant portion of the course
        content.
      </>
    ),
  },
  {
    question: "How do I access my purchased courses?",
    answer: (
      <>
        Once you purchase a course, you can <strong>access it immediately</strong> from your
        account dashboard. You&apos;ll have access to all the courses if you have any{" "}
        <strong>active subscription plan</strong>.
      </>
    ),
  },
  {
    question: "Are the courses suitable for beginners?",
    answer: (
      <>
        Yes, we offer courses for <strong>all skill levels</strong>, from beginners to advanced
        learners. Each course includes <strong>detailed descriptions</strong> and prerequisites to
        help you choose the right one.
      </>
    ),
  },
  {
    question: "Can I download the course materials?",
    answer: (
      <>
        Currently, course materials are only <strong>accessible online</strong>. However, we are
        exploring options to provide <strong>downloadable resources</strong> in the future.
      </>
    ),
  },
  {
    question: "Do you offer certificates upon course completion?",
    answer: (
      <>
        Yes, we provide <strong>certificates of completion</strong> for all our courses. These
        certificates can be <strong>shared on LinkedIn</strong> and added to your resume.
      </>
    ),
  },
  {
    question: "Can I download my certificate and rate the course before completing it?",
    answer: (
      <>
        No, you must <strong>complete all lessons</strong> in the course to download your
        certificate and rate the course. Once you&apos;ve completed the course, the{" "}
        <strong>&apos;Download Certificate&apos;</strong> button and the{" "}
        <strong>&apos;Rate This Course&apos;</strong> section will become available.
      </>
    ),
  },
  {
    question: "How can I contact support if I have issues?",
    answer: (
      <>
        You can reach out to our support team at{" "}
        <a href="mailto:support@skillnestx.com">support@skillnestx.com</a>. We aim to
        respond to all inquiries within <strong>24 hours</strong>.
      </>
    ),
  },
  {
    question: "Do you offer team or enterprise plans?",
    answer: (
      <>
        Yes, we offer <strong>team or enterprise plans</strong> for organizations. Please
        contact us at <a href="mailto:support@skillnestx.com">support@skillnestx.com</a> for
        more details.
      </>
    ),
  },
];

const Support = () => {
  const [openIndex, setOpenIndex] = useState(null);

  // Toggle FAQ visibility
  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="support-section">
      <h1 className="support-title">Support Center</h1>
      <p className="support-subtitle">
        We&apos;re here to help! Browse our FAQs or contact us directly for
        further assistance.
      </p>

      {/* FAQ Section */}
      <div className="support-faq-section">
        <h2 className="support-faq-title">Frequently Asked Questions</h2>
        <div className="support-faq-list">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`support-faq-item ${openIndex === index ? "support-faq-item--active" : ""}`}
            >
              <button
                className="support-faq-question"
                onClick={() => toggleFAQ(index)}
                aria-expanded={openIndex === index}
              >
                <span className="support-faq-question-text">{faq.question}</span>
                <img
                  src={arrowDown}
                  alt={openIndex === index ? "Collapse" : "Expand"}
                  className={`support-faq-icon ${openIndex === index ? "support-faq-icon--rotated" : ""}`}
                />
              </button>
              {openIndex === index && (
                <div className="support-faq-answer" aria-hidden={openIndex !== index}>
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Email Support Card */}
      <div className="support-email-card">
        <h2 className="support-email-title">Need Further Assistance?</h2>
        <p className="support-email-text">
          If you can&apos;t find the answer to your question in our FAQs, feel
          free to reach out to our support team. We&apos;re here to help!
        </p>
        <a href="mailto:support@skillnestx.com" className="support-email-link">
          support@skillnestx.com
        </a>
      </div>
    </section>
  );
};

export default Support;