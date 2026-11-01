import { useRef, useState, useEffect, useCallback } from 'react';
import { projectCube, cubeFaceDiagonals } from '../../utils/projection';
import { gradeStrokesVsEdges } from '../../utils/geometry';
import ScoreDisplay from '../../components/ScoreDisplay';

// Grid config: rows = elevation angles, cols = azimuth angles
const AZIMUTHS = [5, 20, 35, 50, 65]; // horizontal rotation (deg)
const ELEVATIONS = [60, 45, 30, 15, 0, -15]; // vertical rotation (deg), top to bottom
const CELL_SIZE = 130;
const PADDING = 40;

function toRad(deg) { return (deg * Math.PI) / 180; }

// For each grid cell, compute the projected cube edges in local cell space
function getCellData(rowIdx, colIdx) {
  const azDeg = AZIMUTHS[colIdx];
  const elDeg = ELEVATIONS[rowIdx];
  const rotY = toRad(azDeg);
  const rotX = toRad(-elDeg); // positive elevation = looking down = negative rotX
  const cellW = CELL_SIZE;
  const cellH = CELL_SIZE;
  const { edges, verts } = projectCube(rotX, rotY, cellW, cellH, 0.55);
  const diags = cubeFaceDiagonals(verts);
  return { edges, diags, rotX, rotY, azDeg, elDeg };
}

// Draw the reference cube into a canvas context at an offset
function drawCubeReference(ctx, cellData, offsetX, offsetY, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';

  for (const e of cellData.edges) {
    ctx.beginPath();
    ctx.moveTo(e.x1 + offsetX, e.y1 + offsetY);
    ctx.lineTo(e.x2 + offsetX, e.y2 + offsetY);
    ctx.stroke();
  }

  // Face diagonals — lighter
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  for (const d of cellData.diags) {
    ctx.beginPath();
    ctx.moveTo(d.x1 + offsetX, d.y1 + offsetY);
    ctx.lineTo(d.x2 + offsetX, d.y2 + offsetY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export default function CubeGridExercise({ onComplete }) {
  const refCanvasRef = useRef(null); // reference grid (left panel)
  const drawCanvasRef = useRef(null); // user drawing canvas
  const [strokes, setStrokes] = useState([]); // [{cellRow, cellCol, points:[]}]
  const [activeCell, setActiveCell] = useState(null); // {row, col}
  const [showOverlay, setShowOverlay] = useState(false);
  const [scores, setScores] = useState(null); // per-cell scores
  const [submitted, setSubmitted] = useState(false);
  const isDrawing = useRef(false);
  const currentStroke = useRef([]);

  const rows = ELEVATIONS.length;
  const cols = AZIMUTHS.length;
  const totalW = PADDING * 2 + cols * CELL_SIZE;
  const totalH = PADDING * 2 + rows * CELL_SIZE;

  // Precompute all cell data
  const allCellData = useRef([]);
  useEffect(() => {
    const data = [];
    for (let r = 0; r < rows; r++) {
      data[r] = [];
      for (let c = 0; c < cols; c++) {
        data[r][c] = getCellData(r, c);
      }
    }
    allCellData.current = data;
  }, []);

  // Draw the reference grid
  useEffect(() => {
    const canvas = refCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Light grid lines
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      const x = PADDING + c * CELL_SIZE;
      ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + rows * CELL_SIZE); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = PADDING + r * CELL_SIZE;
      ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(PADDING + cols * CELL_SIZE, y); ctx.stroke();
    }

    // Column headers (azimuth)
    ctx.fillStyle = '#e83838';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < cols; c++) {
      const x = PADDING + c * CELL_SIZE + CELL_SIZE / 2;
      ctx.fillText(`${AZIMUTHS[c]}°`, x, PADDING - 6);
    }

    // Row headers (elevation)
    ctx.fillStyle = '#3872e8';
    ctx.textAlign = 'right';
    for (let r = 0; r < rows; r++) {
      const y = PADDING + r * CELL_SIZE + CELL_SIZE / 2 + 4;
      ctx.fillText(`${ELEVATIONS[r]}°`, PADDING - 6, y);
    }

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('azimuth →', PADDING + (cols * CELL_SIZE) / 2, 12);
    ctx.save();
    ctx.translate(10, PADDING + (rows * CELL_SIZE) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('elevation ↑', 0, 0);
    ctx.restore();
  }, []);

  // Draw user strokes + optional overlay on draw canvas
  const redrawDrawCanvas = useCallback((overlayOn = false) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cell borders
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      const x = PADDING + c * CELL_SIZE;
      ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + rows * CELL_SIZE); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = PADDING + r * CELL_SIZE;
      ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(PADDING + cols * CELL_SIZE, y); ctx.stroke();
    }

    // Active cell highlight
    if (activeCell) {
      const { row, col } = activeCell;
      ctx.fillStyle = 'rgba(59,130,246,0.06)';
      ctx.fillRect(PADDING + col * CELL_SIZE, PADDING + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    // Overlay correct cubes
    if (overlayOn && allCellData.current.length) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ox = PADDING + c * CELL_SIZE;
          const oy = PADDING + r * CELL_SIZE;
          drawCubeReference(ctx, allCellData.current[r][c], ox, oy, 0.35);
        }
      }
    }

    // Score colors per cell
    if (scores) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const s = scores[r]?.[c];
          if (s == null) continue;
          const color = s >= 70 ? 'rgba(34,197,94,0.15)' : s >= 45 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
          ctx.fillStyle = color;
          ctx.fillRect(PADDING + c * CELL_SIZE + 1, PADDING + r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.fillStyle = s >= 70 ? '#16a34a' : s >= 45 ? '#b45309' : '#dc2626';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${s}`, PADDING + (c + 1) * CELL_SIZE - 4, PADDING + (r + 1) * CELL_SIZE - 4);
        }
      }
    }

    // User strokes
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  }, [strokes, activeCell, scores, showOverlay]);

  useEffect(() => { redrawDrawCanvas(showOverlay); }, [redrawDrawCanvas, showOverlay]);

  function getCellFromPos(x, y) {
    const col = Math.floor((x - PADDING) / CELL_SIZE);
    const row = Math.floor((y - PADDING) / CELL_SIZE);
    if (col >= 0 && col < cols && row >= 0 && row < rows) return { row, col };
    return null;
  }

  function getCanvasPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    function onDown(e) {
      e.preventDefault();
      if (submitted) return;
      const pos = getCanvasPos(e, canvas);
      const cell = getCellFromPos(pos.x, pos.y);
      setActiveCell(cell);
      isDrawing.current = true;
      currentStroke.current = { row: cell?.row, col: cell?.col, points: [pos] };
    }
    function onMove(e) {
      e.preventDefault();
      if (!isDrawing.current || submitted) return;
      const pos = getCanvasPos(e, canvas);
      currentStroke.current.points.push(pos);

      const ctx = canvas.getContext('2d');
      const pts = currentStroke.current.points;
      if (pts.length < 2) return;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
    function onUp(e) {
      e.preventDefault();
      if (!isDrawing.current) return;
      isDrawing.current = false;
      if (currentStroke.current.points.length > 1) {
        setStrokes(prev => [...prev, { ...currentStroke.current }]);
      }
      currentStroke.current = [];
    }

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, [submitted]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        setStrokes(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function grade() {
    if (!allCellData.current.length) return;
    const cellScores = [];
    for (let r = 0; r < rows; r++) {
      cellScores[r] = [];
      for (let c = 0; c < cols; c++) {
        // Get user strokes in this cell, translated to cell-local coords
        const ox = PADDING + c * CELL_SIZE;
        const oy = PADDING + r * CELL_SIZE;
        const cellStrokes = strokes
          .filter(s => s.row === r && s.col === c)
          .map(s => s.points.map(p => ({ x: p.x - ox, y: p.y - oy })));

        const refEdges = allCellData.current[r][c].edges;
        if (cellStrokes.length === 0) {
          cellScores[r][c] = null; // not attempted
        } else {
          const { score } = gradeStrokesVsEdges(cellStrokes, refEdges, 12);
          cellScores[r][c] = score;
        }
      }
    }
    setScores(cellScores);
    setSubmitted(true);
    setShowOverlay(true);

    const attempted = cellScores.flat().filter(s => s != null);
    const avgScore = attempted.length > 0
      ? Math.round(attempted.reduce((a, b) => a + b, 0) / attempted.length)
      : 0;
    return avgScore;
  }

  const attempted = strokes.length > 0;
  const avgScore = scores
    ? Math.round(scores.flat().filter(s => s != null).reduce((a, b) => a + b, 0) / Math.max(1, scores.flat().filter(s => s != null).length))
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>12 · Cube Grid</h2>
        <span style={{ color: '#888', fontSize: 13 }}>
          Draw each cube at the given azimuth (red) and elevation (blue) angles
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Reference grid */}
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Reference angles</div>
          <canvas
            ref={refCanvasRef}
            width={totalW}
            height={totalH}
            style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fafafa', maxWidth: '100%' }}
          />
        </div>

        {/* Drawing canvas */}
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Draw here · {activeCell ? `Cell (az ${AZIMUTHS[activeCell.col]}°, el ${ELEVATIONS[activeCell.row]}°)` : 'click a cell to start'}
          </div>
          <canvas
            ref={drawCanvasRef}
            width={totalW}
            height={totalH}
            style={{
              border: '1px solid #ccc', borderRadius: 4, background: '#fff',
              cursor: submitted ? 'default' : 'crosshair', touchAction: 'none', maxWidth: '100%',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!submitted ? (
          <>
            <button
              onClick={() => setStrokes(prev => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              style={toolBtn}
            >Undo</button>
            <button
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              style={toolBtn}
            >Clear</button>
            <button
              onClick={grade}
              disabled={!attempted}
              style={{ ...toolBtn, background: attempted ? '#1a1a1a' : '#ccc', color: '#fff', borderColor: 'transparent' }}
            >Grade</button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowOverlay(v => !v)}
              style={toolBtn}
            >{showOverlay ? 'Hide overlay' : 'Show overlay'}</button>
            <button
              onClick={() => { setStrokes([]); setScores(null); setSubmitted(false); setShowOverlay(false); }}
              style={toolBtn}
            >Try again</button>
            {onComplete && (
              <button onClick={() => onComplete(avgScore)} style={{ ...toolBtn, background: '#1a1a1a', color: '#fff', borderColor: 'transparent' }}>
                Next exercise →
              </button>
            )}
          </>
        )}
        {avgScore != null && (
          <span style={{ fontSize: 14, fontWeight: 600, color: avgScore >= 70 ? '#16a34a' : avgScore >= 45 ? '#b45309' : '#dc2626' }}>
            Average score: {avgScore}/100
          </span>
        )}
      </div>

      {submitted && (
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, background: '#f9f9f9', padding: 12, borderRadius: 6 }}>
          <strong>Green cells</strong> = good · <strong>Yellow</strong> = needs work · <strong>Red</strong> = try again ·{' '}
          <strong>No color</strong> = not attempted. Green overlay shows the correct cube.
        </div>
      )}
    </div>
  );
}

const toolBtn = {
  padding: '6px 14px', borderRadius: 4, border: '1px solid #ccc',
  background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontSize: 13,
};
