import { RestaurantStoryProps } from '../remotion/RestaurantStory';

/**
 * Handles the automated generation of an MP4 Story from Restaurant data.
 * 
 * IMPORTANT: RENDERING ARCHITECTURE
 * ---------------------------------
 * Because the backend is running on Cloudflare Workers, which cannot run headless Chrome 
 * (required by Remotion to record WebGL/Canvas to MP4), you must deploy a separate rendering service.
 * 
 * RECOMMENDED SETUP:
 * 1. Deploy an AWS Lambda function using `@remotion/lambda`.
 * 2. Update this function to make an HTTP POST to your Lambda URL with the `props`.
 * 3. The Lambda function will render the MP4 and save it to an S3 bucket.
 * 4. This function should poll the Lambda status endpoint until the render is complete.
 * 5. Finally, return the S3 URL of the generated `.mp4` file.
 * 
 * Alternative: Run a dedicated Node.js Express server with `@remotion/renderer`.
 * 
 * @param props The restaurant data to inject into the Story template
 * @returns A promise that resolves to the URL of the generated MP4 file
 */
export async function generateStoryVideo(props: any): Promise<string> {
  console.log('Generating video with props:', props);
  
  try {
    const response = await fetch('/api/render-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(props),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Failed to render video');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return url;
  } catch (error) {
    console.error('Error rendering video:', error);
    throw error;
  }
}
