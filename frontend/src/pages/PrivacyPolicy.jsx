import { useEffect } from "react";
import "../styles/PrivacyPolicy.css"; // Import the corresponding CSS file

const PrivacyPolicy = () => {
  // Set the document title
  useEffect(() => {
    document.title = "Privacy Policy | SkillNestX";
  }, []);

  return (
    <div className="privacy-container">
      <h1>Privacy Policy</h1>
      <p className="last-updated">
        <strong>Last Updated: </strong> March 28, 2025
      </p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          At <strong>SkillNestX</strong>, we are committed to protecting your
          privacy and ensuring the security of your personal information. This
          Privacy Policy outlines how we collect, use, and safeguard your data
          when you visit our website, purchase our courses, or interact with our
          services. By using SkillNestX, you agree to the terms outlined in this
          policy.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>
          We collect the following types of information to provide and improve
          our services:
        </p>
        <ul>
          <li>
            <strong>Personal Information</strong>: When you create an account,
            purchase a course, or contact us, we may collect your name, email
            address, payment details, and other relevant information.
          </li>
          <li>
            <strong>Usage Data</strong>: We automatically collect information
            about how you interact with our website, such as your IP address,
            browser type, pages visited, and time spent on the site.
          </li>
          <li>
            <strong>Cookies and Tracking Technologies</strong>: We use cookies
            and similar technologies to enhance your experience, analyze trends,
            and administer the website.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <p>We use the information we collect for the following purposes:</p>
        <ul>
          <li>To provide, maintain, and improve our services.</li>
          <li>To process transactions and send you confirmations.</li>
          <li>
            To communicate with you about updates, promotions, and support
            requests.
          </li>
          <li>
            To analyze website usage and optimize our content and user
            experience.
          </li>
          <li>
            To comply with legal obligations and protect against fraudulent
            activities.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Sharing Your Information</h2>
        <p>
          We do not sell or rent your personal information to third parties.
          However, we may share your data in the following circumstances:
        </p>
        <ul>
          <li>
            <strong>Service Providers</strong>: We may share information with
            trusted third-party vendors who assist us in operating our website,
            processing payments, or delivering services.
          </li>
          <li>
            <strong>Legal Requirements</strong>: We may disclose your
            information if required by law or to protect our rights, property,
            or safety.
          </li>
          <li>
            <strong>Business Transfers</strong>: In the event of a merger,
            acquisition, or sale of assets, your information may be transferred
            to the new owner.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Data Security</h2>
        <p>
          We take the security of your data seriously. We implement
          industry-standard measures to protect your information from
          unauthorized access, alteration, disclosure, or destruction. These
          measures include encryption, secure payment gateways, and regular
          security audits.
        </p>
      </section>

      <section>
        <h2>6. Your Rights</h2>
        <p>
          You have the following rights regarding your personal information:
        </p>
        <ul>
          <li>
            <strong>Access</strong>: You can request a copy of the data we hold
            about you.
          </li>
          <li>
            <strong>Correction</strong>: You can update or correct inaccurate
            information.
          </li>
          <li>
            <strong>Deletion</strong>: You can request that we delete your data,
            subject to legal obligations.
          </li>
          <li>
            <strong>Opt-Out</strong>: You can unsubscribe from marketing
            communications at any time.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Cookies and Tracking</h2>
        <p>
          We use cookies to enhance your browsing experience. You can manage or
          disable cookies through your browser settings, but this may affect
          your ability to use certain features of our website.
        </p>
      </section>

      <section>
        <h2>8. Third-Party Links</h2>
        <p>
          Our website may contain links to third-party websites. We are not
          responsible for the privacy practices or content of these external
          sites. We encourage you to review their privacy policies before
          providing any personal information.
        </p>
      </section>

      <section>
        <h2>9. Children&apos;s Privacy</h2>
        <p>
          SkillNestX does not knowingly collect personal information from
          children under the age of 13. If we become aware that we have
          collected such data, we will take steps to delete it promptly.
        </p>
      </section>

      <section>
        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes
          in our practices or legal requirements. We will notify you of any
          significant changes by posting the updated policy on our website and
          updating the &quot;Last Updated&quot; date.
        </p>
      </section>

      <section>
        <h2>11. Contact Us</h2>
        <p>
          If you have any questions or concerns about this Privacy Policy or our
          data practices, please contact us at:
        </p>
        <p>
          <strong>Email:</strong>{" "}
          <a href="mailto:support@skillnestx.com">support@skillnestx.com</a>
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
