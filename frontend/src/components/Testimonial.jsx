import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/autoplay";
import { Pagination, Autoplay } from "swiper/modules";
import "../styles/Testimonial.css";

// Import default images with absolute paths from public directory
const defaultUser = "/assets/users/default-user.jpg";
const defaultLogo = "/assets/logos/default-logo.svg";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const CACHE_KEY = "cachedTestimonials";
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

const Testimonial = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const preloadImages = useCallback((imageUrls) => {
    const promises = imageUrls.map((url) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    return Promise.all(promises);
  }, []);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check for valid cached data
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          await preloadImages(data.map(t => [t.image, t.platform?.logo]).flat().filter(Boolean));
          setTestimonials(data);
          setLoading(false);
          return;
        }
      }

      const response = await axios.get(`${BASE_URL}/api/testimonials`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });

      let data = response.data;
      // Handle different response formats
      if (data.success && Array.isArray(data.data)) {
        data = data.data;
      } else if (Array.isArray(data)) {
        data = data;
      } else {
        throw new Error("Invalid response format from server");
      }

      if (!data.length) {
        setTestimonials([]);
        setLoading(false);
        return;
      }

      const processedTestimonials = data.map((testimonial, index) => ({
        id: testimonial._id || `testimonial-${index}`,
        name: testimonial.userName || "Anonymous",
        role: testimonial.userRole || "User",
        testimonial: testimonial.content || "",
        image: testimonial.userImage || defaultUser,
        platform: testimonial.platform ? {
          name: testimonial.platform,
          logo: testimonial.platform
            ? `/assets/logos/${testimonial.platform.toLowerCase()}.svg`
            : defaultLogo
        } : null
      }));

      // Preload all images
      const imageUrls = processedTestimonials.reduce((acc, t) => {
        acc.push(t.image);
        if (t.platform) acc.push(t.platform.logo);
        return acc;
      }, []).filter(Boolean);

      await preloadImages(imageUrls);

      // Cache with timestamp
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: processedTestimonials,
        timestamp: Date.now()
      }));

      setTestimonials(processedTestimonials);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      setError(error.response?.data?.message || error.message || "Failed to fetch testimonials");
      setTestimonials([]);
      localStorage.removeItem(CACHE_KEY); // Clear cache on error
    } finally {
      setLoading(false);
    }
  }, [preloadImages]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const renderSkeletonLoader = () => (
    <div className="testimonial-section">
      <h2 className="testimonial-section-title">What People Say About Us</h2>
      <div className="testimonial-section-skeleton">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="testimonial-section-skeleton-card">
            <div className="testimonial-section-skeleton-header">
              <div className="testimonial-section-skeleton-user-image"></div>
              <div className="testimonial-section-skeleton-user-info">
                <div className="testimonial-section-skeleton-name"></div>
                <div className="testimonial-section-skeleton-role"></div>
              </div>
            </div>
            <div className="testimonial-section-skeleton-text"></div>
            <div className="testimonial-section-skeleton-text"></div>
            <div className="testimonial-section-skeleton-text-short"></div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="testimonial-section">
      <h2 className="testimonial-section-title">What People Say About Us</h2>
      <div className="testimonial-section-error">
        <p>Error: {error}</p>
        <button 
          className="testimonial-section-retry-button"
          onClick={fetchTestimonials}
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="testimonial-section">
      <h2 className="testimonial-section-title">What People Say About Us</h2>
      <div className="testimonial-section-empty">
        <p>No testimonials available at this time.</p>
      </div>
    </div>
  );

  const renderTestimonials = () => (
    <div className="testimonial-section">
      <h2 className="testimonial-section-title">What People Say About Us</h2>
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{
          clickable: true,
          bulletClass: 'testimonial-section-pagination-bullet',
          bulletActiveClass: 'testimonial-section-pagination-bullet-active'
        }}
        spaceBetween={32}
        slidesPerView={1}
        breakpoints={{
          480: { slidesPerView: 1, spaceBetween: 16 },
          768: { slidesPerView: 2, spaceBetween: 24 },
          1024: { slidesPerView: 2, spaceBetween: 40 },
          1920: { slidesPerView: 3, spaceBetween: 32 },
        }}
        loop={testimonials.length > 1} // Only loop if more than one testimonial
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true
        }}
        className="testimonial-section-swiper-container"
      >
        {testimonials.map((testimonial, index) => (
          <SwiperSlide key={testimonial.id || index} className="testimonial-section-slide">
            <div className="testimonial-section-content">
              <div className="testimonial-section-header">
                <div className="testimonial-section-user-info">
                  <div className="testimonial-section-user-image-container">
                    <img
                      src={testimonial.image}
                      alt={`${testimonial.name}'s profile`}
                      className="testimonial-section-user-image"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = defaultUser;
                        e.target.onerror = null;
                      }}
                    />
                  </div>
                  <div>
                    <h4 className="testimonial-section-user-name">{testimonial.name}</h4>
                    <p className="testimonial-section-user-role">{testimonial.role}</p>
                  </div>
                </div>
                {testimonial.platform && (
                  <div className="testimonial-section-media-platform">
                    <img
                      src={testimonial.platform.logo}
                      alt={`${testimonial.platform.name} logo`}
                      className="testimonial-section-platform-logo"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = defaultLogo;
                        e.target.onerror = null;
                      }}
                    />
                  </div>
                )}
              </div>
              <p className="testimonial-section-text">
                “{testimonial.testimonial}”
              </p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );

  if (loading) return renderSkeletonLoader();
  if (error) return renderErrorState();
  if (!testimonials.length) return renderEmptyState();
  return renderTestimonials();
};

export default Testimonial;