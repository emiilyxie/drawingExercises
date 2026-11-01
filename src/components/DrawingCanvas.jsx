import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

const DrawingCanvas = forwardRef(({ width, height, onStrokesChange, showGrid = false }, ref) => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const strokes = useRef([]); // array of [{x,y}]
  const currentStroke = useRef([]);
  const [tool, setTool] = useState('pen'); // pen | eraser

  useImperativeHandle(ref, () => ({
    getStrokes: () => strokes.current,
    clear: () => {
      strokes.current = [];
      currentStroke.current = [];
      redraw();
      onStrokesChange?.([]);
    },
    undo: () => {
      strokes.current = strokes.current.slice(0, -1);
      redraw();
      onStrokesChange?.(strokes.current);
    },
    drawOverlay: (edges, color = 'rgba(0,180,100,0.7)') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      for (const e of edges) {
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(e.x2, e.y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    },
  }));

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }

  function getPos(e, canvas) {
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    redraw();

    function start(e) {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e, canvas);
      currentStroke.current = [pos];
    }

    function move(e) {
      e.preventDefault();
      if (!isDrawing.current) return;
      const pos = getPos(e, canvas);
      currentStroke.current.push(pos);

      const ctx = canvas.getContext('2d');
      const stroke = currentStroke.current;
      if (stroke.length < 2) return;
      ctx.strokeStyle = tool === 'eraser' ? '#fff' : '#1a1a1a';
      ctx.lineWidth = tool === 'eraser' ? 20 : 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke[stroke.length - 2].x, stroke[stroke.length - 2].y);
      ctx.lineTo(stroke[stroke.length - 1].x, stroke[stroke.length - 1].y);
      ctx.stroke();
    }

    function end(e) {
      e.preventDefault();
      if (!isDrawing.current) return;
      isDrawing.current = false;
      if (currentStroke.current.length > 1) {
        if (tool === 'eraser') {
          // Rebuild strokes, removing points near eraser path
          // Simple: just redraw and keep strokes (eraser handled via white paint)
        } else {
          strokes.current = [...strokes.current, [...currentStroke.current]];
          onStrokesChange?.(strokes.current);
        }
      }
      currentStroke.current = [];
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [tool, showGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        strokes.current = strokes.current.slice(0, -1);
        redraw();
        onStrokesChange?.(strokes.current);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => setTool('pen')}
          style={{
            padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc',
            background: tool === 'pen' ? '#1a1a1a' : '#fff',
            color: tool === 'pen' ? '#fff' : '#1a1a1a',
            cursor: 'pointer', fontSize: 13,
          }}
        >Pen</button>
        <button
          onClick={() => setTool('eraser')}
          style={{
            padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc',
            background: tool === 'eraser' ? '#1a1a1a' : '#fff',
            color: tool === 'eraser' ? '#fff' : '#1a1a1a',
            cursor: 'pointer', fontSize: 13,
          }}
        >Eraser</button>
        <span style={{ color: '#999', fontSize: 12 }}>⌘Z to undo</span>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid #ccc',
          borderRadius: 4,
          background: '#fff',
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
          touchAction: 'none',
          maxWidth: '100%',
        }}
      />
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;
