import { useEffect, useState, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/autoplay";
import { Pagination, Autoplay } from "swiper/modules";
import "../styles/Testimonial.css";

// Import default images with absolute paths from public directory
const defaultUser = "/assets/users/default-user.jpg";
const defaultLogo = "/assets/logos/default-logo.svg";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;
const CACHE_KEY = "cachedTestimonials";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
    try {
      // Check for valid cached data first
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          await preloadImages(data.map(t => t.image));
          setTestimonials(data);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`${BASE_URL}/api/testimonials`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      const shuffledTestimonials = [...data]
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);

      const processedTestimonials = shuffledTestimonials.map(testimonial => ({
        ...testimonial,
        image: testimonial.image 
          ? `/assets/users/${testimonial.image}`
          : defaultUser,
        socialMedia: testimonial.socialMedia ? {
          ...testimonial.socialMedia,
          logo: testimonial.socialMedia.logo
            ? `/assets/logos/${testimonial.socialMedia.logo}`
            : defaultLogo
        } : null
      }));

      // Preload all images
      const imageUrls = processedTestimonials.reduce((acc, t) => {
        acc.push(t.image);
        if (t.socialMedia) acc.push(t.socialMedia.logo);
        return acc;
      }, []);

      await preloadImages(imageUrls);

      // Cache with timestamp
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: processedTestimonials,
        timestamp: Date.now()
      }));

      setTestimonials(processedTestimonials);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      setError(error.message);
      // Fallback to empty array to prevent UI breakage
      setTestimonials([]);
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
        {[...Array(8)].map((_, index) => (
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
        <button 
          className="testimonial-section-retry-button"
          onClick={fetchTestimonials}
        >
          Try Again
        </button>
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
        loop={true}
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true
        }}
        className="testimonial-section-swiper-container"
      >
        {testimonials.map((testimonial, index) => (
          <SwiperSlide key={index} className="testimonial-section-slide">
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
                {testimonial.socialMedia && (
                  <div className="testimonial-section-media-platform">
                    <img
                      src={testimonial.socialMedia.logo}
                      alt={testimonial.socialMedia.platform}
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
                &ldquo;{testimonial.testimonial}&rdquo;
              </p>
             
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );

  if (loading) return renderSkeletonLoader();
  if (error) return renderErrorState();
  return renderTestimonials();
};

export default Testimonial;