// src/context/cartContext.js
import { createContext, useState, useEffect } from "react";
import PropTypes from "prop-types"; // For prop validation

// Create the context
const CartContext = createContext();

// Create the provider component
const CartProvider = ({ children }) => {
  // Load cart from localStorage on initial render
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Add a course to the cart
  const addToCart = (course) => {
    setCart((prevCart) => {
      const existingCourse = prevCart.find((item) => item._id === course._id);
      if (existingCourse) {
        return prevCart; // Avoid adding duplicate courses
      }
      return [...prevCart, course];
    });
  };

  // Remove a course from the cart
  const removeFromCart = (courseId) => {
    setCart((prevCart) => prevCart.filter((item) => item._id !== courseId));
  };

  // Clear the entire cart
  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Add prop validation for `children`
CartProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { CartProvider, CartContext };