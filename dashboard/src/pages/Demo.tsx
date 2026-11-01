import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  LockKeyhole,
} from 'lucide-react';
import { Badge, Panel, SectionTitle, Unavailable } from '../components/ui';
import { courses } from '../mocks/fixtures';
import {
  liveAvailable,
  liveRequest,
  type Course,
  type LiveState,
} from '../features/live';

export function Demo({
  mock,
  live = { snapshot: null, connected: false },
}: {
  mock: boolean;
  live?: LiveState;
}) {
  return mock ? <MockDemo /> : <LiveDemo live={live} />;
}
function MockDemo() {
  const [selected, setSelected] = useState<string>(courses[0].id);
  const [studentCode, setStudentCode] = useState('');
  const [previewed, setPreviewed] = useState(false);
  const course = courses.find((c) => c.id === selected)!;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TRẢI NGHIỆM NGƯỜI DÙNG</p>
          <h1>
            Đăng ký học phần<span className="heading-dot">.</span>
          </h1>
          <p>Chọn môn học và xem trước yêu cầu đăng ký.</p>
        </div>
        <Badge>
          <GraduationCap size={14} /> ĐĂNG KÝ HỌC PHẦN
        </Badge>
      </div>
      <div className="demo-layout">
        <Panel className="course-panel">
          <SectionTitle
            eyebrow="DANH SÁCH MÔN HỌC"
            title="Chọn môn bạn muốn học"
            aside={<Badge tone="amber">MÔN HỌC MẪU</Badge>}
          />
          <div className="course-grid">
            {courses.map((c) => (
              <button
                key={c.id}
                className={`course-card ${c.tone} ${selected === c.id ? 'selected' : ''}`}
                aria-pressed={selected === c.id}
                onClick={() => {
                  setSelected(c.id);
                  setPreviewed(false);
                }}
              >
                <span className="course-top">
                  <BookOpen size={24} strokeWidth={1.4} />
                  <span className="course-code">{c.code}</span>
                </span>
                <span className="eyebrow">{c.category}</span>
                <strong>{c.name}</strong>
                <span className="seat-line">
                  {c.seats ? `${c.seats} chỗ còn lại` : 'Đã hết chỗ'}
                  {selected === c.id && <Check size={16} />}
                </span>
                <span className="seat-track">
                  <span
                    style={{
                      width: `${(100 * (c.capacity - c.seats)) / c.capacity}%`,
                    }}
                  />
                </span>
                <small>Dữ liệu mẫu · {c.capacity} chỗ tổng cộng</small>
              </button>
            ))}
          </div>
          <div className="client-path">
            <span>Trình duyệt</span>
            <ArrowRight size={15} />
            <span>Gateway</span>
            <ArrowRight size={15} />
            <span>Backend</span>
            <ArrowRight size={15} />
            <span>Cơ sở dữ liệu</span>
          </div>
          <p className="quiet-note">
            Luồng xử lý dự kiến · Kết nối API ở UI-03.
          </p>
        </Panel>
        <Panel className="registration-panel">
          <div className="card-icon">
            <GraduationCap size={25} />
          </div>
          <p className="eyebrow">THAO TÁC ĐĂNG KÝ</p>
          <h2>Xem trước đăng ký</h2>
          <p>Biểu mẫu xem trước, chưa gửi hoặc lưu đăng ký.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPreviewed(true);
            }}
          >
            <label>
              Môn đã chọn
              <input readOnly value={`${course.code} · ${course.name}`} />
            </label>
            <label htmlFor="student-code">Mã người tham gia giả lập</label>
            <input
              id="student-code"
              autoComplete="off"
              maxLength={30}
              pattern="[A-Za-z0-9_-]{1,30}"
              value={studentCode}
              onChange={(e) => {
                setStudentCode(e.target.value);
                setPreviewed(false);
              }}
              placeholder="Ví dụ: DEMO001"
              required
            />
            <small>
              1–30 chữ cái không dấu, số, dấu gạch dưới hoặc gạch ngang.
            </small>
            <button className="button primary full" type="submit">
              Xem trước yêu cầu <ArrowRight size={16} />
            </button>
            <button className="button secondary full" type="button" disabled>
              <LockKeyhole size={15} /> Đăng ký qua Gateway · chưa kết nối
            </button>
          </form>
          {previewed && (
            <div role="status" className="request-preview">
              <strong>Chỉ xem trước — chưa gửi yêu cầu HTTP</strong>
              <code>POST /courses/:id/registrations</code>
              <p>
                Nội dung gửi gồm studentCode. Chưa có phản hồi thực hoặc mã yêu
                cầu từ Gateway.
              </p>
            </div>
          )}
        </Panel>
      </div>
      <Panel className="plain-notice">
        <LockKeyhole size={19} />
        <div>
          <strong>Thao tác thử nghiệm trong lab.</strong>
          <p>
            Dùng mã giả lập, không dùng tài khoản hay mật khẩu. Đăng ký thật sẽ
            đi qua Gateway.
          </p>
        </div>
      </Panel>
    </>
  );
}

function LiveDemo({ live }: { live: LiveState }) {
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [selected, setSelected] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof liveRequest>
  > | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!live.connected) return;
    const abort = new AbortController();
    liveRequest('/courses', undefined, abort.signal)
      .then((response) => {
        if (abort.signal.aborted) return;
        if (response.status !== 200 || !Array.isArray(response.body))
          throw Error('Không đọc được danh sách môn.');
        const items = response.body as Course[];
        setCatalog(items);
        setSelected((previous) =>
          items.some((c) => c.id === previous)
            ? previous
            : (items[0]?.id ?? ''),
        );
        setError('');
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError('Không đọc được môn học từ Gateway.');
      });
    return () => abort.abort();
  }, [live.connected]);
  async function register() {
    if (!selected || pending || !live.connected) return;
    setPending(true);
    setError('');
    setResult(null);
    controller.current = new AbortController();
    let confirmed = false;
    try {
      const response = await liveRequest(
        `/courses/${selected}/registrations`,
        { studentCode },
        controller.current.signal,
      );
      setResult(response);
      confirmed = true;
      const refreshed = await liveRequest('/courses');
      if (refreshed.status === 200 && Array.isArray(refreshed.body))
        setCatalog(refreshed.body as Course[]);
    } catch {
      setError(
        confirmed
          ? 'Đã nhận phản hồi đăng ký, nhưng chưa tải lại được số chỗ.'
          : 'Chưa xác nhận kết quả. Đăng ký có thể đã được lưu; không tự gửi lại.',
      );
    } finally {
      setPending(false);
    }
  }
  const course = catalog.find((c) => c.id === selected);
  const body = result?.body as { code?: string; message?: string } | undefined;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Đăng ký trực tiếp<span className="heading-dot">.</span>
          </h1>
          <p>
            Yêu cầu thật qua Gateway ·{' '}
            {live.snapshot?.database ?? 'chưa kết nối DB'} ·{' '}
            {live.snapshot?.persistent
              ? 'giữ đăng ký sau khi dừng phiên.'
              : 'fixture QA được dọn khi dừng.'}
          </p>
        </div>
        <Badge tone="amber">HTTPS TRỰC TIẾP</Badge>
      </div>
      <div className="demo-layout">
        <Panel>
          <SectionTitle
            title="Danh sách môn học"
            aside={
              <Badge>{live.connected ? 'API thực' : 'Chưa kết nối'}</Badge>
            }
          />
          {!live.connected ? (
            <Unavailable
              description={
                liveAvailable()
                  ? 'Đang chờ bộ nối. Số liệu cũ không được xem là trạng thái hiện tại.'
                  : 'Chạy node scripts/dashboard-live.cjs để mở phiên demo trực tiếp.'
              }
            />
          ) : catalog.length ? (
            <div className="course-grid">
              {catalog.map((c) => (
                <button
                  key={c.id}
                  className={`course-card green ${selected === c.id ? 'selected' : ''}`}
                  aria-pressed={selected === c.id}
                  onClick={() => {
                    setSelected(c.id);
                    setResult(null);
                    setError('');
                  }}
                >
                  <span className="course-top">
                    <BookOpen size={24} />
                    <span className="course-code">ID {c.id}</span>
                  </span>
                  <span className="eyebrow">
                    DỮ LIỆU THẬT · {live.snapshot?.database ?? 'CHƯA KẾT NỐI'}
                  </span>
                  <strong>{c.name}</strong>
                  <span className="seat-line">
                    {c.availableSeats} chỗ còn lại{' '}
                    {selected === c.id && <Check size={16} />}
                  </span>
                  <span className="seat-track">
                    <span
                      style={{
                        width: `${(100 * c.registeredCount) / c.capacity}%`,
                      }}
                    />
                  </span>
                  <small>
                    {c.registeredCount}/{c.capacity} chỗ đã đăng ký
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <Unavailable description="Đang đọc dữ liệu qua Gateway…" />
          )}
          <p className="quiet-note">
            Trình duyệt → HTTPS Go Gateway → NestJS Windows → PostgreSQL. Không
            có K3s trong phiên nhẹ này.{' '}
            {live.snapshot?.persistent
              ? 'Ctrl+C chỉ dừng dịch vụ, giữ nguyên môn học và đăng ký.'
              : 'Ctrl+C dọn fixture QA của phiên.'}
          </p>
        </Panel>
        <Panel className="registration-panel">
          <h2>Đăng ký học phần</h2>
          <p>
            Thao tác được backend lưu vào{' '}
            {live.snapshot?.database ?? 'DB của phiên'}.{' '}
            {live.snapshot?.persistent
              ? 'Cùng mã và cùng môn đã đăng ký sẽ trả lỗi trùng, kể cả qua phiên mới.'
              : 'Đây là phiên QA tạm thời.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void register();
            }}
          >
            <label>
              Môn đã chọn
              <input value={course?.name ?? 'Chưa có môn'} readOnly />
            </label>
            <label htmlFor="live-student-code">Mã người tham gia giả lập</label>
            <input
              id="live-student-code"
              required
              maxLength={30}
              pattern="[A-Za-z0-9_-]{1,30}"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="Ví dụ: DEMO001"
              autoComplete="off"
              disabled={!live.connected || pending}
            />
            <small>
              Chữ cái không dấu, số, dấu gạch dưới hoặc gạch ngang. Mã chỉ dùng
              trong lab.
            </small>
            <button
              className="button primary full"
              type="submit"
              disabled={!live.connected || pending || !course}
            >
              {pending ? 'Đang gửi…' : 'Đăng ký qua Gateway'}
            </button>
          </form>
          {error && (
            <p role="alert" className="request-preview">
              {error}
            </p>
          )}
          {result && (
            <div role="status" className="request-preview">
              <strong>
                HTTP {result.status} ·{' '}
                {result.status === 201
                  ? 'Đăng ký thành công'
                  : body?.code === 'ALREADY_REGISTERED'
                    ? 'Mã này đã đăng ký môn'
                    : body?.code === 'COURSE_FULL'
                      ? 'Môn học đã hết chỗ'
                      : 'Backend từ chối hoặc có lỗi'}
              </strong>
              <p>
                Mã yêu cầu:{' '}
                <code>{result.requestId ?? 'Không có — kiểm tra bộ nối'}</code>
              </p>
              <p>
                Kết nối {result.connectionId ?? 'chưa rõ'} · Giao thức{' '}
                {result.protocol ?? 'chưa rõ'}
              </p>
              <p>
                Thời gian từ trình duyệt: {result.elapsedMs.toFixed(1)} ms (khác
                độ trễ Gateway).
              </p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
