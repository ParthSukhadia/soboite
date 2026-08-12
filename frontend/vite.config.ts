import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const remotionRenderPlugin = () => {
  return {
    name: 'remotion-render',
    configureServer(server: any) {
      server.middlewares.use('/api/render-story', (req: any, res: any) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const parsedBody = JSON.parse(body);
              const compositionId = parsedBody.compositionId || 'RestaurantStory';
              
              const propsPath = path.resolve('public/temp-props.json');
              fs.writeFileSync(propsPath, body);
              
              const outPath = path.resolve(`temp-story-${Date.now()}.mp4`);
              
              // Run remotion
              exec(`npx remotion render src/remotion/index.ts ${compositionId} ${outPath} --props=public/temp-props.json`, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
                if (err) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message, stderr }));
                  return;
                }
                
                // Stream the file back
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', 'attachment; filename="story.mp4"');
                
                const stream = fs.createReadStream(outPath);
                stream.pipe(res);
                
                stream.on('end', () => {
                  // Clean up the temp files
                  try {
                    fs.unlinkSync(outPath);
                    fs.unlinkSync(propsPath);
                  } catch (e) {}
                });
              });
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    remotionRenderPlugin(),
  ],
  define: {
    'process.env': {}
  },
  server: {
    port: 5175,
    host: '0.0.0.0', // Set to 0.0.0.0 to bind to all local IPs so you can access it via your phone.
  }
});
