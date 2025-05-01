import PropTypes from 'prop-types';
import '../styles/LoadingSpinner.css'; // We'll create this CSS file next

const LoadingSpinner = ({ 
  size = 'medium',
  color = 'primary',
  fullPage = false,
  className = '',
  overlay = true,
  text = ''
}) => {
  // Size classes
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large',
    xlarge: 'spinner-xlarge'
  };

  // Color classes
  const colorClasses = {
    primary: 'spinner-primary',
    secondary: 'spinner-secondary',
    light: 'spinner-light',
    dark: 'spinner-dark',
    white: 'spinner-white'
  };

  // Combine classes
  const spinnerClass = `spinner ${sizeClasses[size]} ${colorClasses[color]} ${className}`;
  const containerClass = `spinner-container ${fullPage ? 'spinner-fullpage' : ''} ${overlay ? 'spinner-overlay' : ''}`;

  return (
    <div className={containerClass}>
      <div className={spinnerClass}>
        <div className="spinner-circle"></div>
        <div className="spinner-circle"></div>
        <div className="spinner-circle"></div>
        <div className="spinner-circle"></div>
      </div>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xlarge']),
  color: PropTypes.oneOf(['primary', 'secondary', 'light', 'dark', 'white']),
  fullPage: PropTypes.bool,
  className: PropTypes.string,
  overlay: PropTypes.bool,
  text: PropTypes.string
};

export default LoadingSpinner;