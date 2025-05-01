// File: /api/generate-payment-link.js
import { NextResponse } from "next/server";
import { isValidPlanId } from "@/lib/paymentUtils";

export async function POST(req) {
  try {
    const { paymentMethod, amount, currency, planId } = await req.json();

    // Verify the plan ID
    if (!isValidPlanId(planId)) {
      return NextResponse.json(
        { error: "Invalid plan ID." },
        { status: 400 }
      );
    }

    // Generate a secure payment link based on the payment method
    let paymentLink = "";
    switch (paymentMethod) {
      case "GPay":
        paymentLink = `upi://pay?pa=your-upi-id@okicici&pn=YourName&am=${amount}&cu=${currency}`;
        break;
      case "PhonePe":
        paymentLink = `https://phon.pe/your-upi-id?am=${amount}`;
        break;
      case "Paytm":
        paymentLink = `https://paytm.com/pay?pa=your-upi-id@paytm&pn=YourName&am=${amount}&cu=${currency}`;
        break;
      case "PayPal":
        paymentLink = `https://www.paypal.com/paypalme/your-paypal-id/${amount}`;
        break;
      default:
        return NextResponse.json(
          { error: "Invalid payment method." },
          { status: 400 }
        );
    }

    return NextResponse.json({ paymentLink }, { status: 200 });
  } catch (error) {
    console.error("Payment link generation error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}