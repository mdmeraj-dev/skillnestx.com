import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/HeroSection.css";

const StarFieldCanvas = ({ side }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    // Responsive canvas size
    const updateCanvasSize = () => {
      const isMobile = window.innerWidth < 768;
      canvas.width = isMobile ? 100 : 200;
      canvas.height = isMobile ? 300 : 400;
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    // Star array
    const stars = [];
    const maxStars = 20; // Fewer stars for subtlety

    // Initialize star
    const initStar = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 1 + Math.random() * 1.5, // Small stars, radius 1 to 2.5
      opacity: 0.3 + Math.random() * 0.4, // Base opacity 0.3 to 0.7
      twinkleSpeed: 0.005 + Math.random() * 0.01, // Slow twinkle
      phase: Math.random() * Math.PI * 2, // Random phase for twinkle
    });

    // Populate stars
    for (let i = 0; i < maxStars; i++) {
      stars.push(initStar());
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach((star) => {
        // Twinkle effect
        const twinkle = 0.3 + Math.sin(star.phase + performance.now() * star.twinkleSpeed) * 0.2;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`; // White for star-like effect
        ctx.fill();
        ctx.closePath();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [side]);

  return <canvas ref={canvasRef} className={`starfield-canvas ${side}`} />;
};

const CodeWaveCanvas = ({ side }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    // Responsive canvas size
    const updateCanvasSize = () => {
      const isMobile = window.innerWidth < 768;
      canvas.width = isMobile ? 100 : 200;
      canvas.height = isMobile ? 300 : 400;
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    // Expanded code snippets array with keywords and constructs from multiple languages
    const codeSnippets = [
      // JavaScript
      "if", "else", "for", "while", "function", "=>", "==", "const", "let", "async", "await", "try", "catch",
      // HTML
      "<div>", "<p>", "<a>", "<img>", "<h1>", "<html>", "<body>", "<head>",
      // CSS
      "display", "flex", "grid", "margin", "padding", "color", "font-size", ":hover",
      // React
      "useState", "useEffect", "props", "state", "render", "component", "JSX", "hooks",
      // Node.js
      "require", "module", "exports", "app.get", "app.post", "express", "npm", "server",
      // Angular
      "ngIf", "ngFor", "component", "directive", "@Input", "@Output", "template", "module",
      // Python
      "print()", "def", "class", "import", "from", "return", "lambda", "with",
      // C++
      "int", "void", "class", "public", "private", "return", "#include", "std::",
      // Machine Learning (Python-related)
      "fit()", "predict()", "model", "train", "test", "numpy", "pandas", "sklearn"
    ];
    const snippets = [];
    const maxSnippets = 15;

    // Initialize code snippet
    const initSnippet = () => ({
      x: 0, // Spawn at left
      y: Math.random() * canvas.height,
      value: codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
      speed: Math.random() * 1 + 0.5, // Speed range: 0.5 to 1.5
      opacity: 0, // Start transparent
      fadeIn: true, // Fading in or out
    });

    // Populate initial snippets
    for (let i = 0; i < maxSnippets; i++) {
      snippets.push(initSnippet());
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${canvas.width * 0.08}px monospace`;
      ctx.fillStyle = "rgba(255, 165, 0, "; // Orange for contrast

      snippets.forEach((snippet, index) => {
        // Update opacity for fade effect
        if (snippet.fadeIn) {
          snippet.opacity += 0.01;
          if (snippet.opacity >= 1) snippet.fadeIn = false;
        } else {
          snippet.opacity -= 0.005;
        }

        // Draw code snippet
        ctx.fillStyle = `rgba(255, 165, 0, ${snippet.opacity})`;
        ctx.fillText(snippet.value, snippet.x, snippet.y);

        // Update position
        snippet.x += snippet.speed; // Move rightward

        // Reset snippet when it fades out or moves off-screen
        if (snippet.opacity <= 0 || snippet.x > canvas.width) {
          snippets[index] = initSnippet();
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [side]);

  return <canvas ref={canvasRef} className={`codewave-canvas ${side}`} />;
};

const HeroSection = ({ auth }) => {
  const [greeting, setGreeting] = useState("");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [userName, setUserName] = useState("User");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const messages = [
    "Elevate Your Skills. Ignite Your Future.",
    "Master the Code. Accelerate Your Journey.",
    "Learn Smarter. Grow Faster.",
    "Code with Confidence. Advance with Purpose.",
    "Build Expertise. Unlock Opportunities.",
    "From Basics to Brilliance. Your CS Journey Starts Here.",
    "Fuel Your Passion. Forge Your Career.",
    "Your Path to Mastery. Your Gateway to Success.",
    "Upgrade Your Mindset. Transform Your Career.",
    "Code the Future. Shape Your Destiny.",
    "Empower Your Career. Enroll in Excellence.",
    "Learn Today. Lead Tomorrow.",
    "Crack the Code. Unlock Endless Possibilities.",
    "Join the Coding Revolution. Enroll Now.",
    "Skills That Shine. Courses That Inspire.",
    "Program Your Success. Start Your Journey Today.",
    "Built by Experts. Designed for Your Success.",
    "Become the Developer Companies Fight to Hire.",
    "The Smartest Investment You'll Make is in Yourself.",
    "Future-Proof Your Career with In-Demand Skills.",
    "Debug Your Doubts. Deploy Your Dreams.",
    "One Course Away from Your Breakthrough.",
    "The Code to Your Success Starts Here.",
  ];

  // Track window size for mobile vs. desktop
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch user name when authenticated
  useEffect(() => {
    const fetchUserName = async () => {
      if (auth.isAuthenticated && auth.user?._id) {
        const traceId = crypto.randomUUID();
        try {
          const response = await axios.get(
            `${
              import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
            }/api/users/current`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                "X-Trace-Id": traceId,
              },
            }
          );
          if (response.data.success && response.data.user.name) {
            setUserName(response.data.user.name);
          } else {
            setUserName("User");
          }
        } catch (error) {
          console.error("Error fetching user name:", error.message);
          setUserName("User");
        }
      } else {
        setUserName("Dear");
      }
    };

    fetchUserName();
  }, [auth.isAuthenticated, auth.user]);

  // Dynamic Greeting and Message based on time of day
  useEffect(() => {
    const updateGreetingAndMessage = () => {
      const now = new Date();
      const hours = now.getHours();
      let greetingText;

      // Determine greeting and select a random message index for each greeting period
      if (hours < 6) {
        greetingText = "Good Night";
        setCurrentMessageIndex(Math.floor(Math.random() * messages.length));
      } else if (hours < 12) {
        greetingText = "Good Morning";
        setCurrentMessageIndex(Math.floor(Math.random() * messages.length));
      } else if (hours < 18) {
        greetingText = "Good Afternoon";
        setCurrentMessageIndex(Math.floor(Math.random() * messages.length));
      } else {
        greetingText = "Good Evening";
        setCurrentMessageIndex(Math.floor(Math.random() * messages.length));
      }

      const displayName = isMobile ? userName.split(" ")[0] : userName;
      setGreeting(`${greetingText}, ${displayName}`);
    };

    updateGreetingAndMessage();
    const interval = setInterval(updateGreetingAndMessage, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [userName, isMobile, messages.length]);

  return (
    <section className="hero-section relative flex justify-between items-center">
      <StarFieldCanvas side="left" />
      <div className="text-center">
        <div className="greeting">
          <h1>{greeting}</h1>
        </div>
        <div className="inspiration">
          <p>{messages[currentMessageIndex]}</p>
        </div>
      </div>
      <CodeWaveCanvas side="right" />
    </section>
  );
};

export default HeroSection;