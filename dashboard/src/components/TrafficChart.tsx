import { traffic } from '../mocks/fixtures';

export function TrafficChart({
  values = traffic,
  live = false,
}: {
  values?: readonly number[];
  live?: boolean;
}) {
  const max = live ? Math.max(1, ...values) : 150;
  const points = values
    .map(
      (y, i) =>
        `${(i / Math.max(1, values.length - 1)) * 680},${165 - (y / max) * 145}`,
    )
    .join(' ');
  return (
    <div className="traffic-chart">
      <div className="chart-legend">
        <span>
          <i />
          Yêu cầu hoàn tất
        </span>
        <small>
          {live ? 'TRỰC TIẾP · 30 giây gần nhất' : 'DỮ LIỆU GIẢ LẬP · Mỗi giây'}
        </small>
      </div>
      <div className="chart-body">
        <div className="chart-scale">
          <span>{max}</span>
          <span>{((max * 2) / 3).toFixed(1)}</span>
          <span>{(max / 3).toFixed(1)}</span>
          <span>0</span>
        </div>
        <svg
          viewBox="0 0 680 180"
          role="img"
          aria-label={
            live
              ? 'Biểu đồ yêu cầu hoàn tất từ log Gateway trực tiếp'
              : 'Biểu đồ mẫu số yêu cầu hoàn tất, không phải lưu lượng trực tiếp'
          }
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#688c7a" stopOpacity=".28" />
              <stop offset="100%" stopColor="#688c7a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 65, 110, 165].map((y) => (
            <line
              key={y}
              x1="0"
              x2="680"
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeDasharray="3 5"
              opacity=".13"
            />
          ))}
          <polygon points={`0,180 ${points} 680,180`} fill="url(#chart-fill)" />
          <polyline
            points={points}
            fill="none"
            stroke="#487a66"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="chart-times">
        {live ? (
          <>
            <span>30 giây trước</span>
            <span>Vừa hoàn tất</span>
          </>
        ) : (
          <>
            <span>00:00</span>
            <span>00:05</span>
            <span>00:10</span>
            <span>00:15</span>
            <span>00:23</span>
          </>
        )}
      </div>
    </div>
  );
}
