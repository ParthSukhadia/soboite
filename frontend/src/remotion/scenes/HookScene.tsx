import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface HookSceneProps {
  hookText: string;
  image: string;
}

export const HookScene: React.FC<HookSceneProps> = ({ hookText, image }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateRight: 'clamp',
  });

  const textOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textTranslateY = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12 },
  });
  const textY = interpolate(textTranslateY, [0, 1], [50, 0]);


  const sceneOpacity = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });

  // Split hook text by words or handle it as a single block
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f11', opacity: sceneOpacity }}>
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0f0f11' }}>
        {image && typeof image === 'string' && image.trim() !== '' && image !== 'undefined' && image !== 'null' ? (
          <Img
            src={image}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale})`,
            }}
          />
        ) : null}
        {/* Black fade overlay for text readability */}
        <AbsoluteFill
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)',
          }}
        />
      </AbsoluteFill>
      
      <AbsoluteFill style={{ padding: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
              fontSize: '110px',
              fontWeight: 900,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.1,
              textShadow: '0 10px 40px rgba(0,0,0,0.8)',
              letterSpacing: '-0.02em',
            }}
          >
            {hookText}
          </h1>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
