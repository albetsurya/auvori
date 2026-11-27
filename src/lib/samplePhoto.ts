export type SamplePhotoId = 'cafe' | 'park' | 'window';

export interface SamplePhotoMeta {
  id: SamplePhotoId;
  title: string;
  subtitle: string;
}

export const SAMPLE_PHOTOS: SamplePhotoMeta[] = [
  { id: 'cafe', title: 'Café Window', subtitle: 'Soft indoor portrait light' },
  { id: 'park', title: 'Garden Shade', subtitle: 'Lush greenery & portrait tones' },
  { id: 'window', title: 'Golden Hour', subtitle: 'Warm afternoon editorial light' }
];

const sampleCache: Partial<Record<SamplePhotoId, string>> = {};

/**
 * Generates clean 4:5 editorial studio sample photos locally on Canvas so users can
 * test presets and discover looks offline without external network dependencies.
 */
export function createSamplePhotoDataUrl(kind: SamplePhotoId = 'cafe'): string {
  if (sampleCache[kind]) return sampleCache[kind]!;

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (kind === 'park') {
    // Deep organic foliage backdrop + shaded natural portrait
    const bg = ctx.createLinearGradient(0, 0, 800, 1000);
    bg.addColorStop(0, '#4f6d3a');
    bg.addColorStop(0.5, '#68854b');
    bg.addColorStop(1, '#3c452d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 800, 1000);

    // Dappled foliage texture
    const leafColors = ['#7ea154', '#5b7a3d', '#8fb164', '#43592f'];
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = leafColors[i % leafColors.length];
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      const lx = ((i * 173) % 860) - 30;
      const ly = ((i * 239) % 720) - 20;
      const lr = 55 + ((i * 37) % 65);
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Warm sunlit bokeh orbs in upper trees
    ctx.fillStyle = 'rgba(244, 232, 195, 0.32)';
    for (const [bx, by, br] of [[150, 140, 26], [640, 180, 32], [580, 110, 18], [230, 220, 16]]) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shoulders / warm brown jacket
    const jacket = ctx.createLinearGradient(180, 620, 620, 1000);
    jacket.addColorStop(0, '#7c5d49');
    jacket.addColorStop(1, '#584132');
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.ellipse(400, 860, 260, 240, 0, Math.PI, 0);
    ctx.fillRect(140, 850, 520, 160);
    ctx.fill();

    // Hijab / hair frame
    ctx.fillStyle = '#23262d';
    ctx.beginPath();
    ctx.ellipse(400, 440, 152, 185, 0, 0, Math.PI * 2);
    ctx.fill();

    // Natural shaded skin face
    const skin = ctx.createRadialGradient(385, 420, 20, 400, 445, 130);
    skin.addColorStop(0, '#e3beaa');
    skin.addColorStop(1, '#c99e8a');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(400, 448, 96, 118, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle natural blush & lip tone for Rosy Bokeh preview
    ctx.fillStyle = 'rgba(198, 120, 115, 0.28)';
    ctx.beginPath();
    ctx.ellipse(348, 468, 22, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(452, 468, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9756f';
    ctx.beginPath();
    ctx.ellipse(400, 512, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'window') {
    // Golden hour sunlit editorial studio wall
    const wall = ctx.createLinearGradient(0, 0, 800, 1000);
    wall.addColorStop(0, '#d8c9b8');
    wall.addColorStop(0.55, '#cbb69e');
    wall.addColorStop(1, '#8c725c');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 800, 1000);

    // Diagonal warm sunlight shaft
    ctx.fillStyle = 'rgba(255, 240, 214, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(660, 0);
    ctx.lineTo(800, 420);
    ctx.lineTo(0, 680);
    ctx.closePath();
    ctx.fill();

    // Editorial table & warm ceramic vessel
    ctx.fillStyle = '#6f5444';
    ctx.fillRect(0, 640, 800, 360);

    // Vase with warm dried botanical stems
    ctx.fillStyle = '#e7dfd5';
    ctx.beginPath();
    ctx.ellipse(270, 610, 74, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e664b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(265, 520);
    ctx.quadraticCurveTo(220, 360, 190, 220);
    ctx.moveTo(275, 520);
    ctx.quadraticCurveTo(330, 340, 375, 190);
    ctx.stroke();

    // Warm portrait subject on right-center
    ctx.fillStyle = '#332c28';
    ctx.beginPath();
    ctx.ellipse(535, 455, 130, 155, 0, 0, Math.PI * 2);
    ctx.fill();
    const skin = ctx.createRadialGradient(520, 430, 18, 535, 455, 110);
    skin.addColorStop(0, '#efd0bc');
    skin.addColorStop(1, '#d3ab92');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(535, 458, 86, 106, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c47b74';
    ctx.beginPath();
    ctx.ellipse(535, 514, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#53433a';
    ctx.beginPath();
    ctx.ellipse(535, 760, 190, 210, 0, Math.PI, 0);
    ctx.fill();
  } else {
    // Indoor Café Window Portrait (clean editorial tones)
    const bg = ctx.createLinearGradient(0, 0, 800, 1000);
    bg.addColorStop(0, '#c6cfd2');
    bg.addColorStop(0.55, '#9ea8ac');
    bg.addColorStop(1, '#4c3f37');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 800, 1000);

    // Café window panes
    ctx.fillStyle = '#e5eaec';
    ctx.fillRect(54, 48, 320, 440);
    ctx.fillRect(426, 48, 320, 440);

    // Foliage outside window
    ctx.fillStyle = '#759f4b';
    ctx.beginPath();
    ctx.arc(170, 200, 84, 0, Math.PI * 2);
    ctx.arc(250, 230, 68, 0, Math.PI * 2);
    ctx.arc(620, 185, 92, 0, Math.PI * 2);
    ctx.fill();

    // Window frames
    ctx.strokeStyle = '#474f54';
    ctx.lineWidth = 18;
    ctx.strokeRect(54, 48, 320, 440);
    ctx.strokeRect(426, 48, 320, 440);

    // Café lights / bokeh dots
    ctx.fillStyle = 'rgba(255, 244, 214, 0.72)';
    for (const [lx, ly, lr] of [[120, 110, 12], [290, 95, 10], [500, 115, 14], [690, 95, 11]]) {
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light editorial café table
    const table = ctx.createLinearGradient(0, 620, 800, 1000);
    table.addColorStop(0, '#dcd7d1');
    table.addColorStop(1, '#c3bcb4');
    ctx.fillStyle = table;
    ctx.fillRect(0, 620, 800, 380);

    // Iced latte glass
    ctx.fillStyle = '#efe9e2';
    ctx.beginPath();
    ctx.roundRect(145, 675, 140, 200, 22);
    ctx.fill();
    ctx.fillStyle = '#b48766';
    ctx.beginPath();
    ctx.roundRect(157, 735, 116, 128, 14);
    ctx.fill();

    // Croissant plate
    ctx.fillStyle = '#f8f6f2';
    ctx.beginPath();
    ctx.ellipse(545, 815, 165, 92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cb8c4d';
    ctx.beginPath();
    ctx.ellipse(545, 805, 102, 52, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Portrait subject
    ctx.fillStyle = '#26292e';
    ctx.beginPath();
    ctx.ellipse(400, 630, 155, 175, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(400, 430, 126, 0, Math.PI * 2);
    ctx.fill();

    const skin = ctx.createRadialGradient(385, 410, 18, 400, 430, 110);
    skin.addColorStop(0, '#efc9b2');
    skin.addColorStop(1, '#d6a98f');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(400, 434, 84, 102, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(205, 122, 118, 0.25)';
    ctx.beginPath();
    ctx.ellipse(354, 452, 20, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(446, 452, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#be7370';
    ctx.beginPath();
    ctx.ellipse(400, 488, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle milky haze so tone presets show clean clarity
    ctx.fillStyle = 'rgba(244, 240, 234, 0.14)';
    ctx.fillRect(0, 0, 800, 1000);
  }

  const url = canvas.toDataURL('image/jpeg', 0.9);
  sampleCache[kind] = url;
  return url;
}
