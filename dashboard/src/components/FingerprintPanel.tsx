import { useState } from 'react';
import type { LiveSnapshot } from '../features/live';
import { modelFeatures } from '../features/model-features';

const missing = 'Chưa quan sát';
function observed(value: unknown) {
  return value == null
    ? missing
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
}
export function FingerprintPanel({ data }: { data: LiveSnapshot | null }) {
  const [view, setView] = useState<'signals' | 'features'>('signals');
  const [query, setQuery] = useState('');
  const features = modelFeatures.filter((f) =>
    `${f.key} ${f.name} ${f.meaning}`
      .toLocaleLowerCase('vi')
      .includes(query.toLocaleLowerCase('vi')),
  );
  return (
    <div className="fingerprint-explorer">
      <div
        className="fingerprint-switch"
        role="group"
        aria-label="Nội dung dấu vân tay"
      >
        <button
          type="button"
          className="button secondary"
          aria-pressed={view === 'signals'}
          onClick={() => setView('signals')}
        >
          Tín hiệu kết nối
        </button>
        <button
          type="button"
          className="button secondary"
          aria-pressed={view === 'features'}
          onClick={() => setView('features')}
        >
          12 feature dự kiến
        </button>
      </div>
      {view === 'signals' ? (
        <div className="live-fingerprints">
          <p>
            Tín hiệu thực được nối bằng session và connection ID. Dấu vân tay mô
            tả phần mềm kết nối, không xác định người dùng hay bot.
          </p>
          {!data ? (
            <p>
              Chưa kết nối dữ liệu. Danh mục 12 feature vẫn có thể xem; không
              hiển thị số mẫu.
            </p>
          ) : !data.connections?.length ? (
            <p>
              Chưa có kết nối gắn với request môn học. Hãy mở trang đăng ký để
              tạo quan sát.
            </p>
          ) : (
            data.connections.map((c) => {
              const requests = data.events.filter(
                (e) => e.connectionId === c.connectionId,
              );
              const fields: [string, unknown, string][] = [
                ['JA4', c.ja4, 'Fingerprint TLS với danh sách đã sắp xếp.'],
                [
                  'JA4_r',
                  c.ja4_r,
                  'Danh sách TLS thô đã sắp xếp, dùng để giải thích JA4.',
                ],
                ['JA4_o', c.ja4_o, 'Fingerprint giữ thứ tự TLS gốc.'],
                ['JA4_ro', c.ja4_ro, 'Danh sách TLS thô giữ thứ tự gốc.'],
                [
                  'HTTP protocol',
                  [...new Set(requests.map((e) => e.protocol))].join(', '),
                  'Giao thức thực của request, không phải danh sách ALPN được chào.',
                ],
                [
                  'TLS versions / ALPN / GREASE',
                  null,
                  'Chưa có trường riêng trong nguồn JSON của UI; không suy diễn từ hash.',
                ],
                [
                  'HTTP/2 capture',
                  c.h2?.status,
                  'Trạng thái quan sát phần đầu kết nối HTTP/2.',
                ],
                [
                  'SETTINGS',
                  c.h2?.settings,
                  'Các cặp ID/value đúng thứ tự client gửi.',
                ],
                [
                  'WINDOW_UPDATE',
                  c.h2?.windowIncrement,
                  'Increment đầu tiên ở cấp connection; đơn vị byte.',
                ],
                [
                  'PRIORITY',
                  c.h2?.priorities,
                  'Standalone PRIORITY: stream_id, dependency, exclusive, weight. [] là danh sách rỗng đã quan sát.',
                ],
                [
                  'HEADERS priority',
                  c.h2?.headersPriority,
                  'Priority metadata trong HEADERS, tách riêng standalone PRIORITY.',
                ],
                [
                  'Pseudo-header order',
                  c.h2?.pseudoHeaders,
                  'Thứ tự tên pseudo-header, không chứa giá trị header.',
                ],
                [
                  'Akamai text',
                  c.h2?.text,
                  'SETTINGS | WINDOW_UPDATE | PRIORITY | PSEUDO_ORDER.',
                ],
                [
                  'Akamai hash',
                  c.h2?.akamai,
                  'MD5 tương thích fingerprint, không phải chứng thực bảo mật.',
                ],
              ];
              return (
                <section
                  className="connection-fingerprint"
                  key={c.connectionId}
                  aria-label={`Kết nối ${c.connectionId}`}
                >
                  <h3>Kết nối {c.connectionId}</h3>
                  <p>
                    Chất lượng HTTP/2:{' '}
                    {c.h2?.reason ??
                      (c.h2?.akamai
                        ? 'Không có lỗi fingerprint'
                        : 'Chưa có lý do được ghi nhận; HTTP/1.x không có fingerprint H2')}
                    .
                  </p>
                  <dl className="signal-list">
                    {fields.map(([name, value, help]) => (
                      <div key={name}>
                        <dt>{name}</dt>
                        <dd>
                          <code>{observed(value)}</code>
                          <small>{help}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <details>
                    <summary>
                      Request liên quan ({requests.length} được giữ lại)
                    </summary>
                    <ul className="request-observations">
                      {requests.map((e) => (
                        <li key={e.id}>
                          <code>{e.id}</code>
                          <span>
                            {e.method} {e.route} · HTTP {e.status ?? 'chưa rõ'}{' '}
                            · {e.latencyMs.toFixed(2)} ms tại Gateway
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </section>
              );
            })
          )}
          <p>
            Chỉ giữ tối đa 300 request và 128 kết nối trong bộ nhớ. Đây chưa
            phải kho dữ liệu huấn luyện.
          </p>
        </div>
      ) : (
        <section aria-label="Danh mục feature model">
          <h3>12 feature dự kiến cho cửa sổ 5 giây</h3>
          <p>
            Danh mục giải thích từ kế hoạch. Chưa triển khai bộ tổng hợp 5 giây,
            chưa chốt đầy đủ công thức và chưa xuất CSV. Giá trị hiện tại của cả
            12 feature là chưa có, không phải 0.
          </p>
          <label className="feature-search">
            Tìm feature
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên cột hoặc ý nghĩa…"
            />
          </label>
          <p>
            {features.length}/12 feature · Mở từng mục để xem đơn vị và nguồn.
          </p>
          <div className="feature-catalog">
            {features.map((f) => (
              <details key={f.key}>
                <summary>
                  <code>{f.key}</code>
                  <span>{f.name}</span>
                  <span className="feature-status">Chưa tính</span>
                </summary>
                <p>{f.meaning}</p>
                <dl>
                  <dt>Giá trị hiện tại</dt>
                  <dd>— · Chưa triển khai</dd>
                  <dt>Đơn vị</dt>
                  <dd>{f.unit}</dd>
                  <dt>Nguồn cần có</dt>
                  <dd>{f.source}</dd>
                  <dt>Lý do chưa có giá trị</dt>
                  <dd>{f.gap}</dd>
                </dl>
              </details>
            ))}
          </div>
          {!features.length && <p>Không có feature khớp từ khoá.</p>}
          <details className="dataset-context">
            <summary>Các cột CSV dự kiến phục vụ đối soát</summary>
            <p>
              <code>
                schema_version, session_id, window_start, window_end,
                sample_count, capture_complete, missing_reason, window_label
              </code>
            </p>
            <p>
              Đây là metadata và nhãn dự kiến, chưa có CSV để tải. Session,
              nhãn, công cụ và ground truth không được tự đưa vào đầu vào model.
              JA4/H2 raw dùng đối chiếu; 12 feature là các đại lượng tổng hợp
              riêng.
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
