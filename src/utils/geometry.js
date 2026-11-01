// 2D geometry utilities for grading

export function sampleSegment(p1, p2, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
  }
  return pts;
}

export function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pointToStrokesDist(p, strokes) {
  let minDist = Infinity;
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length - 1; i++) {
      const d = pointToSegmentDist(p, stroke[i], stroke[i + 1]);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

// Grade user strokes against a set of reference edges [{x1,y1,x2,y2}]
// Returns { coverage, precision, score } all 0-1
export function gradeStrokesVsEdges(userStrokes, refEdges, tolerance = 15) {
  if (userStrokes.length === 0 || refEdges.length === 0) return { coverage: 0, precision: 0, score: 0 };

  const refPoints = refEdges.flatMap(e =>
    sampleSegment({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }, 30)
  );

  const dists = refPoints.map(p => pointToStrokesDist(p, userStrokes));
  const covered = dists.filter(d => d <= tolerance);
  const coverage = covered.length / dists.length;
  const precision = covered.length > 0
    ? 1 - (covered.reduce((a, b) => a + b, 0) / covered.length) / tolerance
    : 0;

  return {
    coverage: Math.round(coverage * 100),
    precision: Math.round(precision * 100),
    score: Math.round((coverage * 0.6 + precision * 0.4) * 100),
  };
}

// Fit an ellipse to a set of points (returns {cx,cy,rx,ry,angle})
// Simplified: use bounding box of points, return approximate ellipse
export function fitEllipse(points) {
  if (points.length < 5) return null;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: (maxX - minX) / 2,
    ry: (maxY - minY) / 2,
    angle: 0,
  };
}

// Check if lines in a set of strokes converge toward a vanishing point
// Returns deviation angle in degrees (lower = better perspective)
export function checkVanishingPoint(lines) {
  // lines: [{x1,y1,x2,y2}]
  // Extend each line and find pairwise intersections
  const intersections = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const pt = lineIntersection(lines[i], lines[j]);
      if (pt) intersections.push(pt);
    }
  }
  if (intersections.length < 2) return null;
  const cx = intersections.reduce((s, p) => s + p.x, 0) / intersections.length;
  const cy = intersections.reduce((s, p) => s + p.y, 0) / intersections.length;
  const spread = intersections.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / intersections.length;
  return { vp: { x: cx, y: cy }, spread };
}

function lineIntersection(l1, l2) {
  const d1x = l1.x2 - l1.x1, d1y = l1.y2 - l1.y1;
  const d2x = l2.x2 - l2.x1, d2y = l2.y2 - l2.y1;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((l2.x1 - l1.x1) * d2y - (l2.y1 - l1.y1) * d2x) / denom;
  return { x: l1.x1 + t * d1x, y: l1.y1 + t * d1y };
}
