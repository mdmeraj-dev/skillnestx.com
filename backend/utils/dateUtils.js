import { logger } from "./logger.js";
import { randomUUID } from "crypto";

/**
 * Format a date to DD-MM-YYYY at HH:MM AM/PM
 * @param {Date|string} date - Date object or string to format
 * @returns {string} Formatted date string
 * @throws {Error} If date is invalid
 */
export const formatDate = (date) => {
  const traceId = randomUUID();
  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }

    const day = parsedDate.getDate().toString().padStart(2, "0");
    const month = (parsedDate.getMonth() + 1).toString().padStart(2, "0");
    const year = parsedDate.getFullYear();
    let hours = parsedDate.getHours();
    const minutes = parsedDate.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;

    return `${day}-${month}-${year} at ${hours}:${minutes} ${ampm}`;
  } catch (error) {
    logger.error(`Failed to format date: ${error.message}`, { traceId, stack: error.stack });
    throw error;
  }
};