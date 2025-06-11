import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";

// Initialize Replicate with API key from environment
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    // Get the prompt from the request body
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "API token not configured" },
        { status: 500 }
      );
    }

    console.log("Generating image with prompt:", prompt);

    // Use your working fine-tuned model with version hash
    const output = await replicate.run(
      "sulavdogood/mars-sulav-fine-tuned-model:728f4d4686df69c91a87be97c3756cf975e9dc7c3c75ae38176734b22bf74db4",
      {
        input: {
          model: "dev",
          prompt: prompt,
          go_fast: false,
          lora_scale: 1,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          guidance_scale: 3,
          output_quality: 80,
          prompt_strength: 0.8,
          extra_lora_scale: 1,
          num_inference_steps: 28,
        },
      }
    );

    console.log("Generation complete:", output);
    console.log("Output type:", typeof output);
    console.log("Is array:", Array.isArray(output));
    
    // Your fine-tuned model should return an array of URLs
    let imageUrl: string;
    
    if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      
      if (typeof firstOutput === 'string') {
        // Handle URL string in array (most likely for your model)
        imageUrl = firstOutput;
        console.log("Got image URL from array:", imageUrl);
      } else if (firstOutput && typeof firstOutput === 'object' && 'getReader' in firstOutput) {
        // Handle ReadableStream inside array (fallback)
        console.log("Handling ReadableStream from array");
        const reader = (firstOutput as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        // Combine all chunks into a single buffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const imageBuffer = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          imageBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Convert to base64 data URL
        const base64String = Buffer.from(imageBuffer).toString('base64');
        imageUrl = `data:image/webp;base64,${base64String}`;
        console.log("Generated base64 image data URL from stream");
      } else {
        console.error("Unexpected first array element:", firstOutput);
        return NextResponse.json({ 
          error: "Unexpected first array element format",
          debug: JSON.stringify(firstOutput)
        }, { status: 500 });
      }
    } else if (typeof output === 'string') {
      // Handle direct string URL
      imageUrl = output;
      console.log("Got direct image URL:", imageUrl);
    } else {
      console.error("Unexpected output format:", output);
      console.error("Raw output:", JSON.stringify(output, null, 2));
      return NextResponse.json({ 
        error: "Unexpected response format from AI model",
        debug: JSON.stringify(output)
      }, { status: 500 });
    }

    // Return the generated image URL
    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl,
      prompt: prompt 
    });

  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
} 