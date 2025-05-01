// File: /api/validate-payment.js
import { NextResponse } from "next/server";
import { validatePlanAndPrice, generatePlanId } from "@/lib/paymentUtils";

export async function POST(req) {
  try {
    const { plan, price } = await req.json();

    // Validate the plan and price against your database
    const isValid = validatePlanAndPrice(plan, price);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid payment details." },
        { status: 400 }
      );
    }

    // Generate a unique plan ID (e.g., UUID)
    const planId = generatePlanId();

    return NextResponse.json({ planId }, { status: 200 });
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}