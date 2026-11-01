export default function ScoreDisplay({ result, onRetry, onNext }) {
  if (!result) return null;
  const { score, coverage, precision, feedback } = result;

  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  const gradeColor = score >= 85 ? '#22c55e' : score >= 70 ? '#3b82f6' : score >= 55 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      padding: 20, background: '#f9f9f9', borderRadius: 8,
      border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          fontSize: 48, fontWeight: 700, color: gradeColor,
          fontFamily: 'Georgia, serif',
        }}>{grade}</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{score}/100</div>
          <div style={{ fontSize: 13, color: '#666' }}>Overall score</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <Stat label="Coverage" value={coverage} hint="Did you draw all required lines?" />
        <Stat label="Precision" value={precision} hint="How close to the reference?" />
      </div>

      {feedback && (
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, borderTop: '1px solid #e5e5e5', paddingTop: 10 }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRetry} style={btnStyle('#fff', '#1a1a1a')}>Try again</button>
        {onNext && <button onClick={onNext} style={btnStyle('#1a1a1a', '#fff')}>Next exercise →</button>}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ height: 6, background: '#e5e5e5', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${value}%`, background: '#3b82f6', borderRadius: 3, transition: 'width 0.6s' }} />
      </div>
      <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{value}%  <span style={{ color: '#aaa' }}>{hint}</span></div>
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc',
    background: bg, color, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  };
}
