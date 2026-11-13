export type DemoSceneId = 'warehouse_fire' | 'server_smoke' | 'clean_corridor';

export interface DemoSceneOption {
  id: DemoSceneId;
  title: string;
  subtitle: string;
  expectedClass: 'Fire' | 'Smoke' | 'Safe';
}

export const DEMO_SCENES: DemoSceneOption[] = [
  {
    id: 'warehouse_fire',
    title: 'Warehouse Pallet Fire',
    subtitle: 'Active flames and rising smoke near storage racks',
    expectedClass: 'Fire',
  },
  {
    id: 'server_smoke',
    title: 'Server Room Smoke Leak',
    subtitle: 'Dense grey smoke billowing from overhead cable duct',
    expectedClass: 'Smoke',
  },
  {
    id: 'clean_corridor',
    title: 'Safe Laboratory Corridor',
    subtitle: 'Baseline clear corridor with normal lighting',
    expectedClass: 'Safe',
  },
];

/**
 * Renders a realistic deterministic CCTV/camera frame onto a 2D canvas.
 * Used both for single-frame sample tests and animated Live/Video simulation feeds.
 */
export function renderSimulatedSceneFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: DemoSceneId,
  tick = 0
): void {
  // Base industrial room background
  const wallGrad = ctx.createLinearGradient(0, 0, 0, height * 0.68);
  wallGrad.addColorStop(0, '#1a202c');
  wallGrad.addColorStop(1, '#263042');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, width, height * 0.68);

  // Floor plane
  const floorGrad = ctx.createLinearGradient(0, height * 0.68, 0, height);
  floorGrad.addColorStop(0, '#1e2530');
  floorGrad.addColorStop(1, '#12161f');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, height * 0.68, width, height * 0.32);

  // Perspective floor lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const xBottom = (width / 6) * i;
    const xTop = width * 0.5 + (xBottom - width * 0.5) * 0.45;
    ctx.beginPath();
    ctx.moveTo(xTop, height * 0.68);
    ctx.lineTo(xBottom, height);
    ctx.stroke();
  }

  // Structural columns / racks
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(width * 0.06, height * 0.16, width * 0.16, height * 0.56);
  ctx.fillRect(width * 0.78, height * 0.16, width * 0.16, height * 0.56);

  ctx.strokeStyle = '#334155';
  ctx.strokeRect(width * 0.06, height * 0.16, width * 0.16, height * 0.56);
  ctx.strokeRect(width * 0.78, height * 0.16, width * 0.16, height * 0.56);

  if (scene === 'clean_corridor') {
    // Overhead cool LED strip
    ctx.fillStyle = 'rgba(226, 232, 240, 0.22)';
    ctx.fillRect(width * 0.36, height * 0.05, width * 0.28, height * 0.03);

    // Wall fire extinguisher box (muted deep red small cabinet, outside fire thresholds)
    ctx.fillStyle = '#475569';
    ctx.fillRect(width * 0.44, height * 0.34, width * 0.12, height * 0.24);
    ctx.fillStyle = '#334155';
    ctx.fillRect(width * 0.46, height * 0.37, width * 0.08, height * 0.18);
  }

  if (scene === 'server_smoke') {
    // Server rack LEDs
    for (let row = 0; row < 6; row++) {
      ctx.fillStyle = row % 2 === 0 ? '#16a34a' : '#0284c7';
      ctx.fillRect(width * 0.1, height * 0.24 + row * 24, 6, 4);
      ctx.fillRect(width * 0.82, height * 0.24 + row * 24, 6, 4);
    }

    // Billowing dense grey smoke plume near upper-center ceiling & duct
    const drift = Math.sin(tick * 0.08) * 16;
    const smokePuffs = [
      { x: 0.46, y: 0.26, rx: 0.18, ry: 0.12, alpha: 0.9 },
      { x: 0.56, y: 0.22, rx: 0.21, ry: 0.13, alpha: 0.88 },
      { x: 0.36, y: 0.30, rx: 0.16, ry: 0.11, alpha: 0.84 },
      { x: 0.51, y: 0.35, rx: 0.19, ry: 0.11, alpha: 0.85 },
      { x: 0.62, y: 0.31, rx: 0.14, ry: 0.1, alpha: 0.8 },
    ];
    for (let i = 0; i < smokePuffs.length; i++) {
      const p = smokePuffs[i];
      const cx = width * p.x + drift * (i % 2 === 0 ? 1 : -0.7);
      const cy = height * p.y + Math.cos(tick * 0.07 + i) * 6;
      const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * p.rx);
      rg.addColorStop(0, `rgba(176, 180, 188, ${p.alpha})`);
      rg.addColorStop(0.65, `rgba(154, 159, 168, ${p.alpha * 0.85})`);
      rg.addColorStop(1, 'rgba(130, 136, 145, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, width * p.rx, height * p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (scene === 'warehouse_fire') {
    // Wooden pallet base
    ctx.fillStyle = '#4a3222';
    ctx.fillRect(width * 0.34, height * 0.72, width * 0.28, height * 0.09);

    // Rising dark grey smoke above flame
    const smokeShift = Math.sin(tick * 0.09) * 10;
    for (let i = 0; i < 4; i++) {
      const sx = width * (0.44 + i * 0.04) + smokeShift;
      const sy = height * (0.26 + i * 0.04);
      const sg = ctx.createRadialGradient(sx, sy, 8, sx, sy, width * 0.15);
      sg.addColorStop(0, 'rgba(164, 168, 175, 0.82)');
      sg.addColorStop(0.7, 'rgba(138, 143, 152, 0.55)');
      sg.addColorStop(1, 'rgba(110, 115, 122, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, width * 0.16, height * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer ambient orange floor glow
    const fx = width * 0.48;
    const fy = height * 0.64;
    const flicker = 1 + Math.sin(tick * 0.32) * 0.08;
    const glow = ctx.createRadialGradient(fx, fy, 12, fx, fy, width * 0.24 * flicker);
    glow.addColorStop(0, 'rgba(255, 120, 20, 0.55)');
    glow.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(width * 0.22, height * 0.35, width * 0.52, height * 0.45);

    // Multi-tongue bright flames (strong R > G > B chromatic values)
    const tongues = [
      { ox: -0.08, h: 0.22, w: 0.075 },
      { ox: -0.02, h: 0.29, w: 0.09 },
      { ox: 0.05, h: 0.25, w: 0.08 },
      { ox: 0.11, h: 0.18, w: 0.065 },
    ];
    tongues.forEach((t, idx) => {
      const sway = Math.sin(tick * 0.25 + idx * 1.4) * 8;
      const baseX = fx + width * t.ox;
      const baseY = height * 0.74;
      const tipY = baseY - height * t.h * flicker;

      // Outer crimson-orange flame body
      ctx.fillStyle = 'rgb(248, 86, 18)';
      ctx.beginPath();
      ctx.moveTo(baseX - width * t.w, baseY);
      ctx.quadraticCurveTo(baseX - width * t.w * 0.6, (baseY + tipY) * 0.5, baseX + sway, tipY);
      ctx.quadraticCurveTo(baseX + width * t.w * 0.6, (baseY + tipY) * 0.5, baseX + width * t.w, baseY);
      ctx.closePath();
      ctx.fill();

      // Inner bright yellow-orange flame core
      ctx.fillStyle = 'rgb(255, 198, 52)';
      ctx.beginPath();
      ctx.moveTo(baseX - width * t.w * 0.52, baseY);
      ctx.quadraticCurveTo(baseX - width * t.w * 0.25, (baseY + tipY) * 0.58, baseX + sway * 0.6, tipY + height * 0.05);
      ctx.quadraticCurveTo(baseX + width * t.w * 0.25, (baseY + tipY) * 0.58, baseX + width * t.w * 0.52, baseY);
      ctx.closePath();
      ctx.fill();
    });
  }

  // Subtle CCTV timestamp watermark in top-left corner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(12, 12, 224, 24);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '11px monospace';
  const camLabel =
    scene === 'warehouse_fire'
      ? 'CAM-01 · WAREHOUSE BAY'
      : scene === 'server_smoke'
        ? 'CAM-02 · SERVER ROOM'
        : 'CAM-03 · LAB CORRIDOR';
  ctx.fillText(camLabel, 20, 28);
}

/**
 * Generates a static Data URL PNG for a demo scene (for Image Detection & seeded incidents).
 */
export function generateSampleSceneDataUrl(scene: DemoSceneId, width = 640, height = 480): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  renderSimulatedSceneFrame(ctx, width, height, scene, 12);
  return canvas.toDataURL('image/png');
}
