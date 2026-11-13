import type { BoundingBox } from '../types/detection';

/**
 * Draws bounding boxes and confidence labels onto an HTML5 2D canvas context.
 */
export function drawDetectionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  detections: BoundingBox[]
): void {
  for (const box of detections) {
    const x = Math.round(box.x * width);
    const y = Math.round(box.y * height);
    const w = Math.round(box.width * width);
    const h = Math.round(box.height * height);

    const isFire = box.label === 'Fire';
    const strokeColor = isFire ? '#DC2626' : '#D97706';
    const fillTint = isFire ? 'rgba(220, 38, 38, 0.14)' : 'rgba(217, 119, 6, 0.14)';

    // Bounding box fill & border
    ctx.fillStyle = fillTint;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Corner bracket accents
    const corner = Math.min(16, Math.floor(Math.min(w, h) * 0.25));
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(x, y + corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + corner, y);
    // Top-right
    ctx.moveTo(x + w - corner, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + corner);
    // Bottom-left
    ctx.moveTo(x, y + h - corner);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + corner, y + h);
    // Bottom-right
    ctx.moveTo(x + w - corner, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - corner);
    ctx.stroke();

    // Label tag
    const labelText = `${box.label.toUpperCase()} ${box.confidence}%`;
    ctx.font = '600 13px "JetBrains Mono", monospace';
    const textMetrics = ctx.measureText(labelText);
    const tagWidth = textMetrics.width + 16;
    const tagHeight = 24;
    const tagY = y >= tagHeight + 4 ? y - tagHeight - 2 : y + 4;
    const tagX = Math.max(0, Math.min(width - tagWidth, x));

    ctx.fillStyle = strokeColor;
    ctx.fillRect(tagX, tagY, tagWidth, tagHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(labelText, tagX + 8, tagY + 16);
  }
}
