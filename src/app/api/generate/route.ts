import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";

// Initialize Replicate with API key from environment
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function handleReadableStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  // Combine all chunks into a single buffer
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Convert buffer to base64
  return Buffer.from(buffer).toString('base64');
}

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

    console.log("Generating video with prompt:", prompt);
    console.log("Image data received:", image.substring(0, 50) + "..."); // Log first 50 chars of image data

    // Run the video generation model with the new model and parameters
    const output = await replicate.run(
      "wavespeedai/wan-2.1-i2v-720p",
      {
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
      }
    );

    console.log("Generation complete:", output);
    
    // Handle different types of responses
    let videoUrl: string;
    
    if (typeof output === 'string') {
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      videoUrl = output[0];
    } else if (output instanceof ReadableStream) {
      // Handle ReadableStream response
      const base64Data = await handleReadableStream(output);
      videoUrl = `data:video/mp4;base64,${base64Data}`;
    } else {
      console.error("Unexpected output format:", output);
      return NextResponse.json({ 
        error: "Unexpected response format from AI model",
        debug: JSON.stringify(output)
      }, { status: 500 });
    }

    // Return the generated video URL
    return NextResponse.json({ 
      success: true, 
      videoUrl: videoUrl,
      prompt: prompt 
    });

  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 }
    );
  }
} 