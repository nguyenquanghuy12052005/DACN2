import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  FlaskConical,
  LockKeyhole,
  ShieldAlert,
  Square,
  Users,
  Zap,
} from 'lucide-react';
import { Badge, Panel, SectionTitle } from '../components/ui';

const scenarios = [
  {
    id: 'normal',
    name: 'Bình thường',
    description: 'Các yêu cầu thông thường với nhịp ổn định.',
    icon: Activity,
    tone: 'green',
  },
  {
    id: 'flash',
    name: 'Truy cập tăng đột biến',
    description: 'Nhiều người dùng hợp lệ truy cập cùng lúc.',
    icon: Users,
    tone: 'amber',
  },
  {
    id: 'ddos',
    name: 'Mô phỏng DDoS L7',
    description: 'Lưu lượng giả lập có giới hạn trong lab cô lập.',
    icon: Zap,
    tone: 'coral',
  },
  {
    id: 'mixed',
    name: 'Lưu lượng hỗn hợp',
    description: 'Kết hợp lưu lượng hợp lệ và đáng ngờ.',
    icon: ShieldAlert,
    tone: 'blue',
  },
];
export function Simulation() {
  const [selected, setSelected] = useState('normal');
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THỬ NGHIỆM CÓ KIỂM SOÁT</p>
          <h1>
            Phòng mô phỏng<span className="heading-dot">.</span>
          </h1>
          <p>Chọn và xem trước kịch bản thử nghiệm.</p>
        </div>
        <Badge tone="amber">
          <LockKeyhole size={13} /> MÔI TRƯỜNG THỬ NGHIỆM CÔ LẬP
        </Badge>
      </div>
      <div className="simulation-layout">
        <Panel>
          <SectionTitle
            eyebrow="01 / CHỌN KỊCH BẢN"
            title="Kịch bản lưu lượng"
          />
          <div
            className="scenario-grid"
            role="radiogroup"
            aria-label="Kịch bản mẫu"
          >
            {scenarios.map(({ id, name, description, icon: Icon, tone }) => (
              <label
                key={id}
                className={`scenario-card ${tone} ${selected === id ? 'selected' : ''}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="scenario"
                  value={id}
                  checked={id === selected}
                  onChange={() => setSelected(id)}
                />
                <span className="scenario-top">
                  <Icon size={26} strokeWidth={1.3} />
                  <span className="radio-mark">
                    {id === selected && <Check size={12} />}
                  </span>
                </span>
                <strong>{name}</strong>
                <p>{description}</p>
                <Badge>XEM TRƯỚC</Badge>
              </label>
            ))}
          </div>
          <div className="plain-notice inset">
            <ShieldAlert size={20} />
            <p>
              Tên kịch bản mô tả tải dự kiến, không phải kết luận của AI hay
              bằng chứng nhận diện bot.
            </p>
          </div>
        </Panel>
        <Panel className="run-panel">
          <SectionTitle
            eyebrow="02 / ĐIỀU KHIỂN PHIÊN"
            title="Thiết lập thử nghiệm"
          />
          <label>
            Mục tiêu được phép
            <input value="Lab nội bộ · chưa kết nối" readOnly />
          </label>
          <div className="controls-grid">
            <label>
              Tốc độ (yêu cầu/giây)
              <input placeholder="Chưa cấu hình" disabled />
            </label>
            <label>
              Thời lượng (giây)
              <input placeholder="Chưa cấu hình" disabled />
            </label>
          </div>
          <label>
            Yêu cầu đồng thời
            <input placeholder="Cần giới hạn phía máy chủ" disabled />
          </label>
          <div className="session-status">
            <span className="status-dot" />
            Chưa có bộ điều khiển
          </div>
          <button className="button primary full" disabled>
            <LockKeyhole size={15} /> Bắt đầu kịch bản
          </button>
          <button className="button secondary full" disabled>
            <Square size={14} /> Dừng kịch bản
          </button>
          <p className="quiet-note">
            Chưa phát tải. Cần bộ điều khiển máy chủ có giới hạn và cơ chế dừng
            đã kiểm chứng.
          </p>
        </Panel>
      </div>
      <Panel className="simulation-bottom">
        <div className="card-icon">
          <FlaskConical size={25} />
        </div>
        <div>
          <p className="eyebrow">THỬ NGHIỆM CÓ GIỚI HẠN</p>
          <h2>Chỉ thử nghiệm trên mục tiêu lab được phép.</h2>
          <p>
            Mục tiêu cố định <ArrowRight size={12} /> Phiên có giới hạn{' '}
            <ArrowRight size={12} /> Dừng khẩn cấp <ArrowRight size={12} /> Dọn
            dẹp sau thử nghiệm
          </p>
        </div>
        <Badge>BỘ ĐIỀU KHIỂN DỰ KIẾN</Badge>
      </Panel>
    </>
  );
}
