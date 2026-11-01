import { useRef, useState, useEffect } from 'react';
import DrawingCanvas from '../../components/DrawingCanvas';
import { gradeStrokesVsEdges, sampleSegment } from '../../utils/geometry';
import ScoreDisplay from '../../components/ScoreDisplay';

const CANVAS_W = 480;
const CANVAS_H = 520;

// 2D shapes to extrude
const SHAPES = [
  {
    name: 'Pentagon',
    verts: (s) => Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
      return [Math.cos(a) * s, Math.sin(a) * s];
    }),
  },
  {
    name: 'Star',
    verts: (s) => Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * 2 * Math.PI - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.45;
      return [Math.cos(a) * r, Math.sin(a) * r];
    }),
  },
  {
    name: 'Arrow',
    verts: () => [
      [0, -60], [30, -10], [15, -10], [15, 40], [-15, 40], [-15, -10], [-30, -10],
    ],
  },
  {
    name: 'L-shape',
    verts: () => [
      [-40, -50], [0, -50], [0, -10], [30, -10], [30, 30], [-40, 30],
    ],
  },
  {
    name: 'Triangle',
    verts: (s) => [
      [0, -s], [s * 0.866, s * 0.5], [-s * 0.866, s * 0.5],
    ],
  },
];

// Extrusion directions (dx, dy in canvas space — rightward and upward)
const DIRECTIONS = [
  { label: 'right-back', dx: 60, dy: -25 },
  { label: 'left-back', dx: -60, dy: -25 },
  { label: 'up-back', dx: 20, dy: -70 },
  { label: 'right-down', dx: 65, dy: 20 },
];

function generateExtrusion() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const size = 40 + Math.random() * 20;
  const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  const depth = 0.6 + Math.random() * 0.8; // scale of direction vector
  const verts = shape.verts(size);
  const cx = CANVAS_W / 2 - dir.dx * depth / 2;
  const cy = CANVAS_H / 2 - dir.dy * depth / 2;
  return { shape, verts, cx, cy, dir, depth, size };
}

// Compute the 2D edges of the extruded shape
function getExtrusionEdges(ext) {
  const { verts, cx, cy, dir, depth } = ext;
  const edx = dir.dx * depth;
  const edy = dir.dy * depth;

  // Front face vertices (absolute canvas coords)
  const front = verts.map(([x, y]) => ({ x: cx + x, y: cy + y }));
  // Back face vertices
  const back = verts.map(([x, y]) => ({ x: cx + x + edx, y: cy + y + edy }));

  const edges = [];

  // Front face outline
  for (let i = 0; i < front.length; i++) {
    const a = front[i], b = front[(i + 1) % front.length];
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, type: 'front' });
  }
  // Back face outline
  for (let i = 0; i < back.length; i++) {
    const a = back[i], b = back[(i + 1) % back.length];
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, type: 'back' });
  }
  // Connecting edges
  for (let i = 0; i < front.length; i++) {
    edges.push({ x1: front[i].x, y1: front[i].y, x2: back[i].x, y2: back[i].y, type: 'side' });
  }

  return { edges, front, back, edx, edy };
}

function drawExtrusionRef(ctx, ext, alpha = 1) {
  const { edges } = getExtrusionEdges(ext);
  ctx.save();
  ctx.globalAlpha = alpha;

  for (const e of edges) {
    ctx.strokeStyle = e.type === 'front' ? '#1a1a1a' : e.type === 'back' ? '#888' : '#555';
    ctx.lineWidth = e.type === 'front' ? 2 : 1;
    ctx.setLineDash(e.type === 'back' ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(e.x1, e.y1);
    ctx.lineTo(e.x2, e.y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export default function ExtrusionExercise({ onComplete }) {
  const [ext, setExt] = useState(() => generateExtrusion());
  const refCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const [userStrokes, setUserStrokes] = useState([]);
  const [result, setResult] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const canvas = refCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { front, edx, edy } = getExtrusionEdges(ext);

    // Draw only the front face (the shape to extrude)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(59,130,246,0.08)';
    ctx.beginPath();
    ctx.moveTo(front[0].x, front[0].y);
    for (let i = 1; i < front.length; i++) ctx.lineTo(front[i].x, front[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw extrusion direction arrow
    const arrowCx = CANVAS_W / 2;
    const arrowCy = CANVAS_H - 50;
    ctx.strokeStyle = '#e83838';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(arrowCx, arrowCy);
    ctx.lineTo(arrowCx + edx * 0.5, arrowCy + edy * 0.5);
    ctx.stroke();

    // Arrow head
    const len = Math.hypot(edx, edy) * 0.5;
    const ux = edx / (len * 2), uy = edy / (len * 2);
    const ax = arrowCx + edx * 0.5, ay = arrowCy + edy * 0.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - ux * 12 - uy * 6, ay - uy * 12 + ux * 6);
    ctx.lineTo(ax - ux * 12 + uy * 6, ay - uy * 12 - ux * 6);
    ctx.closePath();
    ctx.fillStyle = '#e83838';
    ctx.fill();

    ctx.fillStyle = '#e83838';
    ctx.font = '11px monospace';
    ctx.fillText(`extrude: ${ext.dir.label}`, arrowCx - edx * 0.5 * 0.8, arrowCy + edy * 0.5 * 0.8 + 14);

    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText(`Shape: ${ext.shape.name}`, 10, 18);
    ctx.fillText('Extrude this shape →', 10, 34);
  }, [ext]);

  useEffect(() => {
    if (!showOverlay || !drawCanvasRef.current) return;
    setTimeout(() => {
      const canvas = drawCanvasRef.current;
      const ctx = canvas.getContext('2d');
      drawExtrusionRef(ctx, ext, 0.35);
    }, 30);
  }, [showOverlay, ext]);

  function grade() {
    const { edges } = getExtrusionEdges(ext);
    const { coverage, precision, score } = gradeStrokesVsEdges(userStrokes, edges, 14);

    const feedbackParts = [];
    if (coverage < 40) feedbackParts.push('You are missing significant parts — draw the front face, back face, and all connecting edges.');
    if (precision < 50) feedbackParts.push('Your lines are drifting too far from the reference. Focus on the direction vector.');
    if (score >= 75) feedbackParts.push(`Great extrusion! The ${ext.dir.label} direction reads clearly.`);

    setResult({ score, coverage, precision, feedback: feedbackParts.join(' ') });
  }

  function reset() {
    setExt(generateExtrusion());
    setResult(null);
    setShowOverlay(false);
    setUserStrokes([]);
    drawCanvasRef.current?.clear();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>11 · Extrusion</h2>
        <span style={{ color: '#888', fontSize: 13 }}>
          Extrude the shape in the given direction. Draw front face + back face + connecting edges.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Reference · <strong>{ext.shape.name}</strong> → <strong>{ext.dir.label}</strong>
          </div>
          <canvas
            ref={refCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fafafa', maxWidth: '100%' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Your drawing</div>
          <DrawingCanvas
            ref={drawCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onStrokesChange={setUserStrokes}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!result ? (
          <button
            onClick={grade}
            disabled={userStrokes.length === 0}
            style={{ ...toolBtn, background: userStrokes.length > 0 ? '#1a1a1a' : '#ccc', color: '#fff', borderColor: 'transparent' }}
          >Grade</button>
        ) : (
          <button onClick={() => setShowOverlay(v => !v)} style={toolBtn}>
            {showOverlay ? 'Hide' : 'Show'} answer overlay
          </button>
        )}
        <button onClick={reset} style={toolBtn}>New shape</button>
      </div>

      {result && (
        <ScoreDisplay
          result={result}
          onRetry={reset}
          onNext={onComplete ? () => onComplete(result.score) : null}
        />
      )}
    </div>
  );
}

const toolBtn = {
  padding: '6px 14px', borderRadius: 4, border: '1px solid #ccc',
  background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontSize: 13,
};
