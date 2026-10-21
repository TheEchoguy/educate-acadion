import React, { useState, useEffect } from 'react';
import { Image as KonvaImage, Rect, Text, Group } from 'react-konva';
import type { ImageCropDTO } from '../types/editor';

interface CanvasImageProps {
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  crop?: ImageCropDTO | null;
  onClick?: () => void;
  isSelected?: boolean;
}

export const CanvasImage: React.FC<CanvasImageProps> = ({
  url,
  x,
  y,
  width,
  height,
  rotation = 0,
  crop,
  onClick,
}) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!url) return;

    let isMounted = true;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      if (isMounted) {
        setImageObj(img);
        setHasError(false);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setHasError(true);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (!url || hasError || !imageObj) {
    return (
      <Group x={x} y={y} rotation={rotation} onClick={onClick}>
        <Rect
          width={width}
          height={height}
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth={1}
          dash={[4, 4]}
          cornerRadius={4}
        />
        <Text
          text={hasError ? 'Image Not Found' : 'Loading Image...'}
          width={width}
          height={height}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(12, Math.min(width / 15, 20))}
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#64748B"
        />
      </Group>
    );
  }

  return (
    <KonvaImage
      image={imageObj}
      crop={crop || undefined}
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={rotation}
      onClick={onClick}
    />
  );
};

