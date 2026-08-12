import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface VerdictSceneProps {
  verdictTitle: string;
  verdictText: string;
  image: string;
}

export const VerdictScene: React.FC<VerdictSceneProps> = ({ verdictTitle, verdictText, image }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1.05, 1], {
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const textOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const titleY = interpolate(spring({ frame: frame - 5, fps, config: { damping: 14 } }), [0, 1], [30, 0]);
  const textY = interpolate(spring({ frame: frame - 15, fps, config: { damping: 14 } }), [0, 1], [30, 0]);

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
              filter: 'brightness(0.3) contrast(1.1)',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#27272a' }} />
        )}
      </AbsoluteFill>
      
      <AbsoluteFill style={{ padding: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '32px' }}>
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '24px 48px',
            borderRadius: '100px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '48px',
              fontWeight: 600,
              color: '#d1d5db',
              margin: 0,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            {verdictTitle}
          </h2>
        </div>

        <div
          style={{
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '100px',
              fontWeight: 900,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.1,
              textShadow: '0 10px 40px rgba(0,0,0,0.8)',
              letterSpacing: '-0.02em',
            }}
          >
            {verdictText}
          </h1>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
