import { useEffect, useRef, useState } from 'react';
import DrawingCanvas from '../../components/DrawingCanvas';
import { gradeStrokesVsEdges } from '../../utils/geometry';
import { projectCube, cubeFaceDiagonals } from '../../utils/projection';
import ScoreDisplay from '../../components/ScoreDisplay';

const STEPS = 6; // number of rotation increments
const STEP_DEG = 15; // degrees per step
const CELL_W = 140;
const CELL_H = 160;
const PADDING = 24;
const CANVAS_W = PADDING * 2 + STEPS * CELL_W;
const CANVAS_H = CELL_H + PADDING * 2 + 40;

function toRad(deg) { return deg * Math.PI / 180; }

// Rotation axes options
const AXES = [
  { label: 'Y axis (horizontal spin)', rotXBase: 0, rotYBase: 0, deltaY: 1, deltaX: 0 },
  { label: 'X axis (tilt forward)', rotXBase: -0.4, rotYBase: 0.3, deltaY: 0, deltaX: 1 },
  { label: 'Diagonal', rotXBase: 0.2, rotYBase: 0.2, deltaY: 0.7, deltaX: 0.4 },
];

function generateRotation() {
  const axis = AXES[Math.floor(Math.random() * AXES.length)];
  const startY = (Math.random() * 30 - 15) * Math.PI / 180; // slight random start
  const startX = axis.rotXBase + (Math.random() * 0.2 - 0.1);
  return { axis, startX, startY };
}

function getCellEdges(step, rotation) {
  const { axis, startX, startY } = rotation;
  const totalDeg = step * STEP_DEG;
  const rotX = startX + toRad(totalDeg) * axis.deltaX;
  const rotY = startY + toRad(totalDeg) * axis.deltaY;
  const { edges, verts } = projectCube(rotX, rotY, CELL_W, CELL_H, 0.52);
  const diags = cubeFaceDiagonals(verts);
  return { edges, diags };
}

function drawCell(ctx, offsetX, offsetY, edges, diags, alpha = 1, color = '#1a1a1a') {
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const e of edges) {
    ctx.beginPath();
    ctx.moveTo(e.x1 + offsetX, e.y1 + offsetY);
    ctx.lineTo(e.x2 + offsetX, e.y2 + offsetY);
    ctx.stroke();
  }

  ctx.strokeStyle = color === '#1a1a1a' ? '#aaa' : color;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  for (const d of diags) {
    ctx.beginPath();
    ctx.moveTo(d.x1 + offsetX, d.y1 + offsetY);
    ctx.lineTo(d.x2 + offsetX, d.y2 + offsetY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export default function RotationExercise({ onComplete }) {
  const [rotation, setRotation] = useState(() => generateRotation());
  const refCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const [userStrokes, setUserStrokes] = useState([]);
  const [result, setResult] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Precompute cell data
  const cellData = Array.from({ length: STEPS }, (_, i) => getCellEdges(i, rotation));

  // Draw reference: show first cube only, rest are blank cells
  useEffect(() => {
    const canvas = refCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cell borders
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= STEPS; i++) {
      const x = PADDING + i * CELL_W;
      ctx.beginPath(); ctx.moveTo(x, PADDING + 30); ctx.lineTo(x, PADDING + 30 + CELL_H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(PADDING, PADDING + 30); ctx.lineTo(PADDING + STEPS * CELL_W, PADDING + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PADDING, PADDING + 30 + CELL_H); ctx.lineTo(PADDING + STEPS * CELL_W, PADDING + 30 + CELL_H); ctx.stroke();

    // Step labels
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < STEPS; i++) {
      const x = PADDING + i * CELL_W + CELL_W / 2;
      ctx.fillText(`+${i * STEP_DEG}°`, x, PADDING + 22);
    }

    // Draw first cube as reference
    const { edges, diags } = cellData[0];
    drawCell(ctx, PADDING, PADDING + 30, edges, diags);

    // Gray placeholder for remaining cells
    ctx.fillStyle = '#f5f5f5';
    for (let i = 1; i < STEPS; i++) {
      ctx.fillRect(PADDING + i * CELL_W + 1, PADDING + 31, CELL_W - 2, CELL_H - 2);
    }
    ctx.fillStyle = '#ccc';
    ctx.font = '11px monospace';
    for (let i = 1; i < STEPS; i++) {
      const x = PADDING + i * CELL_W + CELL_W / 2;
      ctx.textAlign = 'center';
      ctx.fillText('draw this', x, PADDING + 30 + CELL_H / 2);
    }

    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Axis: ${rotation.axis.label} · ${STEP_DEG}° per step`, PADDING, PADDING + 14);
  }, [rotation]);

  useEffect(() => {
    if (!showOverlay || !drawCanvasRef.current) return;
    setTimeout(() => {
      const canvas = drawCanvasRef.current;
      const ctx = canvas.getContext('2d');
      for (let i = 0; i < STEPS; i++) {
        const { edges, diags } = cellData[i];
        drawCell(ctx, PADDING + i * CELL_W, PADDING + 30, edges, diags, 0.3, '#22c55e');
      }
    }, 30);
  }, [showOverlay, rotation]);

  function grade() {
    // Grade each step separately
    const stepScores = cellData.map((data, i) => {
      const ox = PADDING + i * CELL_W;
      const oy = PADDING + 30;
      // Strokes in this cell's region (approximate by x range)
      const xMin = ox, xMax = ox + CELL_W;
      const cellStrokes = userStrokes
        .map(s => s.filter(p => p.x >= xMin && p.x <= xMax))
        .filter(s => s.length > 1);

      if (cellStrokes.length === 0) return null;

      // Translate edges to cell-local
      const localEdges = data.edges.map(e => ({
        x1: e.x1, y1: e.y1 + oy - PADDING - 30,
        x2: e.x2, y2: e.y2 + oy - PADDING - 30,
      }));
      const localStrokes = cellStrokes.map(s => s.map(p => ({ x: p.x - ox, y: p.y - oy })));
      const { score } = gradeStrokesVsEdges(localStrokes, data.edges, 12);
      return score;
    });

    const attempted = stepScores.filter(s => s != null);
    const avg = attempted.length > 0
      ? Math.round(attempted.reduce((a, b) => a + b, 0) / attempted.length)
      : 0;

    const feedbackParts = [];
    if (attempted.length < STEPS - 1) feedbackParts.push(`You only attempted ${attempted.length} of ${STEPS} steps.`);
    if (avg >= 75) feedbackParts.push('Good foreshortening! The face compression looks convincing.');
    else if (avg >= 50) feedbackParts.push('Getting there — watch how faces compress as they rotate away.');
    else feedbackParts.push('Focus on how the visible face widths change with each rotation step.');

    setResult({ score: avg, coverage: avg, precision: avg, feedback: feedbackParts.join(' ') });
  }

  function reset() {
    setRotation(generateRotation());
    setResult(null);
    setShowOverlay(false);
    setUserStrokes([]);
    drawCanvasRef.current?.clear();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>15 · Rotation</h2>
        <span style={{ color: '#888', fontSize: 13 }}>
          Redraw the cube at each rotation step — {STEP_DEG}° increments, {STEPS} steps.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Reference (first cube shown)</div>
          <canvas
            ref={refCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fafafa', maxWidth: '100%' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Your drawing (draw all {STEPS} cubes)</div>
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
        <button onClick={reset} style={toolBtn}>New rotation</button>
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
