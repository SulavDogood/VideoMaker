import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";

// Initialize Replicate with API key from environment
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    // Get the prompt and image from the request body
    const { prompt, image } = await request.json();
    
    if (!prompt || !image) {
      return NextResponse.json(
        { error: "Prompt and image are required" },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "API token not configured" },
        { status: 500 }
      );
    }

    console.log("Starting video generation with prompt:", prompt);
    console.log("Image data received:", image.substring(0, 50) + "...");

    // Get the base URL for webhook
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const webhookUrl = `${protocol}://${host}/api/webhook`;

    // Start the prediction with webhook
    const prediction = await replicate.predictions.create({
      version: "wavespeedai/wan-2.1-i2v-720p",
      input: {
        image: image,
        prompt: prompt,
        max_area: "720x1280",
        fast_mode: "Balanced",
        lora_scale: 1,
        num_frames: 81,
        sample_shift: 5,
        sample_steps: 30,
        frames_per_second: 16,
        sample_guide_scale: 5
      },
      webhook: webhookUrl,
      webhook_events_filter: ["completed"]
    });

    console.log("Prediction started with ID:", prediction.id);
    
    // Return the prediction ID immediately
    return NextResponse.json({ 
      success: true, 
      predictionId: prediction.id,
      status: prediction.status,
      prompt: prompt 
    });

  } catch (error) {
    console.error("Error starting video generation:", error);
    return NextResponse.json(
      { error: "Failed to start video generation" },
      { status: 500 }
    );
  }
} 