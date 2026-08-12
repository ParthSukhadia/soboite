import React from 'react';
import {
  AbsoluteFill,
  Img,
  Audio,
  Video,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface RestaurantStoryProps {
  restaurantName: string;
  area: string;
  cuisine?: string;
  rating: number;
  imageUrl: string;
  videoUrl?: string;
  logoUrl?: string;
  musicFile?: string;
  mediaType?: 'image' | 'video';
}

export const RestaurantStory: React.FC<RestaurantStoryProps> = ({
  restaurantName,
  area,
  cuisine,
  rating,
  imageUrl,
  videoUrl,
  logoUrl,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  // Slow zoom on background image from frame 0 to end (210 frames = 7s)
  const scale = interpolate(frame, [0, 210], [1, 1.15], {
    extrapolateRight: 'clamp',
  });

  // Fade in for the hero elements starting at frame 30 (1 second in)
  const contentOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slide up for the restaurant name
  const nameTranslateY = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12 },
  });
  const nameY = interpolate(nameTranslateY, [0, 1], [50, 0]);

  // Slide up for the location/rating starting at frame 90 (3 seconds in)
  const detailsOpacity = interpolate(frame, [90, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const detailsTranslateY = spring({
    frame: frame - 90,
    fps,
    config: { damping: 12 },
  });
  const detailsY = interpolate(detailsTranslateY, [0, 1], [30, 0]);

  // Outtro sequence starting at frame 150 (5 seconds in)
  const infoOpacityOut = interpolate(frame, [140, 155], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outtroOpacity = interpolate(frame, [155, 170], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outtroTranslateY = spring({
    frame: frame - 155,
    fps,
    config: { damping: 12 },
  });
  const outtroY = interpolate(outtroTranslateY, [0, 1], [30, 0]);

  // Audio volume interpolation (Fade in: 0-30, Fade out: 180-210)
  const audioVolume = interpolate(
    frame,
    [0, 30, 180, 210],
    [0, 0.6, 0.6, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f11' }}>
      {musicFile && <Audio src={staticFile(musicFile)} volume={audioVolume} />}
      {/* Background Image/Video with blur to fill 9:16 aspect ratio */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {videoUrl ? (
          <Video
            src={videoUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.3)',
              transform: `scale(1.2)`,
            }}
            muted
          />
        ) : (
          <Img
            src={imageUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.3)',
              transform: `scale(1.2)`,
            }}
          />
        )}
        
        {/* Main Hero Image / Video */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '75%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          borderRadius: '0 0 64px 64px',
          margin: 0,
          boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05)'
        }}>
          {videoUrl ? (
            <Video
              src={videoUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              muted
            />
          ) : (
            <Img
              src={imageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${scale})`,
              }}
            />
          )}
        </div>
      </AbsoluteFill>

      {/* Content Overlay - strictly bottom 25% */}
      <AbsoluteFill style={{ top: '75%', height: '25%', padding: '0 48px' }}>
        
        {/* Info Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: '100%',
            opacity: infoOpacityOut,
          }}
        >
          <div style={{
             opacity: contentOpacity,
             transform: `translateY(${nameY}px)`,
          }}>
            <h1
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '84px',
                fontWeight: 800,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.05,
                textShadow: '0 4px 16px rgba(0,0,0,0.6)',
                letterSpacing: '-0.02em',
                // Truncate if too long
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {restaurantName}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
              <span style={{ fontSize: '38px' }}>📍</span>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '44px',
                  fontWeight: 500,
                  color: '#d1d5db', // gray-300
                  textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                }}
              >
                {area}
              </span>
            </div>
          </div>

          <div
            style={{
              opacity: detailsOpacity,
              transform: `translateY(${detailsY}px)`,
              marginTop: '36px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px)',
                padding: '16px 32px',
                borderRadius: '100px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}
            >
              <span style={{ fontSize: '40px', color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.4)' }}>★</span>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '40px',
                  fontWeight: 700,
                  color: '#ffffff',
                }}
              >
                {rating.toFixed(1)}/5
              </span>
            </div>

            {cuisine && (
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(12px)',
                  padding: '16px 32px',
                  borderRadius: '100px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '36px',
                    fontWeight: 600,
                    color: '#e5e7eb',
                  }}
                >
                  {cuisine}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Outtro Section */}
        <div
          style={{
            opacity: outtroOpacity,
            transform: `translateY(${outtroY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
          }}
        >
          {logoUrl ? (
            <Img
              src={logoUrl}
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '28px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          ) : (
            <div
              style={{
                width: '100px',
                height: '100px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '64px',
                fontWeight: '900',
                color: '#000',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              S
            </div>
          )}
          
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '40px',
              fontWeight: 500,
              color: '#ffffff',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              opacity: 0.9,
            }}
          >
            See the full review on Soboite →
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
