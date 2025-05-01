import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

// Spinning Animation
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Styled Components
const SpinnerContainer = styled.div`
  display: inline-block;
  position: relative;
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
`;

const SpinnerInner = styled.div`
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: ${(props) => props.size * 0.8}px;
  height: ${(props) => props.size * 0.8}px;
  margin: ${(props) => props.size * 0.1}px;
  border: ${(props) => props.size * 0.1}px solid ${(props) => props.color};
  border-radius: 50%;
  animation: ${spin} 1.2s linear infinite;
  border-color: ${(props) => props.color} transparent transparent transparent;
`;

// Loading Spinner Component
const LoadingSpinner = ({ size = 50, color = "#3498db" }) => {
  return (
    <SpinnerContainer
      size={size}
      role="status"
      aria-label="Loading"
    >
      <SpinnerInner size={size} color={color} />
    </SpinnerContainer>
  );
};

// Prop Type Validation
LoadingSpinner.propTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
};

export default LoadingSpinner;