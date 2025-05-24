import PropTypes from "prop-types";

const TimerComponent = ({ days, hours, minutes, seconds }) => {
  return (
    <div className="countdown-container">
      <p className="timer-label">Offer Ends In:</p>
      <div className="timer-container">
        <div className="timer-box">
          <div className="timer-value">{days}</div>
          <div className="timer-unit">days</div>
        </div>
        <span>:</span>
        <div className="timer-box">
          <div className="timer-value">{String(hours).padStart(2, "0")}</div>
          <div className="timer-unit">hrs</div>
        </div>
        <span>:</span>
        <div className="timer-box">
          <div className="timer-value">{String(minutes).padStart(2, "0")}</div>
          <div className="timer-unit">mins</div>
        </div>
        <span>:</span>
        <div className="timer-box">
          <div className="timer-value">{String(seconds).padStart(2, "0")}</div>
          <div className="timer-unit">secs</div>
        </div>
      </div>
    </div>
  );
};
TimerComponent.propTypes = {
  days: PropTypes.number.isRequired,
  hours: PropTypes.number.isRequired,
  minutes: PropTypes.number.isRequired,
  seconds: PropTypes.number.isRequired,
};

export default TimerComponent;