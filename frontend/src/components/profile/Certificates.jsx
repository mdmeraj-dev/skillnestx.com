import { useEffect } from "react";
import PropTypes from "prop-types";
import closeIcon from "/assets/icons/close.svg";
import downloadIcon from "/assets/icons/download.svg";
import "./styles/Certificate.css";

const Certificate = ({ onBack }) => {
  // Dummy data for certificates (increased to trigger scrollbar)
  const certificates = [
    {
      id: 1,
      name: "React Mastery Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/react-mastery.pdf",
    },
    {
      id: 2,
      name: "Advanced JavaScript Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/advanced-javascript.pdf",
    },
    {
      id: 3,
      name: "Node.js Fundamentals Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/nodejs-fundamentals.pdf",
    },
    {
      id: 4,
      name: "Web Development Bootcamp Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/web-dev-bootcamp.pdf",
    },
    {
      id: 5,
      name: "CSS Mastery Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/css-mastery.pdf",
    },
    {
      id: 6,
      name: "Python for Beginners Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/python-beginners.pdf",
    },
    {
      id: 7,
      name: "Data Science Fundamentals Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/data-science.pdf",
    },
    {
      id: 8,
      name: "AWS Certified Developer Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/aws-developer.pdf",
    },
    {
      id: 9,
      name: "UI/UX Design Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/ui-ux-design.pdf",
    },
    {
      id: 10,
      name: "Cybersecurity Essentials Certificate",
      thumbnail: "https://via.placeholder.com/150",
      downloadUrl: "https://example.com/certificates/cybersecurity.pdf",
    },
  ];

  // Prevent background scrolling
  useEffect(() => {
    document.body.classList.add("login-modal-open");
    return () => {
      document.body.classList.remove("login-modal-open");
    };
  }, []);

  const handleCertificateClick = (downloadUrl) => {
    window.open(downloadUrl, "_blank");
  };

  const handleDownload = (downloadUrl, certificateName) => {
    // Mock download action (replace with actual download logic if needed)
    console.log(`Downloading ${certificateName}: ${downloadUrl}`);
    window.open(downloadUrl, "_blank");
  };

  return (
    <div
      className="cert-modal-overlay"
      role="dialog"
      aria-labelledby="cert-title"
    >
      <div className="cert-modal-container">
        <button
          className="cert-close-button"
          onClick={onBack}
          aria-label="Close certificates"
        >
          <img
            src={closeIcon}
            alt=""
            className="cert-close-icon"
          />
        </button>

        <div className="cert-header">
          <h2
            id="cert-title"
            className="cert-title"
          >
            Certificates
          </h2>
        </div>

        <div className="cert-list">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="cert-item"
              onClick={() => handleCertificateClick(certificate.downloadUrl)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleCertificateClick(certificate.downloadUrl);
                }
              }}
              aria-label={`View ${certificate.name}`}
            >
              <img
                src={certificate.thumbnail}
                alt={certificate.name}
                className="cert-thumbnail"
              />
              <div className="cert-details">
                <p className="cert-name">
                  {certificate.name}
                </p>
                <button
                  className="cert-download-button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering cert-item click
                    handleDownload(certificate.downloadUrl, certificate.name);
                  }}
                  aria-label={`Download ${certificate.name}`}
                >
                  <img
                    src={downloadIcon}
                    alt=""
                    className="cert-download-icon"
                  />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Certificate.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default Certificate;