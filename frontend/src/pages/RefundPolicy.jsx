import { useEffect } from "react";
import "../styles/RefundPolicy.css"; // Import CSS

const RefundPolicy = () => {
  // Set the document title
  useEffect(() => {
    document.title = "Refund Policy | SkillNestX";
  }, []);

  return (
    <div className="refund-container">
      <h1>Refund Policy</h1>
      <p className="last-updated">
        <strong>Last Updated:</strong> August 8, 2025
      </p>

      <section>
        <h2>1. No Refund Policy</h2>
        <p>
          At <strong>SkillNestX</strong>, we take pride in offering
          <strong>premium, high-quality educational content</strong> created by
          top industry engineers and developers working at leading multinational
          companies (MNCs). Our courses are designed to provide exceptional
          value, equipping learners with the skills and knowledge needed to excel
          in the tech industry.
        </p>
        <p>
          Due to the significant <strong>effort, time, and resources</strong>
          invested in developing and maintaining our courses, we operate on a
          <strong>no-refund policy</strong>. Once a purchase is made, refunds
          will not be issued under any circumstances.
        </p>
      </section>

      <section>
        <h2>2. Why We Have a No-Refund Policy</h2>
        <p>
          Our no-refund policy is in place for the following reasons:
        </p>
        <ul>
          <li>
            <strong>High-Quality Content:</strong> Each course is meticulously
            crafted by industry experts, ensuring that learners receive the best
            possible education.
          </li>
          <li>
            <strong>Immediate Access:</strong> Upon purchase, you gain instant
            and lifetime access to the course materials, making it impossible to
            &quot;return&quot; the product.
          </li>
          <li>
            <strong>Resource Allocation:</strong> The revenue from course sales
            is reinvested into creating new content, improving existing courses,
            and maintaining our platform.
          </li>
        </ul>
        <p>
          We encourage all users to carefully review the course details, including
          previews, descriptions, and curriculum outlines, before making a
          purchase.
        </p>
      </section>

      <section>
        <h2>3. Future Refund Policy Considerations</h2>
        <p>
          We understand that flexibility is important to our learners. While we
          currently do not offer refunds, we are actively exploring options to
          introduce a refund policy in the future to enhance user satisfaction.
        </p>
        <p>
          Any updates regarding refund eligibility, conditions, and procedures
          will be communicated through our official website and email
          notifications. We recommend checking this page periodically for the
          latest information.
        </p>
      </section>

      <section>
        <h2>4. Course Previews and Descriptions</h2>
        <p>
          To help you make informed decisions, we provide:
        </p>
        <ul>
          <li>Detailed course descriptions and learning objectives.</li>
          <li>Comprehensive curriculum outlines.</li>
          <li>Free previews of select course content.</li>
        </ul>
        <p>
          We encourage you to take advantage of these resources to ensure that a
          course meets your expectations before purchasing.
        </p>
      </section>

      <section>
        <h2>5. Contact Us</h2>
        <p>
          If you have any questions or concerns regarding this Refund Policy,
          please feel free to reach out to us. We are here to help!
        </p>
        <p>
          <strong>Email:</strong>{" "}
          <a href="mailto:support@skillnestx.com">support@skillnestx.com</a>
        </p>
      </section>
    </div>
  );
};

export default RefundPolicy;