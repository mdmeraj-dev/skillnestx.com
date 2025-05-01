import "../styles/TrustedPage.css";

const TrustedPage = () => {
  // Top 5 Companies
  const companies = [
    { name: "Google", logo: "/assets/logos/google-logo.png" },
    { name: "Apple", logo: "/assets/logos/apple-logo.png" },
    { name: "Microsoft", logo: "/assets/logos/microsoft-logo.png" },
    { name: "Meta", logo: "/assets/logos/meta-logo.png" },
    { name: "Amazon", logo: "/assets/logos/amazon-logo.png" },
  ];

  // Top 5 Universities
  const universities = [
    { name: "Harvard", logo: "/assets/logos/harvard-logo.png" },
    { name: "IIT Bombay", logo: "/assets/logos/bombay-logo.png" },
    { name: "IIT Delhi", logo: "/assets/logos/delhi-logo.png" },
    { name: "NIT Trichy", logo: "/assets/logos/trichy-logo.png" },
  ];

  return (
    <div className="trusted-section-wrapper">
      {/* Title */}
      <h2 className="trusted-section-heading">
        Trusted by 1,200,000+ Learners All Over the World
      </h2>

      {/* Companies and Universities */}
      <div className="trusted-organizations-container">
        {/* Companies Section */}
        <div className="trusted-companies-section">
          <div className="trusted-companies-list">
            {companies.map((company, index) => (
              <div key={index} className="organization-logo-item">
                <img
                  src={company.logo}
                  alt={company.name}
                  className="organization-logo-image"
                />
                <p className="organization-logo-name">{company.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Universities Section */}
        <div className="trusted-universities-section">
          <div className="trusted-universities-list">
            {universities.map((university, index) => (
              <div key={index} className="organization-logo-item">
                <img
                  src={university.logo}
                  alt={university.name}
                  className="organization-logo-image"
                />
                <p className="organization-logo-name">{university.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustedPage;