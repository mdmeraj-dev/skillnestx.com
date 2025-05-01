import PropTypes from "prop-types";

const LazySwiperSlide = ({ course, onClick }) => {
  return (
    <div className="swiper-slide" onClick={onClick}>
      <img src={course.image} alt={course.title} />
      <h3>{course.title}</h3>
    </div>
  );
};

// Add PropTypes validation
LazySwiperSlide.propTypes = {
  course: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
};

export default LazySwiperSlide;