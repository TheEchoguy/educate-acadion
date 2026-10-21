import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface CanvasUnsupportedProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  name: string;
  reason?: string | null;
  onClick?: () => void;
  isSelected?: boolean;
}

export const CanvasUnsupported: React.FC<CanvasUnsupportedProps> = ({
  x,
  y,
  width,
  height,
  rotation = 0,
  name,
  reason,
  onClick,
  isSelected,
}) => {
  const displayTitle = name || 'Native Complex Element';
  const displayReason = reason || 'Unsupported complex PowerPoint shape (Read-Only)';

  return (
    <Group x={x} y={y} rotation={rotation} onClick={onClick}>
      {/* Dashed outer boundary with soft amber/slate tint */}
      <Rect
        width={width}
        height={height}
        fill="#F8FAFC"
        stroke={isSelected ? '#2563EB' : '#94A3B8'}
        strokeWidth={isSelected ? 2 : 1.5}
        dash={[6, 4]}
        cornerRadius={6}
        shadowColor="rgba(0,0,0,0.06)"
        shadowBlur={4}
      />

      {/* Decorative top badge */}
      <Rect
        x={12}
        y={12}
        width={Math.min(width - 24, 160)}
        height={22}
        fill="#FEF3C7"
        stroke="#F59E0B"
        strokeWidth={0.8}
        cornerRadius={4}
      />
      <Text
        text="Native Element"
        x={12}
        y={16}
        width={Math.min(width - 24, 160)}
        fontSize={11}
        fontStyle="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#92400E"
        align="center"
      />

      {/* Object Title */}
      <Text
        text={displayTitle}
        x={16}
        y={42}
        width={width - 32}
        fontSize={Math.max(12, Math.min(width / 20, 16))}
        fontStyle="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#1E293B"
        wrap="word"
        ellipsis={true}
      />

      {/* Descriptive reason */}
      <Text
        text={displayReason}
        x={16}
        y={66}
        width={width - 32}
        height={height - 76}
        fontSize={Math.max(10, Math.min(width / 25, 12))}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#64748B"
        wrap="word"
        ellipsis={true}
      />
    </Group>
  );
};

