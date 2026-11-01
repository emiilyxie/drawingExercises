import { useState } from 'react';
import ExtrusionExercise from './exercises/extrusion/ExtrusionExercise';
import CubeGridExercise from './exercises/cubeGrid/CubeGridExercise';
import CylinderExercise from './exercises/cylinder/CylinderExercise';
import BoxCompositionExercise from './exercises/boxComposition/BoxCompositionExercise';
import RotationExercise from './exercises/rotation/RotationExercise';

const EXERCISES = [
  {
    id: 'extrusion', num: 11, label: 'Extrusion',
    desc: 'Take a 2D shape and push it through space.',
    component: ExtrusionExercise,
  },
  {
    id: 'cubeGrid', num: 12, label: 'Cube Grid',
    desc: 'Draw cubes at systematic azimuth/elevation angles.',
    component: CubeGridExercise,
  },
  {
    id: 'cylinder', num: 13, label: 'Cylinders',
    desc: 'Ellipses and axial alignment in 3D space.',
    component: CylinderExercise,
  },
  {
    id: 'boxComposition', num: 14, label: 'Box Compositions',
    desc: 'Overlapping boxes in perspective — depth and occlusion.',
    component: BoxCompositionExercise,
  },
  {
    id: 'rotation', num: 15, label: 'Rotation',
    desc: 'Redraw a cube at incremental rotation steps.',
    component: RotationExercise,
  },
];

export default function App() {
  const [activeId, setActiveId] = useState(null);
  const [scores, setScores] = useState({});

  const active = EXERCISES.find(e => e.id === activeId);
  const ExerciseComponent = active?.component;

  function handleComplete(id, score) {
    setScores(prev => ({ ...prev, [id]: score }));
  }

  if (active && ExerciseComponent) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', padding: 24 }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <button
            onClick={() => setActiveId(null)}
            style={{ marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, padding: '4px 0' }}
          >← Back to exercises</button>
          <ExerciseComponent onComplete={(score) => handleComplete(active.id, score)} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
            Drawing Exercises
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: 15 }}>
            Form construction · Levels 3 & 4 · Mathematical grading
          </p>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa' }}>
            LV3 · Form Construction
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXERCISES.map((ex) => {
            const score = scores[ex.id];
            const scoreColor = score == null ? '#ccc' : score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <button
                key={ex.id}
                onClick={() => setActiveId(ex.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 8,
                  border: '1px solid #e5e5e5', background: '#fafafa',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#bbb', minWidth: 22, fontFamily: 'monospace' }}>
                  {ex.num}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{ex.label}</div>
                  <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{ex.desc}</div>
                </div>
                {score != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{score}/100</span>
                )}
                <span style={{ color: '#ddd', fontSize: 18 }}>›</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 36, padding: 16, background: '#f9f9f9', borderRadius: 8, fontSize: 12, color: '#999', lineHeight: 1.7 }}>
          <strong style={{ color: '#666' }}>Grading:</strong> Each exercise generates a 3D reference projection.
          Your strokes are scored on coverage (did you draw all edges?) and precision (how close to the reference?).
          Tolerance ≈ 14px. Use ⌘Z to undo.
        </div>
      </div>
    </div>
  );
}
