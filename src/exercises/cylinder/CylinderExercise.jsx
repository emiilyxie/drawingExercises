import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import DrawingCanvas from '../../components/DrawingCanvas';
import { gradeStrokesVsEdges } from '../../utils/geometry';
import ScoreDisplay from '../../components/ScoreDisplay';

const CANVAS_W = 480;
const CANVAS_H = 520;

function toRad(deg) { return (deg * Math.PI) / 180; }

// Generate a random cylinder scenario
function generateCylinder() {
  // Axis tilt: angle from horizontal (0 = horizontal, 90 = vertical)
  const tiltDeg = Math.floor(Math.random() * 80) + 5; // 5-85°
  // Height above/below horizon: affects ellipse degree
  // For simplicity: the cylinder axis tilt determines ellipse degree
  // Ellipse degree ≈ tiltDeg (when looking straight at a cylinder)
  // Length of cylinder (in canvas units)
  const length = 140 + Math.random() * 60;
  // Radius of cylinder
  const radius = 28 + Math.random() * 18;
  // Position: center of canvas
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  // Axis direction unit vector
  const axisAngle = toRad(tiltDeg);
  const dx = Math.cos(axisAngle);
  const dy = -Math.sin(axisAngle); // up on canvas = negative y

  return { tiltDeg, length, radius, cx, cy, dx, dy, axisAngle };
}

// Get the 2D projected ellipse for one end of the cylinder
// ellipseDegree: how open the ellipse is (0=line, 90=circle)
// The ellipse minor axis is aligned with the cylinder axis direction
function ellipseEdges(cx, cy, rx, ry, angle, n = 32) {
  // angle = rotation of the ellipse (minor axis along cylinder axis)
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    // Rotate by angle
    pts.push({
      x: cx + ex * Math.cos(angle) - ey * Math.sin(angle),
      y: cy + ex * Math.sin(angle) + ey * Math.cos(angle),
    });
  }
  const edges = [];
  for (let i = 0; i < pts.length - 1; i++) {
    edges.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
  }
  return edges;
}

// Compute reference edges for the cylinder
function getCylinderEdges(cyl) {
  const { tiltDeg, length, radius, cx, cy, dx, dy, axisAngle } = cyl;

  // Ellipse degree (how circular the ellipse looks) based on tilt from horizontal
  // When cylinder axis is nearly horizontal → very flat ellipse (low degree)
  // When axis is nearly vertical → near-circle
  const ellipseDeg = tiltDeg; // approximation
  const halfEllipseAngle = toRad(ellipseDeg);

  // Ellipse radii: major = radius (always), minor = radius * sin(tiltDeg)
  const ry = radius; // semi-axis perpendicular to cylinder axis
  const rx = radius * Math.abs(Math.sin(halfEllipseAngle)); // semi-axis along viewing direction

  // Two end centers
  const x1 = cx - dx * length / 2;
  const y1 = cy - dy * length / 2;
  const x2 = cx + dx * length / 2;
  const y2 = cy + dy * length / 2;

  // Ellipses: minor axis perpendicular to cylinder axis
  // The ellipse is rotated 90° from the axis direction
  const ellipseRotation = axisAngle + Math.PI / 2;

  const e1 = ellipseEdges(x1, y1, rx, ry, ellipseRotation);
  const e2 = ellipseEdges(x2, y2, rx, ry, ellipseRotation);

  // Side tangent lines: top and bottom tangents
  // Tangent lines connect the extreme points of both ellipses
  // For an ellipse rotated by angle, the tangent points are at angle+90 and angle-90 from ellipse center
  const perpAngle = axisAngle + Math.PI / 2;
  const top1 = { x: x1 + ry * Math.cos(perpAngle), y: y1 + ry * Math.sin(perpAngle) };
  const top2 = { x: x2 + ry * Math.cos(perpAngle), y: y2 + ry * Math.sin(perpAngle) };
  const bot1 = { x: x1 - ry * Math.cos(perpAngle), y: y1 - ry * Math.sin(perpAngle) };
  const bot2 = { x: x2 - ry * Math.cos(perpAngle), y: y2 - ry * Math.sin(perpAngle) };

  const tangents = [
    { x1: top1.x, y1: top1.y, x2: top2.x, y2: top2.y },
    { x1: bot1.x, y1: bot1.y, x2: bot2.x, y2: bot2.y },
  ];

  // Axis line (spine) — reference only, dashed
  const axis = [{ x1: x1, y1: y1, x2: x2, y2: y2 }];

  return { ellipses: [...e1, ...e2], tangents, axis, ellipseDeg, ry, rx, x1, y1, x2, y2, ellipseRotation, axisAngle };
}

function drawCylinderRef(canvas, cyl, alpha = 1) {
  const ctx = canvas.getContext('2d');
  const edges = getCylinderEdges(cyl);
  ctx.save();
  ctx.globalAlpha = alpha;

  // Axis (spine) dashed
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  for (const e of edges.axis) {
    ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Ellipses
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  for (const e of edges.ellipses) {
    ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
  }

  // Tangent lines
  for (const e of edges.tangents) {
    ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
  }

  ctx.restore();
}

// Draw small angle reference in corner
function drawAngleRef(canvas, cyl) {
  const ctx = canvas.getContext('2d');
  const margin = 16;
  const size = 60;
  const x = margin + size / 2;
  const y = CANVAS_H - margin - size / 2;

  ctx.save();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, 2 * Math.PI); ctx.stroke();

  // Horizontal reference line
  ctx.strokeStyle = '#ccc';
  ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.moveTo(x - size / 2, y); ctx.lineTo(x + size / 2, y); ctx.stroke();
  ctx.setLineDash([]);

  // Cylinder axis direction
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  const axDx = Math.cos(cyl.axisAngle);
  const axDy = -Math.sin(cyl.axisAngle);
  ctx.beginPath();
  ctx.moveTo(x - axDx * size / 2, y - axDy * size / 2);
  ctx.lineTo(x + axDx * size / 2, y + axDy * size / 2);
  ctx.stroke();

  // Ellipse perpendicular direction
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  const perpDx = Math.cos(cyl.axisAngle + Math.PI / 2);
  const perpDy = -Math.sin(cyl.axisAngle + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + perpDx * size / 2, y + perpDy * size / 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.fillText(`${cyl.tiltDeg}°`, x - 8, y + size / 2 + 11);

  ctx.restore();
}

export default function CylinderExercise({ onComplete }) {
  const [cyl, setCyl] = useState(() => generateCylinder());
  const refCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const [userStrokes, setUserStrokes] = useState([]);
  const [result, setResult] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Draw the reference canvas
  useEffect(() => {
    const canvas = refCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Show the axis/spine as a reference (user must draw the rest)
    const edges = getCylinderEdges(cyl);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);
    for (const e of edges.axis) {
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Mark the two endpoints of the axis
    ctx.fillStyle = '#e83838';
    for (const [ex, ey] of [[edges.x1, edges.y1], [edges.x2, edges.y2]]) {
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 2 * Math.PI); ctx.fill();
    }

    // Draw the angle reference in corner
    drawAngleRef(canvas, cyl);

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText('Draw the cylinder around this axis', 10, 16);
    ctx.fillStyle = '#e83838';
    ctx.fillText('← axis endpoints', edges.x1 + 8, edges.y1 - 6);
  }, [cyl]);

  // Show overlay on draw canvas when toggled
  useEffect(() => {
    if (!showOverlay || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    // Redraw user strokes first (handled by DrawingCanvas), then add overlay
    setTimeout(() => {
      drawCylinderRef(canvas, cyl, 0.35);
      drawAngleRef(canvas, cyl);
    }, 50);
  }, [showOverlay, cyl]);

  function grade() {
    const edges = getCylinderEdges(cyl);
    const allRef = [...edges.ellipses, ...edges.tangents];
    const { coverage, precision, score } = gradeStrokesVsEdges(userStrokes, allRef, 14);

    // Additional check: ellipse degree
    // Fit ellipses to top and bottom strokes (heuristic: strokes near endpoints)
    const feedbackParts = [];
    if (coverage < 50) feedbackParts.push('Missing parts: make sure to draw both ellipses and both tangent lines.');
    if (precision < 50) feedbackParts.push('Precision needs work: your ellipses and lines are straying too far from the correct path.');
    if (score >= 75) feedbackParts.push('Good work! Your cylinder is well-constructed.');

    setResult({
      score, coverage, precision,
      feedback: feedbackParts.join(' ') || 'Keep practicing the minor axis alignment.',
    });
  }

  function reset() {
    setCyl(generateCylinder());
    setResult(null);
    setShowOverlay(false);
    setUserStrokes([]);
    drawCanvasRef.current?.clear();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>13 · Cylinders</h2>
        <span style={{ color: '#888', fontSize: 13 }}>
          Draw the cylinder: two ellipses + tangent lines. Match the axis shown.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Reference */}
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Reference · axis tilt: <strong>{cyl.tiltDeg}°</strong>
          </div>
          <canvas
            ref={refCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fafafa', maxWidth: '100%' }}
          />
        </div>

        {/* Drawing canvas */}
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!result ? (
          <button
            onClick={grade}
            disabled={userStrokes.length === 0}
            style={{ ...toolBtn, background: userStrokes.length > 0 ? '#1a1a1a' : '#ccc', color: '#fff', borderColor: 'transparent' }}
          >Grade</button>
        ) : (
          <>
            <button onClick={() => setShowOverlay(v => !v)} style={toolBtn}>
              {showOverlay ? 'Hide' : 'Show'} answer overlay
            </button>
            <button onClick={reset} style={toolBtn}>New cylinder</button>
          </>
        )}
        <button onClick={reset} style={toolBtn}>New cylinder</button>
      </div>

      {result && (
        <ScoreDisplay
          result={result}
          onRetry={reset}
          onNext={onComplete ? () => onComplete(result.score) : null}
        />
      )}

      <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, maxWidth: 560 }}>
        <strong>Key:</strong> The ellipse minor axis must align with the cylinder spine.
        At {cyl.tiltDeg}° tilt, your ellipses should be about {cyl.tiltDeg}% as tall as they are wide.
        Blue line in corner = axis direction, orange = ellipse minor axis direction.
      </div>
    </div>
  );
}

const toolBtn = {
  padding: '6px 14px', borderRadius: 4, border: '1px solid #ccc',
  background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontSize: 13,
};
