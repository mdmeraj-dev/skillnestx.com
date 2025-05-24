export const checkCourseAccess = async (userId, courseId, token, subscription) => {
  console.log(`[DEBUG] checkCourseAccess called: userId=${userId}, courseId=${courseId}, subscription=${JSON.stringify(subscription)}`);

  try {
    // Check if subscription is valid
    if (!subscription || subscription.status !== "active") {
      console.log("[DEBUG] No active subscription");
      return { hasAccess: false, message: "No active subscription. Please subscribe to access this course." };
    }

    // Check if course is included in subscription
    if (subscription.courses && subscription.courses.includes(courseId)) {
      console.log("[DEBUG] Course access granted via subscription");
      return { hasAccess: true, message: "Access granted." };
    }

    console.log("[DEBUG] Course not in subscription");
    return { hasAccess: false, message: "You don't have access to this course. Please subscribe or purchase." };
  } catch (error) {
    console.error("[DEBUG] Error in checkCourseAccess:", error.message);
    return { hasAccess: false, message: "Failed to verify course access. Please try again later." };
  }
};