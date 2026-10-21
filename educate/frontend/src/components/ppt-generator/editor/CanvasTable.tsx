import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type { TableDataDTO } from '../types/editor';

interface CanvasTableProps {
  tableData: TableDataDTO;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  onClick?: () => void;
}

export const CanvasTable: React.FC<CanvasTableProps> = ({
  tableData,
  x,
  y,
  width,
  height,
  rotation = 0,
  onClick,
}) => {
  const { rows, columns, cells } = tableData;
  if (rows <= 0 || columns <= 0) return null;

  const cellWidth = width / columns;
  const cellHeight = height / rows;

  return (
    <Group x={x} y={y} rotation={rotation} onClick={onClick}>
      {/* Outer border & base */}
      <Rect
        width={width}
        height={height}
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth={1}
        cornerRadius={3}
      />

      {/* Cells */}
      {cells.map((cell) => {
        const cellX = cell.col_index * cellWidth;
        const cellY = cell.row_index * cellHeight;
        const cellBg = cell.fill?.color || (cell.row_index === 0 ? '#F8FAFC' : '#FFFFFF');

        return (
          <Group key={`cell-${cell.row_index}-${cell.col_index}`} x={cellX} y={cellY}>
            <Rect
              width={cellWidth}
              height={cellHeight}
              fill={cellBg}
              stroke="#E2E8F0"
              strokeWidth={0.8}
            />
            <Text
              text={cell.text || ''}
              x={8}
              y={6}
              width={cellWidth - 16}
              height={cellHeight - 12}
              fontSize={Math.max(10, Math.min(cellHeight / 3, 14))}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontStyle={cell.row_index === 0 ? 'bold' : 'normal'}
              fill={cell.row_index === 0 ? '#0F172A' : '#334155'}
              verticalAlign="middle"
              wrap="word"
              ellipsis={true}
            />
          </Group>
        );
      })}

      {/* Grid Lines */}
      {Array.from({ length: columns + 1 }).map((_, i) => (
        <Line
          key={`vline-${i}`}
          points={[i * cellWidth, 0, i * cellWidth, height]}
          stroke="#CBD5E1"
          strokeWidth={0.8}
        />
      ))}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <Line
          key={`hline-${i}`}
          points={[0, i * cellHeight, width, i * cellHeight]}
          stroke="#CBD5E1"
          strokeWidth={0.8}
        />
      ))}
    </Group>
  );
};

