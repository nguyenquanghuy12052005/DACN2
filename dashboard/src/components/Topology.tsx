import {
  Box,
  BrainCircuit,
  Database,
  Fingerprint,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Badge } from './ui';

export function Topology({ connected = false }: { connected?: boolean }) {
  return (
    <div
      className="topology"
      aria-label="Sơ đồ tĩnh: trình duyệt đến Gateway, backend và cơ sở dữ liệu; telemetry đến AI. Chưa có hoạt động trực tiếp."
    >
      <div className="topology-grid" aria-hidden="true" />
      <div className="topology-meta">
        <span>
          <i className="legend-line" />
          Đường yêu cầu
        </span>
        <span>
          <i className="legend-line dashed" />
          Quan sát / điều khiển
        </span>
        <Badge>{connected ? 'CHROME TRỰC TIẾP' : 'SƠ ĐỒ TĨNH'}</Badge>
      </div>
      <div className="flow-row">
        <div className="flow-node">
          <div className="node-icon">
            <UserRound size={24} />
          </div>
          <strong>Trình duyệt</strong>
          <small>
            {connected ? 'HTTPS trực tiếp' : 'Chưa xác định danh tính'}
          </small>
        </div>
        <div className="flow-link" aria-hidden="true">
          <span>HTTPS</span>
          <i />
        </div>
        <div className="flow-node gateway-node">
          <div className="node-icon">
            <ShieldCheck size={30} />
          </div>
          <strong>Go Gateway</strong>
          <small>TLS · HTTP/2 · chuyển tiếp</small>
          <span className="node-tag">
            <Fingerprint size={11} /> Thu dấu vân tay
          </span>
        </div>
        <div className="flow-link" aria-hidden="true">
          <span>Chuyển tiếp</span>
          <i />
        </div>
        <div className="flow-node">
          <div className="node-icon">
            <Box size={25} />
          </div>
          <strong>NestJS</strong>
          <small>{connected ? 'Windows · DB test' : 'Backend trên K3s'}</small>
        </div>
        <div className="flow-link last-link" aria-hidden="true">
          <span>SQL</span>
          <i />
        </div>
        <div className="flow-node db-node">
          <div className="node-icon">
            <Database size={24} />
          </div>
          <strong>PostgreSQL</strong>
          <small>Cơ sở dữ liệu</small>
        </div>
      </div>
      <div className="control-row">
        <span className="control-link" aria-hidden="true" />
        <div className="control-node">
          <BrainCircuit size={17} />
          <span>
            Phân tích AI <small>Chưa triển khai</small>
          </span>
          <Badge>CHƯA CÓ DỮ LIỆU</Badge>
        </div>
      </div>
      <div className="topology-foot">
        <span>
          {connected
            ? 'Luồng demo thật · hình tĩnh, chưa có animation yêu cầu'
            : 'Sơ đồ kiến trúc · chưa hiển thị yêu cầu trực tiếp'}
        </span>
        <span>Chặn & mở rộng: chưa triển khai</span>
      </div>
    </div>
  );
}
