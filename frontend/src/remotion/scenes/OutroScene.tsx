import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface OutroSceneProps {
  logoUrl?: string;
  image: string; // Background image
}

export const OutroScene: React.FC<OutroSceneProps> = ({ logoUrl, image }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.05], {
    extrapolateRight: 'clamp',
  });

  const contentOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const contentY = interpolate(spring({ frame: frame - 5, fps, config: { damping: 14 } }), [0, 1], [30, 0]);

  const sceneOpacity = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f11', opacity: sceneOpacity }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {image ? (
          <Img
            src={image}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale})`,
              filter: 'brightness(0.2) blur(20px)',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#27272a' }} />
        )}
      </AbsoluteFill>
      
      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '32px' }}>
        <div
          style={{
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '32px',
          }}
        >
          {logoUrl ? (
            <Img
              src={logoUrl}
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '40px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          ) : (
            <div
              style={{
                width: '180px',
                height: '180px',
                backgroundColor: '#ffffff',
                borderRadius: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontSize: '100px', fontWeight: 900, color: '#0f0f11', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>
                S
              </span>
            </div>
          )}

          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '56px',
              fontWeight: 900,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '0.05em',
            }}
          >
            SOBOITE
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '36px',
              fontWeight: 500,
              color: '#9ca3af',
              margin: 0,
            }}
          >
            South Mumbai's Veg Food Guide
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
