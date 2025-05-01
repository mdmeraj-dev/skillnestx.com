// File: /lib/paymentUtils.js
import { v4 as uuidv4 } from "uuid";

// Validate plan and price against your database
export const validatePlanAndPrice = (plan, price) => {
  // Replace this with your actual validation logic
  const validPlans = {
    "Premium Plan": 2999.99,
    "Pro Plan": 1999.99,
    "Basic Plan": 999.99,
  };

  return validPlans[plan] === parseFloat(price.replace(/[^0-9.]/g, ""));
};

// Generate a unique plan ID (e.g., UUID)
export const generatePlanId = () => {
  return uuidv4();
};

// Validate the plan ID (e.g., check if it exists in your database)
export const isValidPlanId = (planId) => {
  // Replace this with your actual validation logic
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    planId
  );
};