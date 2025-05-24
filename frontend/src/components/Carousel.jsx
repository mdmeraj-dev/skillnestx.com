import { useState, useEffect, useRef, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/autoplay";
import { Pagination, Autoplay } from "swiper/modules";
import { useNavigate } from "react-router-dom";
import "../styles/Carousel.css";

const CACHE_KEY = "featuredCourses";
const CACHE_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

const Carousel = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);
  const navigate = useNavigate();

  // Helper function to shuffle and slice courses
  const shuffleAndSlice = useCallback((coursesArray) => {
    return [...coursesArray]
      .sort(() => 0.5 - Math.random())
      .slice(0, 6);
  }, []);

  // Handle click on the course card
  const handleCourseClick = useCallback((course) => {
    navigate(`/course/${course._id}`, { state: { course } });
  }, [navigate]);

  // Fetch courses from backend or cache
  const fetchCourses = useCallback(async () => {
    try {
      // Check cache first
      const cachedData = localStorage.getItem(CACHE_KEY);
      const now = new Date().getTime();
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        
        // Use cached data if it's not expired
        if (now - timestamp < CACHE_EXPIRY) {
          const shuffledCourses = shuffleAndSlice(data);
          setCourses(shuffledCourses);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data if no cache or cache expired
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout after 5 seconds
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/courses`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      // Validate data
      if (!data.courses || !Array.isArray(data.courses)) {
        throw new Error("Invalid data format received from server");
      }

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: data.courses,
        timestamp: now
      }));

      const shuffledCourses = shuffleAndSlice(data.courses);
      setCourses(shuffledCourses);
      setError(null);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setError(error.message || "Failed to fetch courses. Please check your network connection.");
      
      // Try to use cached data even if expired when there's an error
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data } = JSON.parse(cachedData);
        const shuffledCourses = shuffleAndSlice(data);
        setCourses(shuffledCourses);
        setError(null); // Clear error since we have fallback data
      }
    } finally {
      setLoading(false);
    }
  }, [shuffleAndSlice]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Preload images for better user experience
  useEffect(() => {
    if (courses.length > 0) {
      courses.forEach(course => {
        const img = new Image();
        img.src = course.imageUrl || '/default-course-image.jpg';
      });
    }
  }, [courses]);

  // Render skeleton loader while loading
  if (loading) {
    return (
      <div className="featured-carousel">
        <h1 className="carousel-title">Featured Courses</h1>
        <div className="swiper-skeleton">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="swiper-slide-skeleton"></div>
          ))}
        </div>
      </div>
    );
  }

  // Render error message if there's an error and no cached data
  if (error && courses.length === 0) {
    return (
      <div className="featured-carousel">
        <h1 className="carousel-title">Featured Courses</h1>
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button 
            className="retry-button" 
            onClick={fetchCourses}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="featured-carousel">
      <h1 className="carousel-title">Featured Courses</h1>
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{
          clickable: true,
          dynamicBullets: false,
          el: ".custom-pagination",
        }}
        autoplay={{ delay: 1500, disableOnInteraction: false }}
        slidesPerView={1}
        spaceBetween={16}
        loop={courses.length >= 6}
        breakpoints={{
          480: { slidesPerView: 1, spaceBetween: 16 },
          768: { slidesPerView: 2, spaceBetween: 24 },
          1024: { slidesPerView: 3, spaceBetween: 32 },
          1920: { slidesPerView: 4, spaceBetween: 40 },
        }}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="swiper"
      >
        {courses.map((course, index) => (
          <SwiperSlide key={course._id || index}>
            <div
              className="course-card"
              onClick={() => handleCourseClick(course)}
              aria-label={`View ${course.title} course`}
            >
              <img
                src={course.imageUrl || '/default-course-image.jpg'}
                alt={course.title}
                loading="lazy"
                className="course-image"
                onError={(e) => {
                  e.target.src = '/default-course-image.jpg';
                }}
                width="300"
                height="200"
              />
              <h3 className="course-title">{course.title}</h3>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      {/* Custom pagination container */}
      <div className="custom-pagination">
        {[...Array(Math.min(6, courses.length))].map((_, index) => (
          <span
            key={index}
            className={`swiper-pagination-bullet ${
              index === 0 ? "swiper-pagination-bullet-active" : ""
            }`}
          ></span>
        ))}
      </div>
    </div>
  );
};

export default Carousel;