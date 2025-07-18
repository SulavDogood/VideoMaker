"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const convertHeicToJpeg = async (): Promise<File> => {
    // For now, we'll just show an error for HEIC files
    throw new Error("HEIC format is not supported. Please convert your image to JPEG or PNG format.");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const fileType = file.type.toLowerCase();
    if (fileType === 'image/heic' || fileType === 'image/heif') {
      try {
        await convertHeicToJpeg();
        handleFile(file);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Error processing image");
        return;
      }
    } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
      alert("Please upload a JPEG, PNG, or WebP image");
      return;
    } else {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const downloadVideo = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = "generated-video.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      console.error('Error downloading video:', downloadError);
      alert('Failed to download video');
    }
  };

  const startPolling = (id: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Start polling every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/status?id=${id}`);
        const data = await response.json();

        if (data.error) {
          console.error("Status check error:", data.error);
          return;
        }

        setStatus(data.status);

        if (data.status === "succeeded" && data.output) {
          // Video generation completed
          setVideoUrl(data.output);
          setResult(`Video generated successfully for: "${prompt}"`);
          setIsLoading(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (data.status === "failed") {
          // Video generation failed
          setResult(`Error: ${data.error || 'Video generation failed'}`);
          setIsLoading(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        // If status is "starting" or "processing", continue polling
      } catch (error) {
        console.error("Error checking status:", error);
      }
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !uploadedImage) return;

    setIsLoading(true);
    setResult("");
    setVideoUrl("");
    setStatus("starting");

    try {
      // Ensure the image is in the correct format
      const imageData = uploadedImage.startsWith('data:') 
        ? uploadedImage 
        : `data:image/jpeg;base64,${uploadedImage}`;

      console.log("Sending image data:", imageData.substring(0, 50) + "...");

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          image: imageData 
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.predictionId) {
          // Production mode: Use polling
          setStatus(data.status);
          setResult(`Video generation started for: "${prompt}"`);
          
          // Start polling for status
          startPolling(data.predictionId);
        } else if (data.videoUrl) {
          // Development mode: Direct result
          setVideoUrl(data.videoUrl);
          setResult(`Video generated successfully for: "${prompt}"`);
          setIsLoading(false);
        } else {
          setResult(`Error: Unexpected response format`);
          setIsLoading(false);
        }
      } else {
        setResult(`Error: ${data.error || 'Failed to start video generation'}`);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setResult("Error starting video generation. Please try again.");
      setIsLoading(false);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case "starting":
        return "Starting video generation...";
      case "processing":
        return "Processing video (this may take 2-5 minutes)...";
      case "succeeded":
        return "Video generation completed!";
      case "failed":
        return "Video generation failed";
      default:
        return "Initializing...";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            AI Video Generator
          </h1>
          <p className="text-lg text-gray-600">
            Upload an image and enter your prompt to create an amazing video
          </p>
        </div>

        {/* Image Upload and Prompt Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Upload Base Image
              </label>
              <div 
                onClick={triggerFileInput}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                {uploadedImage ? (
                  <div className="relative w-full h-48">
                    <Image
                      src={uploadedImage}
                      alt="Uploaded image"
                      fill
                      className="object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Click to upload an image
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Your Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to generate..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 text-gray-700"
                disabled={isLoading}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !prompt.trim() || !uploadedImage}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{getStatusMessage()}</span>
                </>
              ) : (
                <span>Generate Video</span>
              )}
            </button>
          </form>
        </div>

        {/* Display Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Generated Content</h2>
          
          {result ? (
            <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-blue-500">
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{result}</p>
              
              {/* Display both uploaded image and generated video */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Uploaded Image */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-700">Uploaded Image</h3>
                  <div className="relative w-full aspect-video">
                    <Image
                      src={uploadedImage || ''}
                      alt="Uploaded image"
                      fill
                      className="object-contain rounded-lg"
                    />
                  </div>
                </div>

                {/* Generated Video */}
                {videoUrl && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-700">Generated Video</h3>
                    <div className="relative w-full aspect-video">
                      <video 
                        src={videoUrl} 
                        controls
                        className="w-full h-full rounded-lg"
                      />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={downloadVideo}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center space-x-2 shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download Video</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">
                Upload an image and enter a prompt above to generate a video
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
