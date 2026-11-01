// 3D -> 2D projection utilities using basic matrix math
// Avoids needing a full Three.js scene just for projection

import * as THREE from 'three';

// Project a Three.js scene's edges into 2D canvas space
// Returns array of {x1,y1,x2,y2} segments
export function projectEdges(geometry, rotX, rotY, rotZ = 0, canvasW, canvasH, fov = 50) {
  const positions = geometry.attributes.position;
  const index = geometry.index;

  // Build transform
  const euler = new THREE.Euler(rotX, rotY, rotZ, 'YXZ');
  const mat = new THREE.Matrix4().makeRotationFromEuler(euler);

  // Camera: looking down -Z from distance
  const dist = 4;
  const aspect = canvasW / canvasH;
  const fovRad = (fov * Math.PI) / 180;
  const f = 1 / Math.tan(fovRad / 2);

  function project(vx, vy, vz) {
    // Apply rotation
    const v = new THREE.Vector3(vx, vy, vz).applyMatrix4(mat);
    // Simple perspective
    const z = v.z - dist;
    if (z >= 0) return null; // behind camera
    const px = (f * v.x) / (-z * aspect);
    const py = (f * v.y) / (-z);
    return {
      x: (px + 1) * 0.5 * canvasW,
      y: (1 - (py + 1) * 0.5) * canvasH,
    };
  }

  // Get unique edges from indexed geometry or just triangles
  const edges = new Set();
  const getKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      edges.add(getKey(arr[i], arr[i + 1]));
      edges.add(getKey(arr[i + 1], arr[i + 2]));
      edges.add(getKey(arr[i + 2], arr[i]));
    }
  }

  const result = [];
  for (const key of edges) {
    const [a, b] = key.split('-').map(Number);
    const ax = positions.getX(a), ay = positions.getY(a), az = positions.getZ(a);
    const bx = positions.getX(b), by = positions.getY(b), bz = positions.getZ(b);
    const p1 = project(ax, ay, az);
    const p2 = project(bx, by, bz);
    if (p1 && p2) result.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }
  return result;
}

// Generate cube edges as 8 vertices + 12 edges, projected to 2D
export function projectCube(rotX, rotY, canvasW, canvasH, scale = 1) {
  const s = 0.5 * scale;
  const verts = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s,  s], [s, -s,  s], [s, s,  s], [-s, s,  s],
  ];
  const edgeIndices = [
    [0,1],[1,2],[2,3],[3,0], // back face
    [4,5],[5,6],[6,7],[7,4], // front face
    [0,4],[1,5],[2,6],[3,7], // connecting
  ];

  const euler = new THREE.Euler(rotX, rotY, 0, 'YXZ');
  const mat = new THREE.Matrix4().makeRotationFromEuler(euler);
  const dist = 3;
  const fov = 50;
  const fovRad = (fov * Math.PI) / 180;
  const f = 1 / Math.tan(fovRad / 2);
  const aspect = canvasW / canvasH;

  function project([vx, vy, vz]) {
    const v = new THREE.Vector3(vx, vy, vz).applyMatrix4(mat);
    const z = v.z - dist;
    if (z >= 0) return null;
    const px = (f * v.x) / (-z * aspect);
    const py = (f * v.y) / (-z);
    return {
      x: (px + 1) * 0.5 * canvasW,
      y: (1 - (py + 1) * 0.5) * canvasH,
    };
  }

  const projected = verts.map(project);
  const edges = [];
  for (const [a, b] of edgeIndices) {
    if (projected[a] && projected[b]) {
      edges.push({ x1: projected[a].x, y1: projected[a].y, x2: projected[b].x, y2: projected[b].y, vi: [a, b] });
    }
  }

  // Also return projected vertices for face diagonals
  return { edges, verts: projected };
}

// Get face diagonals for a projected cube (for the Krenz-style grid lines on faces)
export function cubeFaceDiagonals(projectedVerts) {
  const faces = [
    [0,1,2,3], // back
    [4,5,6,7], // front
    [0,1,5,4], // bottom
    [3,2,6,7], // top
    [0,3,7,4], // left
    [1,2,6,5], // right
  ];
  const diags = [];
  for (const [a, b, c, d] of faces) {
    const va = projectedVerts[a], vb = projectedVerts[b], vc = projectedVerts[c], vd = projectedVerts[d];
    if (va && vb && vc && vd) {
      diags.push({ x1: va.x, y1: va.y, x2: vc.x, y2: vc.y });
      diags.push({ x1: vb.x, y1: vb.y, x2: vd.x, y2: vd.y });
    }
  }
  return diags;
}
