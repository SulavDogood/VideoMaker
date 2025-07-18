import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";

// Initialize Replicate with API key from environment
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function handleReadableStream(stream: ReadableStream): Promise<string> {
  try {
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
    const base64Data = Buffer.from(buffer).toString('base64');
    console.log("Converted ReadableStream to base64, length:", base64Data.length);
    
    return `data:video/mp4;base64,${base64Data}`;
  } catch (error) {
    console.error("Error handling ReadableStream:", error);
    throw error;
  }
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

    console.log("Starting video generation with prompt:", prompt);
    console.log("Image data received:", image.substring(0, 50) + "...");

    // Check if we're in production (for webhook support)
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Production: Use webhooks
      const protocol = 'https';
      const host = request.headers.get('host') || 'your-domain.com';
      const webhookUrl = `${protocol}://${host}/api/webhook`;

      console.log("Using webhook URL:", webhookUrl);

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
      
      return NextResponse.json({ 
        success: true, 
        predictionId: prediction.id,
        status: prediction.status,
        prompt: prompt 
      });
    } else {
      // Development: Use synchronous approach (no webhooks)
      console.log("Development mode: Using synchronous approach");
      
      const output: unknown = await replicate.run(
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
      console.log("Output type:", typeof output);
      console.log("Output constructor:", output?.constructor?.name);
      
      // Handle different types of responses
      let videoUrl: string | undefined;
      
      if (typeof output === 'string') {
        console.log("String output received, length:", (output as string).length);
        videoUrl = output;
      } else if (Array.isArray(output) && (output as unknown[]).length > 0) {
        console.log("Array output received, first item:", typeof (output as unknown[])[0]);
        videoUrl = (output as unknown[])[0] as string;
      } else if (output && typeof output === 'object' && 'constructor' in output && (output as { constructor: { name: string } }).constructor.name === 'FileOutput') {
        console.log("FileOutput detected, treating as ReadableStream...");
        // Handle FileOutput as ReadableStream
        videoUrl = await handleReadableStream(output as unknown as ReadableStream);
      } else {
        console.error("Unexpected output format:", output);
        console.error("Output keys:", Object.keys(output || {}));
        return NextResponse.json({ 
          error: "Unexpected response format from AI model",
          debug: JSON.stringify(output)
        }, { status: 500 });
      }

      console.log("Final videoUrl type:", typeof videoUrl);
      console.log("Final videoUrl length:", typeof videoUrl === 'string' ? videoUrl.length : 'N/A');

      if (!videoUrl) {
        return NextResponse.json({ 
          error: "Failed to generate video URL",
          debug: "videoUrl is undefined"
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        videoUrl: videoUrl,
        prompt: prompt 
      });
    }

  } catch (error) {
    console.error("Error starting video generation:", error);
    return NextResponse.json(
      { error: "Failed to start video generation" },
      { status: 500 }
    );
  }
} 