import { useRef, useState } from 'react';
import { ArrowUpRight, BrainCircuit, Layers3, Radio } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { PreviewState } from '../app/App';
import {
  Badge,
  Metric,
  Panel,
  SectionTitle,
  Unavailable,
} from '../components/ui';
import { Topology } from '../components/Topology';
import { TrafficChart } from '../components/TrafficChart';
import { events } from '../mocks/fixtures';
import type { LiveState } from '../features/live';

const tabs = [
  { id: 'topology', label: 'Sơ đồ' },
  { id: 'traffic', label: 'Lưu lượng' },
  { id: 'events', label: 'Nhật ký yêu cầu' },
  { id: 'fingerprints', label: 'Dấu vân tay' },
] as const;
type Tab = (typeof tabs)[number]['id'];
export function Overview({
  mock,
  preview,
  onPreview,
  live = { snapshot: null, connected: false },
}: {
  mock: boolean;
  preview: PreviewState;
  onPreview: (s: PreviewState) => void;
  live?: LiveState;
}) {
  const [tab, setTab] = useState<Tab>('topology');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const showSamples = mock && preview === 'ready';
  const data = !mock && live.connected ? live.snapshot : null;
  const byId = new Map(data?.events.map((e) => [e.id, e]) ?? []);
  const rows = data
    ? data.events.map((e) => ({
        id: e.id,
        time: new Date(e.time).toLocaleTimeString('vi-VN'),
        method: e.method,
        route: e.route,
        status: e.status,
        result: e.result,
        latency: `${e.latencyMs.toFixed(2)} ms`,
      }))
    : events;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Tổng quan hệ thống<span className="heading-dot">.</span>
          </h1>
          <p>Theo dõi đường đi của yêu cầu và trạng thái từng thành phần.</p>
        </div>
        <NavLink className="button secondary" to="/demo">
          Thử đăng ký môn <ArrowUpRight size={16} />
        </NavLink>
      </div>
      <section className="glass metrics-strip" aria-label="Chỉ số hệ thống">
        <Metric
          name={mock ? 'Yêu cầu đến / giây' : 'Hoàn tất / giây'}
          description="Chưa có tín hiệu"
          mock={data?.completedRps != null}
          sample={String(data?.completedRps ?? '')}
          live={!!data}
        />
        <Metric
          name="Được chuyển / giây"
          description="Chưa có tín hiệu"
          mock={false}
        />
        <Metric
          name="Bị chặn / giây"
          description="Chưa có chính sách"
          mock={false}
        />
        <Metric
          name="Độ trễ p95"
          description="Chưa có dữ liệu"
          mock={showSamples || data?.p95Ms != null}
          sample={mock ? '4.37' : data?.p95Ms?.toFixed(2)}
          live={!!data}
          unit="ms"
        />
        <Metric
          name="Trạng thái Gateway"
          description="Chưa quan sát"
          mock={!!data && data.gatewayHealth !== null}
          sample={data?.gatewayHealth ? 'Có phản hồi' : 'Không phản hồi'}
          live={!!data}
        />
        <Metric name="Pod sẵn sàng" description="Chưa quan sát" mock={false} />
      </section>
      <div className="overview-layout">
        <div className="overview-main">
          <Panel className="detail-panel">
            <SectionTitle
              title="Quan sát hệ thống"
              aside={
                <Badge tone="neutral">
                  <Radio size={13} /> {data ? 'Log trực tiếp' : 'Chưa kết nối'}
                </Badge>
              }
            />
            <div className="detail-toolbar">
              <div
                className="detail-tabs"
                role="tablist"
                aria-label="Thông tin quan sát"
              >
                {tabs.map((item, index) => (
                  <button
                    key={item.id}
                    id={`tab-${item.id}`}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    role="tab"
                    aria-selected={tab === item.id}
                    aria-controls={`panel-${item.id}`}
                    tabIndex={tab === item.id ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(e) => {
                      if (
                        !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                          e.key,
                        )
                      )
                        return;
                      e.preventDefault();
                      const next =
                        e.key === 'Home'
                          ? 0
                          : e.key === 'End'
                            ? tabs.length - 1
                            : (index +
                                (e.key === 'ArrowRight' ? 1 : -1) +
                                tabs.length) %
                              tabs.length;
                      setTab(tabs[next].id);
                      tabRefs.current[next]?.focus();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="preview-select">
                Trạng thái mẫu
                <select
                  aria-label="Trạng thái mẫu"
                  value={preview}
                  disabled={!mock}
                  onChange={(e) => onPreview(e.target.value as PreviewState)}
                >
                  <option value="ready">Có dữ liệu</option>
                  <option value="loading">Đang tải</option>
                  <option value="empty">Trống</option>
                  <option value="offline">Mất kết nối</option>
                </select>
              </label>
            </div>
            <div
              className="detail-content"
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              tabIndex={0}
            >
              {tab === 'topology' ? (
                <Topology connected={!!data} />
              ) : tab === 'fingerprints' ? (
                data ? (
                  <div className="live-fingerprints">
                    <p>
                      Dấu vân tay từ kết nối trực tiếp tới Gateway. Liên kết
                      bằng mã kết nối, không đoán theo IP hoặc thời gian.
                    </p>
                    {data.connections?.length ? (
                      data.connections.map((c) => (
                        <div
                          className="connection-fingerprint"
                          key={c.connectionId}
                        >
                          <strong>Kết nối {c.connectionId}</strong>
                          <code>JA4: {c.ja4 ?? 'Chưa quan sát'}</code>
                          <p>
                            Giao thức:{' '}
                            {[
                              ...new Set(
                                data.events
                                  .filter(
                                    (e) => e.connectionId === c.connectionId,
                                  )
                                  .map((e) => e.protocol),
                              ),
                            ].join(', ')}
                          </p>
                          <p>
                            HTTP/2: {c.h2?.status ?? 'Chưa quan sát'} · Akamai:{' '}
                            {c.h2?.akamai ??
                              `Chưa đủ dữ liệu (${c.h2?.reason ?? 'chưa có quan sát'})`}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có quan sát JA4.</p>
                    )}
                    <p>
                      Mã kết nối dùng chung với nhật ký yêu cầu. Dấu vân tay mô
                      tả phần mềm kết nối, không kết luận người hay bot.
                    </p>
                  </div>
                ) : (
                  <Unavailable
                    title="Chưa có nguồn dấu vân tay"
                    description="JA4 và HTTP/2 mô tả cách kết nối. Chưa đủ dữ liệu để gán cho từng người hoặc bot."
                  />
                )
              ) : !showSamples && !data ? (
                preview === 'loading' && mock ? (
                  <div role="status" className="loading-state">
                    <div className="skeleton" />
                    <p>Xem trước trạng thái tải · chưa gửi yêu cầu mạng.</p>
                  </div>
                ) : (
                  <Unavailable
                    title={
                      mock && preview === 'empty'
                        ? 'Chưa có sự kiện trong mẫu'
                        : 'Chưa kết nối dữ liệu'
                    }
                    description={
                      mock
                        ? 'Đây là trạng thái xem trước giao diện.'
                        : 'Chưa có nguồn trực tiếp. Không hiển thị dữ liệu mẫu.'
                    }
                  />
                )
              ) : tab === 'traffic' ? (
                <>
                  <TrafficChart
                    values={data ? data.series.map((p) => p.value) : undefined}
                    live={!!data}
                  />
                  <p className="chart-note">
                    Số yêu cầu hoàn tất không đồng nghĩa với số yêu cầu đến,
                    được chuyển tiếp hoặc bị chặn.
                  </p>
                </>
              ) : (
                <div className="events-wrap">
                  <table>
                    <caption className="sr-only">
                      {data
                        ? 'Sự kiện thực từ Gateway trong phiên demo'
                        : 'Sự kiện giả lập để xem giao diện'}
                    </caption>
                    <thead>
                      <tr>
                        <th>Thời điểm</th>
                        <th>Yêu cầu</th>
                        {data && <th>Kết nối</th>}
                        <th>Kết quả</th>
                        <th>Độ trễ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => (
                        <tr key={e.id}>
                          <td className="mono muted">{e.time}</td>
                          <td>
                            <span className="method">{e.method}</span>
                            <code title={data ? e.id : undefined}>
                              {e.route}
                            </code>
                          </td>
                          {data && (
                            <td className="mono">
                              {byId.get(e.id)?.connectionId ?? '—'} ·{' '}
                              {byId.get(e.id)?.protocol ?? 'Chưa rõ'}
                            </td>
                          )}
                          <td>
                            <span
                              className={`http-code ${e.status === 200 ? 'success' : e.status === 502 ? 'failure' : 'conflict'}`}
                            >
                              {e.status}
                            </span>
                            <span className="event-result">{e.result}</span>
                          </td>
                          <td className="mono">{e.latency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="quiet-note">
                    {data
                      ? `${data.events.length} sự kiện giữ lại · bỏ/loại ${data.discarded} · Không gồm health probe. Di chuột đường dẫn để xem request ID.`
                      : 'Dữ liệu giả lập'}{' '}
                    · lỗi 502 không phải quyết định chặn bot.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>
        <aside className="overview-side">
          <Panel className="insight-card">
            <SectionTitle
              title="Phân tích AI"
              aside={<BrainCircuit size={22} />}
            />
            <div className="ai-placeholder">
              <span className="status-dot" />
              Mô hình chưa kết nối
            </div>
            <p>Kết quả phân loại sẽ xuất hiện khi có dịch vụ AI.</p>
            <details className="context-help">
              <summary>Hiểu kết quả AI</summary>
              <small>
                Phân loại cả cửa sổ lưu lượng khác với quyết định chặn từng
                client.
              </small>
            </details>
          </Panel>
          <Panel className="layers-panel">
            <SectionTitle
              title="Các thành phần"
              aside={<Layers3 size={20} />}
            />
            <ul className="layer-list">
              {['Go Gateway', 'Backend NestJS', 'Hạ tầng K3s'].map(
                (name, index) => (
                  <li key={name}>
                    <span>{name}</span>
                    <Badge>
                      {!data
                        ? 'Chưa quan sát'
                        : index === 2
                          ? 'Không dùng ở phiên này'
                          : (
                                index === 0
                                  ? data.gatewayHealth
                                  : data.backendHealth
                              )
                            ? 'HTTP 200'
                            : 'Không phản hồi'}
                    </Badge>
                  </li>
                ),
              )}
              <li>
                <span>AI & chính sách</span>
                <Badge>Chưa xây dựng</Badge>
              </li>
            </ul>
            <details className="context-help">
              <summary>Ý nghĩa trạng thái</summary>
              <p className="quiet-note">
                Chỉ hiển thị trạng thái hoạt động khi có bằng chứng thực tế.
              </p>
            </details>
          </Panel>
        </aside>
      </div>
    </>
  );
}
