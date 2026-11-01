import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import DrawingCanvas from '../../components/DrawingCanvas';
import { gradeStrokesVsEdges } from '../../utils/geometry';
import { projectCube } from '../../utils/projection';
import ScoreDisplay from '../../components/ScoreDisplay';

const CANVAS_W = 520;
const CANVAS_H = 480;

function randBetween(a, b) { return a + Math.random() * (b - a); }
function toRad(deg) { return deg * Math.PI / 180; }

// Generate 3-5 overlapping boxes at varied angles
function generateComposition() {
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 boxes
  const boxes = [];

  // Spread boxes around center
  for (let i = 0; i < count; i++) {
    const offsetX = randBetween(-100, 100);
    const offsetY = randBetween(-80, 80);
    const rotY = toRad(randBetween(-60, 60));
    const rotX = toRad(randBetween(-40, 40));
    const scale = randBetween(0.4, 0.8);
    boxes.push({ offsetX, offsetY, rotY, rotX, scale });
  }
  return boxes;
}

// Get all projected edges for a box at canvas position (cx, cy)
function getBoxEdges(box, canvasW, canvasH) {
  const { offsetX, offsetY, rotX, rotY, scale } = box;
  const { edges, verts } = projectCube(rotX, rotY, canvasW, canvasH, scale);

  // Translate edges to the box's position offset from center
  return edges.map(e => ({
    x1: e.x1 + offsetX,
    y1: e.y1 + offsetY,
    x2: e.x2 + offsetX,
    y2: e.y2 + offsetY,
  }));
}

// Draw one box into a canvas context
function drawBox(ctx, edges, alpha = 1, color = '#1a1a1a') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const e of edges) {
    ctx.beginPath();
    ctx.moveTo(e.x1, e.y1);
    ctx.lineTo(e.x2, e.y2);
    ctx.stroke();
  }
  ctx.restore();
}

// Use Three.js renderer to render the scene into the ref canvas
export default function BoxCompositionExercise({ onComplete }) {
  const [composition, setComposition] = useState(() => generateComposition());
  const refCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const [userStrokes, setUserStrokes] = useState([]);
  const [result, setResult] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Draw the reference composition
  useEffect(() => {
    const canvas = refCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Horizon line
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ddd';
    ctx.font = '10px monospace';
    ctx.fillText('horizon', 4, canvas.height / 2 - 3);

    // Draw each box
    composition.forEach((box, i) => {
      const edges = getBoxEdges(box, CANVAS_W, CANVAS_H);
      drawBox(ctx, edges, 1, '#1a1a1a');
    });

    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText(`${composition.length} boxes · study the perspective and overlap, then draw`, 8, 16);
  }, [composition]);

  useEffect(() => {
    if (!showOverlay || !drawCanvasRef.current) return;
    setTimeout(() => {
      const canvas = drawCanvasRef.current;
      const ctx = canvas.getContext('2d');
      composition.forEach(box => {
        const edges = getBoxEdges(box, CANVAS_W, CANVAS_H);
        drawBox(ctx, edges, 0.3, '#22c55e');
      });
    }, 30);
  }, [showOverlay, composition]);

  function grade() {
    // Collect all reference edges
    const allEdges = composition.flatMap(box => getBoxEdges(box, CANVAS_W, CANVAS_H));
    const { coverage, precision, score } = gradeStrokesVsEdges(userStrokes, allEdges, 16);

    const feedbackParts = [];
    if (coverage < 40) feedbackParts.push('Try to capture all boxes in the composition, including their connecting edges.');
    if (precision < 50) feedbackParts.push('Lines are deviating too much — check your vanishing point convergence.');
    if (score >= 75) feedbackParts.push('Solid composition! Perspective and overlap look convincing.');
    if (score >= 85) feedbackParts.push('Excellent depth and spatial arrangement.');

    setResult({ score, coverage, precision, feedback: feedbackParts.join(' ') });
  }

  function reset() {
    setComposition(generateComposition());
    setResult(null);
    setShowOverlay(false);
    setUserStrokes([]);
    drawCanvasRef.current?.clear();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>14 · Box Compositions</h2>
        <span style={{ color: '#888', fontSize: 13 }}>
          Study the reference, then draw the full composition with correct perspective and occlusion.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Reference composition</div>
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
            showGrid
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
        <button onClick={reset} style={toolBtn}>New composition</button>
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
