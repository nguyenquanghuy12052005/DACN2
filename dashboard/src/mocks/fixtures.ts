// Deterministic DESIGN FIXTURES. Never consumed as live or recorded evidence.
export const traffic = [
  18, 24, 19, 34, 28, 48, 43, 61, 51, 32, 39, 50, 73, 60, 54, 67, 83, 70, 75,
  64, 89, 79, 97, 84,
];
export const courses = [
  {
    id: 'sample-1',
    code: 'CS101',
    name: 'Nhập môn lập trình',
    category: 'CƠ SỞ',
    seats: 24,
    capacity: 60,
    tone: 'green',
  },
  {
    id: 'sample-2',
    code: 'CS204',
    name: 'Mạng máy tính',
    category: 'HỆ THỐNG',
    seats: 12,
    capacity: 40,
    tone: 'amber',
  },
  {
    id: 'sample-3',
    code: 'CS305',
    name: 'Hệ cơ sở dữ liệu',
    category: 'DỮ LIỆU',
    seats: 0,
    capacity: 40,
    tone: 'blue',
  },
] as const;
export const events = [
  {
    id: 'design-003',
    time: '00:08',
    method: 'GET',
    route: '/courses',
    status: 200,
    result: 'Backend phản hồi',
    latency: '2.65 ms',
  },
  {
    id: 'design-002',
    time: '00:05',
    method: 'POST',
    route: '/courses/:id/registrations',
    status: 409,
    result: 'Xung đột nghiệp vụ',
    latency: '6.47 ms',
  },
  {
    id: 'design-001',
    time: '00:02',
    method: 'GET',
    route: '/health',
    status: 502,
    result: 'Lỗi chuyển tiếp',
    latency: '1.61 ms',
  },
] as const;
