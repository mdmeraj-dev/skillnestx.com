import PropTypes from 'prop-types';
import backIcon from '/assets/icons/back.svg';
import './styles/Subscription.css';

const Subscriptions = ({ onBack }) => {
  const subscription = {
    status: 'Active',
    expiryDate: '2023-12-31',
    planName: 'Premium Annual',
    price: '$99.99/year'
  };

  const handleRenew = () => {
    // Implement renewal logic
    alert('Redirecting to payment gateway for renewal...');
  };

  const handleCancel = () => {
    // Implement cancellation logic
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      alert('Subscription cancellation request received.');
    }
  };

  return (
    <div className="profile-subscriptions-container">
      <div className="profile-subscriptions-header">
        <button 
          className="subscription-back-button" 
          onClick={onBack} 
          aria-label="Go back to account settings"
        >
          <img src={backIcon} alt="Back" className="subscription-back-icon" />
        </button>
        <h2 className="profile-subscriptions-title">Subscription Details</h2>
      </div>

      <div className="profile-subscriptions-content">
        <div className="profile-subscription-card">
          <div className="profile-subscription-info">
            <div className="subscription-info-row">
              <span className="info-label">Plan Name:</span>
              <span className="info-value">{subscription.planName}</span>
            </div>
            <div className="subscription-info-row">
              <span className="info-label">Status:</span>
              <span className={`info-value status-${subscription.status.toLowerCase()}`}>
                {subscription.status}
              </span>
            </div>
            <div className="subscription-info-row">
              <span className="info-label">Expiry Date:</span>
              <span className="info-value">{subscription.expiryDate}</span>
            </div>
            <div className="subscription-info-row">
              <span className="info-label">Price:</span>
              <span className="info-value">{subscription.price}</span>
            </div>
          </div>

          <div className="profile-subscription-actions">
            <button 
              className="subscription-renew-button"
              onClick={handleRenew}
            >
              Renew Subscription
            </button>
            <button 
              className="subscription-cancel-button"
              onClick={handleCancel}
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Subscriptions.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default Subscriptions;