import PropTypes from "prop-types";

const CertificateDownload = ({ onDownload, isDownloading }) => {
  return (
    <button
      className="download-certificate-button"
      onClick={onDownload}
      disabled={isDownloading}
    >
      {isDownloading ? "Generating..." : "Download Certificate"}
    </button>
  );
};

// Add PropTypes validation
CertificateDownload.propTypes = {
  onDownload: PropTypes.func.isRequired,
  isDownloading: PropTypes.bool.isRequired,
};

export default CertificateDownload;