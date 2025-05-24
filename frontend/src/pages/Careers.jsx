import { useEffect } from "react";
import "../styles/Careers.css"; // Import CSS

const Careers = () => {
  // Set the document title
  useEffect(() => {
    document.title = "Careers | SkillNestX";
  }, []);

  return (
    <div className="careers-container">
      <h1>Careers at SkillNestX</h1>
      <h2 className="tagline">
        <strong>
          Join Our Remote Team and Empower the Next Generation of Tech
          Professionals
        </strong>
      </h2>

      <section>
        <h3>Why Work With Us?</h3>
        <p>
          At <strong>SkillNestX</strong>, we’re on a mission to help
          individuals crack any interview and achieve their career dreams. We’re
          a fast-growing, innovative, and fully remote team dedicated to
          creating high-quality, industry-relevant courses that make a real
          difference.
        </p>
        <p>
          When you join SkillNestX, you’re not just joining a company—you’re
          joining a movement to transform education and empower learners
          worldwide.
        </p>
      </section>

      <section>
        <h3>Our Remote Culture</h3>
        <p>
          As a fully remote team, we’ve built a culture that thrives on
          flexibility, collaboration, and trust. Here’s what makes our culture
          unique:
        </p>
        <ul>
          <li>
            <strong>Flexibility:</strong> Work from anywhere in the world and
            set your own schedule to achieve a healthy work-life balance.
          </li>
          <li>
            <strong>Collaboration:</strong> We use cutting-edge tools to stay
            connected and work together seamlessly, no matter where we are.
          </li>
          <li>
            <strong>Autonomy:</strong> We trust our team members to take
            ownership of their work and make meaningful contributions.
          </li>
          <li>
            <strong>Global Team:</strong> Join a diverse team of talented
            professionals from around the world.
          </li>
        </ul>
      </section>

      <section>
        <h3>Our Values</h3>
        <p>Our values guide everything we do:</p>
        <ul>
          <li>
            <strong>Learner First:</strong> We prioritize the needs and success
            of our learners above all else.
          </li>
          <li>
            <strong>Excellence:</strong> We strive for excellence in everything
            we do, from course content to customer support.
          </li>
          <li>
            <strong>Integrity:</strong> We act with honesty, transparency, and
            respect in all our interactions.
          </li>
          <li>
            <strong>Passion:</strong> We’re passionate about education and
            helping others achieve their goals.
          </li>
        </ul>
      </section>

      <section>
        <h3>Open Positions</h3>
        <p>
          We’re always looking for talented and passionate individuals to join
          our remote team. Below are some of the roles we’re currently hiring
          for:
        </p>
        <div className="job-listings">
          <div className="job-card">
            <h3>Graphic Designer</h3>
            <p>
              <strong>Location:</strong> Remote
            </p>
            <p>
              <strong>Type:</strong> Full-Time
            </p>
            <p>
              We’re looking for a creative and detail-oriented Graphic Designer
              to bring our course materials and marketing campaigns to life. If
              you have a passion for design and education, this role is for you.
            </p>
            <a href="/apply-graphic-designer" className="apply-button">
              Apply Now
            </a>
          </div>

          <div className="job-card">
            <h3>Content Strategist</h3>
            <p>
              <strong>Location:</strong> Remote
            </p>
            <p>
              <strong>Type:</strong> Full-Time
            </p>
            <p>
              We’re seeking a creative Content Strategist to develop and execute
              content plans that engage and inspire our learners. If you’re
              passionate about education and storytelling, this role is for you.
            </p>
            <a href="/apply-content-strategist" className="apply-button">
              Apply Now
            </a>
          </div>

          <div className="job-card">
            <h3>Digital Marketing Specialist</h3>
            <p>
              <strong>Location:</strong> Remote
            </p>
            <p>
              <strong>Type:</strong> Full-Time
            </p>
            <p>
              Join our team as a Digital Marketing Specialist and help us grow
              our brand and reach more learners. You’ll work on campaigns,
              analyze data, and drive results in a fast-paced environment.
            </p>
            <a href="/apply-digital-marketing" className="apply-button">
              Apply Now
            </a>
          </div>
        </div>
      </section>

      <section>
        <h3>Benefits of Working at SkillNestX</h3>
        <p>
          As a remote-first company, we offer a range of benefits to support our
          employees’ well-being and professional growth:
        </p>
        <ul>
          <li>
            <strong>Work from Anywhere:</strong> Enjoy the freedom to work from
            anywhere in the world.
          </li>
          <li>
            <strong>Flexible Hours:</strong> Set your own schedule to achieve a
            healthy work-life balance.
          </li>
          <li>
            <strong>Competitive Salary:</strong> We offer market-competitive
            compensation packages.
          </li>
          <li>
            <strong>Learning Opportunities:</strong> Free access to all
            SkillNestX courses and resources.
          </li>
          <li>
            <strong>Health & Wellness:</strong> Comprehensive health insurance
            and wellness programs.
          </li>
          <li>
            <strong>Team Events:</strong> Regular virtual team-building
            activities and meetups.
          </li>
        </ul>
      </section>

      <section>
        <h3>How to Apply</h3>
        <p>Ready to join our remote team? Here’s how to get started:</p>
        <ol>
          <li>Browse our open positions above.</li>
          <li>
            Click the <strong>Apply Now</strong> button for the role you’re
            interested in.
          </li>
          <li>
            Submit your resume and a brief cover letter explaining why you’re a
            great fit for the role.
          </li>
        </ol>
        <p>
          We review applications on a rolling basis and will reach out to
          qualified candidates for interviews.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          Have questions about our open roles or the application process? We’re
          here to help! Reach out to us at:
        </p>
        <p>
          <strong>Email:</strong>{" "}
          <a href="mailto:careers@skillnestx.com">careers@skillnestx.com</a>
        </p>
      </section>
    </div>
  );
};

export default Careers;