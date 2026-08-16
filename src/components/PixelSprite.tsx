import { memo } from 'react';
import { PALETTE, SPRITES } from '../game/sprites';

interface Props {
  sprite: string;
  /** ukuran sisi dalam px CSS (SVG tetap 12×12 piksel data) */
  size?: number | string;
  title?: string;
}

/** Render satu sprite pixel-art sebagai SVG tajam (crispEdges). */
export const PixelSprite = memo(function PixelSprite({ sprite, size, title }: Props) {
  const rows = SPRITES[sprite] ?? SPRITES.grass;
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    // gabungkan piksel sewarna yang berdampingan jadi satu rect (hemat node)
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !PALETTE[ch]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run += 1;
      rects.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={PALETTE[ch]} />
      );
      x += run;
    }
  });

  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      style={{ display: 'block' }}
    >
      {rects}
    </svg>
  );
});
