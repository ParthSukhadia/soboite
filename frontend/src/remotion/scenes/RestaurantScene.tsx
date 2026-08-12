import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface RestaurantSceneProps {
  restaurantName: string;
  area: string;
  cuisine: string;
  rating: number;
  image: string;
}

export const RestaurantScene: React.FC<RestaurantSceneProps> = ({
  restaurantName,
  area,
  cuisine,
  rating,
  image,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1.1, 1], {
    extrapolateRight: 'clamp',
  });

  const contentOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const contentY = interpolate(spring({ frame: frame - 5, fps, config: { damping: 14 } }), [0, 1], [40, 0]);

  const sceneOpacity = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });

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
        
        {/* Dark fade from bottom for text readability */}
        <AbsoluteFill
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 100%)',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ top: '50%', height: '50%', padding: '0 64px', justifyContent: 'center' }}>
        <div style={{ opacity: contentOpacity, transform: `translateY(${contentY}px)` }}>
          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '84px',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {restaurantName}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
            <span style={{ fontSize: '38px' }}>📍</span>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '44px',
                fontWeight: 500,
                color: '#d1d5db',
              }}
            >
              {area}
            </span>
          </div>

          <div style={{ marginTop: '36px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              padding: '16px 32px',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}>
              <span style={{ fontSize: '40px', color: '#fbbf24' }}>★</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '40px', fontWeight: 700, color: '#ffffff' }}>
                {rating.toFixed(1)}/5
              </span>
            </div>
            {cuisine && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                padding: '16px 32px',
                borderRadius: '100px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '36px', fontWeight: 600, color: '#e5e7eb' }}>
                  {cuisine} • VEG
                </span>
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
