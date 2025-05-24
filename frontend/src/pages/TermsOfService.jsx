import { useEffect } from "react";
import "../styles/TermsOfService.css"; // Import CSS

const TermsAndConditions = () => {
  // Set the document title
  useEffect(() => {
    document.title = "Terms & Conditions | SkillNestX";
  }, []);

  return (
    <div className="terms-container">
      <h1>Terms and Conditions</h1>
      <p className="last-updated">
        <strong>Last Updated: </strong> January 10, 2025
      </p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          Welcome to <strong>SkillNestX</strong> (
          <span>&quot;we,&quot; &quot;our,&quot; &quot;us,&quot;</span> or
          &quot;the Platform&quot;). These Terms and Conditions
          (&quot;Terms&quot;) govern your access to and use of the SkillNestX
          website, courses, and services (collectively, &quot;Services&quot;).
          By accessing or using our Services, you agree to be bound by these
          Terms. If you do not agree to these Terms, you must not use our
          Services.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and
          SkillNestX. Please read them carefully before using our Services.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          SkillNestX is committed to making high-quality education accessible to
          everyone. To use our Services:
        </p>
        <ul>
          <li>
            <strong>For Minors:</strong> If you are under the age of 18 (or the
            age of majority in your jurisdiction), you may use our Services only
            with the consent and supervision of a parent or legal guardian. By
            using our Services, you confirm that your parent or guardian has
            reviewed and agreed to these Terms on your behalf.
          </li>
          <li>
            <strong>For Adults:</strong> If you are 18 years or older, you may
            use our Services independently, provided you have the legal capacity
            to enter into a binding agreement.
          </li>
          <li>
            <strong>Compliance:</strong> All users, regardless of age, must
            comply with applicable laws and regulations while using our
            Services.
          </li>
        </ul>
        <p>
          If you are using our Services on behalf of an organization, you
          represent and warrant that you have the authority to bind that
          organization to these Terms.
        </p>
      </section>

      <section>
        <h2>3. Account Registration</h2>
        <p>
          To access certain features of our Services, you must create an
          account. You agree to:
        </p>
        <ul>
          <li>
            Provide accurate, current, and complete information during
            registration.
          </li>
          <li>
            Maintain and promptly update your account information to keep it
            accurate, current, and complete.
          </li>
          <li>
            Safeguard your account credentials and notify us immediately of any
            unauthorized access or breach of security.
          </li>
        </ul>
        <p>
          You are solely responsible for all activities that occur under your
          account. SkillNestX reserves the right to suspend or terminate your
          account if we suspect any unauthorized or fraudulent activity.
        </p>
      </section>

      <section>
        <h2>4. Course Access and Usage</h2>
        <p>
          All courses purchased on SkillNestX are for{" "}
          <strong>personal, non-commercial use only</strong>. You agree not to:
        </p>
        <ul>
          <li>
            Redistribute, resell, or share course content with any third party.
          </li>
          <li>
            Reproduce, modify, or create derivative works based on our content.
          </li>
          <li>
            Use our content for any commercial purpose without our prior written
            consent.
          </li>
        </ul>
        <p>
          Violation of these terms may result in immediate termination of your
          access to the Services and legal action.
        </p>
      </section>

      <section>
        <h2>5. Payments and Pricing</h2>
        <p>
          All payments for courses are processed securely through our payment
          gateway. You agree to provide accurate payment information and
          authorize us to charge the applicable fees.
        </p>
        <p>
          We reserve the right to modify course prices at any time without prior
          notice. However, any price changes will not affect courses you have
          already purchased.
        </p>
      </section>

      <section>
        <h2>6. Refund Policy</h2>
        <p className="no-refund">
          Creating high-quality, in-depth courses requires significant{" "}
          <strong>effort, time, and expertise</strong>. As such, we operate on a{" "}
          <strong>no-refund policy</strong>. Once a purchase is made, refunds
          will not be issued under any circumstances.
        </p>
        <p>
          We encourage you to review the course details, including previews and
          descriptions, carefully before making a purchase. If you have any
          questions about a course, please contact us at{" "}
          <strong>
            {" "}
            <a href="mailto:support@skillnestx.com">support@skillnestx.com</a>
          </strong>{" "}
          before purchasing.
        </p>
      </section>

      <section>
        <h2>7. Intellectual Property</h2>
        <p>
          All content provided on SkillNestX, including but not limited to
          videos, text, graphics, logos, and course materials, is the exclusive
          property of SkillNestX or its licensors and is protected by copyright,
          trademark, and other intellectual property laws.
        </p>
        <p>
          You are granted a limited, non-exclusive, non-transferable license to
          access and use the content for personal, non-commercial purposes only.
        </p>
      </section>

      <section>
        <h2>8. User Conduct</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use our Services for any illegal or unauthorized purpose.</li>
          <li>Harass, abuse, or harm others through our platform.</li>
          <li>
            Upload or share content that is defamatory, obscene, or violates any
            third-party rights.
          </li>
          <li>
            Attempt to gain unauthorized access to our systems or interfere with
            the proper functioning of our Services.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Modification of Terms</h2>
        <p>
          We reserve the right to update or modify these Terms at any time
          without prior notice. Any changes will be effective immediately upon
          posting on our website. Your continued use of our Services after such
          changes constitutes your acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h2>10. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, SkillNestX shall not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages, including but not limited to loss of profits, data, or use.
        </p>
      </section>

      <section>
        <h2>11. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of [Insert Jurisdiction], without regard to its conflict of law
          principles.
        </p>
      </section>

      <section>
        <h2>12. Contact Us</h2>
        <p>
          If you have any questions, concerns, or inquiries regarding these
          Terms, please contact us at:
        </p>
        <p>
          <strong>Email:</strong>{" "}
          <a href="mailto:support@skillnestx.com">support@skillnestx.com</a>
        </p>
      </section>
    </div>
  );
};

export default TermsAndConditions;
