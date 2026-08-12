import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface DishSceneProps {
  rank?: number;
  name: string;
  rating: number;
  price: number;
  image: string;
  proText?: string;
}

export const DishScene: React.FC<DishSceneProps> = ({
  rank,
  name,
  rating,
  price,
  image,
  proText,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateRight: 'clamp',
  });

  const contentOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const contentY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 14 } }), [0, 1], [40, 0]);

  const proOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const proY = interpolate(spring({ frame: frame - 30, fps, config: { damping: 14 } }), [0, 1], [30, 0]);

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
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : ''}{name}
          </h2>

          <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
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
              <span style={{ fontSize: '36px', color: '#fbbf24' }}>★</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '36px', fontWeight: 700, color: '#ffffff' }}>
                {rating.toFixed(1)}/5
              </span>
            </div>
            
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              padding: '16px 32px',
              borderRadius: '100px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '36px', fontWeight: 600, color: '#10b981' }}>
                ₹{price}
              </span>
            </div>
          </div>
        </div>

        {proText && (
          <div style={{ opacity: proOpacity, transform: `translateY(${proY}px)`, marginTop: '40px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '44px',
              fontWeight: 500,
              color: '#d1d5db',
              margin: 0,
              lineHeight: 1.4,
              fontStyle: 'italic',
              borderLeft: '6px solid #fbbf24',
              paddingLeft: '24px',
            }}>
              "{proText}"
            </p>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
