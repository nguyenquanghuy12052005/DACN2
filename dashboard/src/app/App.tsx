import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Moon,
  Settings2,
  ShieldCheck,
  Sun,
  UserRound,
  X,
  Waves,
} from 'lucide-react';
import { Badge } from '../components/ui';
import { Overview } from '../pages/Overview';
import { Demo } from '../pages/Demo';
import { Simulation } from '../pages/Simulation';
import { liveAvailable, useLive } from '../features/live';

export type Source = 'mock' | 'live';
export type PreviewState = 'ready' | 'loading' | 'empty' | 'offline';
const navigation = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/demo', label: 'Trang đăng ký', icon: UserRound },
  { to: '/dashboard/simulation', label: 'Phòng mô phỏng', icon: FlaskConical },
];

function initialTheme() {
  try {
    return localStorage.getItem('dacn2-theme') === 'dark';
  } catch {
    return false;
  }
}
export function App() {
  const [dark, setDark] = useState(initialTheme);
  const [reduce, setReduce] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [source, setSource] = useState<Source>(() =>
    liveAvailable() ? 'live' : 'mock',
  );
  const [preview, setPreview] = useState<PreviewState>('ready');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('dacn2-theme', dark ? 'dark' : 'light');
    } catch {
      /* Private browsing: keep session preference. */
    }
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? 'reduced' : 'full';
  }, [reduce]);
  const mock = source === 'mock';
  const live = useLive(!mock);
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <div className="ambient-orb orb-one" aria-hidden="true" />
      <div className="ambient-orb orb-two" aria-hidden="true" />
      <header className="topbar glass">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={23} />
          </span>
          <span>
            DACN<span className="brand-number">2</span>
            <small>TRUNG TÂM GIÁM SÁT</small>
          </span>
        </div>
        <div className="toolbar-middle">
          <span className="environment">MÔI TRƯỜNG LAB</span>
          <span className="divider" />
          <span className="connection-status">
            <span className="status-dot" />
            {live.connected ? 'Đang nhận dữ liệu thật' : 'Chưa kết nối dữ liệu'}
          </span>
        </div>
        <div className="toolbar-actions">
          <button
            className="icon-button"
            aria-label={dark ? 'Dùng giao diện sáng' : 'Dùng giao diện tối'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <details className="preferences">
            <summary className="icon-button" aria-label="Cài đặt hiển thị">
              <Settings2 size={19} />
            </summary>
            <div className="settings-popover glass">
              <strong>Tuỳ chọn hiển thị</strong>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={reduce}
                  onChange={(e) => setReduce(e.target.checked)}
                />
                Giảm chuyển động
              </label>
              <p>Tôn trọng cả cài đặt giảm chuyển động của hệ thống.</p>
            </div>
          </details>
          <span className="avatar" title="Người vận hành lab">
            D
          </span>
          <button
            className="icon-button mobile-menu"
            aria-label={mobileOpen ? 'Đóng điều hướng' : 'Mở điều hướng'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className={`sidebar glass ${mobileOpen ? 'open' : ''}`}>
          <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
          <nav aria-label="Điều hướng chính">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={19} />
                <span>{label}</span>
                <ArrowUpRight className="nav-arrow" size={14} />
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="side-note">
              <Waves size={24} />
              <strong>
                Quan sát. Thấu hiểu.
                <br />
                Bảo vệ.
              </strong>
              <p>Hiểu rõ từng lớp của hệ thống.</p>
            </div>
            <div className="sidebar-footer">
              <Activity size={15} />
              <span>
                {liveAvailable() ? 'Phiên demo trực tiếp' : 'Bản xem trước'}
              </span>
            </div>
          </div>
        </aside>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="source-banner">
            <div>
              <Badge tone={mock ? 'amber' : 'neutral'}>
                {mock
                  ? 'DỮ LIỆU MẪU'
                  : live.connected
                    ? 'TRỰC TIẾP · CHROME → GATEWAY'
                    : 'TRỰC TIẾP · CHƯA KẾT NỐI'}
              </Badge>
              <span>
                {mock
                  ? 'DỮ LIỆU GIẢ LẬP · Chỉ để xem giao diện.'
                  : live.connected
                    ? `Chrome → HTTPS Gateway → NestJS Windows → DB test · cập nhật ${new Date(live.snapshot!.observedAt).toLocaleTimeString('vi-VN')}`
                    : 'Chưa kết nối nguồn trực tiếp. Không thay bằng dữ liệu mẫu.'}
              </span>
            </div>
            <label className="source-select">
              Nguồn dữ liệu
              <select
                aria-label="Nguồn dữ liệu"
                value={source}
                onChange={(e) => setSource(e.target.value as Source)}
              >
                <option value="mock">Mẫu giao diện</option>
                <option value="live">
                  {liveAvailable()
                    ? 'Trực tiếp từ Chrome'
                    : 'Trực tiếp (chưa có)'}
                </option>
                <option value="replay" disabled>
                  Phát lại (dự kiến)
                </option>
              </select>
            </label>
          </div>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <Overview
                  mock={mock}
                  preview={preview}
                  onPreview={setPreview}
                  live={live}
                />
              }
            />
            <Route path="/demo" element={<Demo mock={mock} live={live} />} />
            <Route path="/dashboard/simulation" element={<Simulation />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="*"
              element={
                <div className="not-found glass">
                  <h1>Không tìm thấy trang</h1>
                  <NavLink to="/dashboard">Về trang tổng quan</NavLink>
                </div>
              }
            />
          </Routes>
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} /> Lab cô lập · Chỉ thử nghiệm nội bộ
            </span>
            <span>DACN2 / Trung tâm giám sát</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
