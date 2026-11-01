// Educational inventory from the master plan; formulas/schema remain an M2 task.
// No model values are synthesized from dashboard completion metrics.
export const modelFeatures = [
  {
    key: 'r_no_grease',
    name: 'Tỷ lệ thiếu TLS GREASE',
    unit: 'Tỷ lệ (0–1)',
    meaning: 'Mức phổ biến của ClientHello không chứa giá trị GREASE.',
    source:
      'TLS ClientHello: cipher suites, extensions và các trường GREASE được chốt trong M2.',
    gap: 'Chưa chốt đối tượng đếm và chưa có bộ tổng hợp GREASE theo cửa sổ.',
  },
  {
    key: 'rho_ja4',
    name: 'Độ đa dạng JA4 trên IP',
    unit: 'JA4 khác nhau / IP khác nhau',
    meaning: 'So sánh số dấu vân tay JA4 khác nhau với số IP hoạt động.',
    source: 'JA4 và IP peer tại Gateway, tổng hợp cùng cửa sổ.',
    gap: 'Có JA4 theo kết nối; chưa tổng hợp theo cửa sổ. Loopback/NAT không đại diện số người dùng.',
  },
  {
    key: 'm_cross',
    name: 'Độ không khớp User-Agent và fingerprint',
    unit: 'Tỷ lệ (0–1)',
    meaning:
      'Tỷ lệ quan sát có User-Agent không phù hợp với TLS/HTTP2 fingerprint.',
    source:
      'User-Agent đã chuẩn hoá, TLS/H2 và tập quy tắc đối chiếu có phiên bản.',
    gap: 'Chưa có quy tắc đối chiếu và trường User-Agent an toàn trong nguồn UI.',
  },
  {
    key: 's_mux',
    name: 'Số stream HTTP/2 trên kết nối',
    unit: 'Stream / kết nối TCP',
    meaning: 'Mức sử dụng nhiều stream trên một kết nối HTTP/2.',
    source: 'Bộ đếm stream và kết nối HTTP/2 trong cửa sổ.',
    gap: 'Observer hiện chỉ xem phần đầu kết nối; không phải bộ đếm toàn bộ stream.',
  },
  {
    key: 'h_ip',
    name: 'Entropy IP',
    unit: 'Bit (dự kiến log₂)',
    meaning: 'Lưu lượng phân tán đều hay tập trung vào một số IP.',
    source: 'Phân bố số request theo IP peer trong cửa sổ.',
    gap: 'Chưa có phân bố IP theo cửa sổ; mã client trên UI chỉ dùng đối soát trong phiên.',
  },
  {
    key: 'h_uri',
    name: 'Entropy endpoint',
    unit: 'Bit (dự kiến log₂)',
    meaning: 'Mức đa dạng của các endpoint được truy cập.',
    source: 'Phân bố request theo endpoint chuẩn hoá.',
    gap: 'Đã có route mẫu trong log; chưa chốt cách chuẩn hoá và tính entropy theo cửa sổ.',
  },
  {
    key: 'h_query',
    name: 'Entropy query string',
    unit: 'Bit (dự kiến log₂)',
    meaning: 'Mức đa dạng của query string theo quy tắc chuẩn hoá.',
    source:
      'Thống kê query an toàn tại Gateway, không đưa query thô nhạy cảm lên UI.',
    gap: 'Log hiện không lưu query; cần thiết kế thu an toàn trước khi tính.',
  },
  {
    key: 'r_static',
    name: 'Tỷ lệ tài nguyên tĩnh',
    unit: 'Tỷ lệ (0–1)',
    meaning:
      'Phần request truy cập tài nguyên tĩnh trong tổng request được xét.',
    source: 'Route và quy tắc phân loại tài nguyên tĩnh.',
    gap: 'Chưa chốt quy tắc; tài nguyên Vite hiện không đi qua Gateway nên không được tính như đã quan sát.',
  },
  {
    key: 'r_ip',
    name: 'Request trung bình mỗi IP',
    unit: 'Request / IP / cửa sổ',
    meaning: 'Cường độ request trung bình của mỗi IP hoạt động.',
    source: 'Số request và số IP peer khác nhau trong cùng cửa sổ.',
    gap: 'Chưa có bộ tổng hợp cửa sổ; nhiều client lab có thể cùng IP loopback.',
  },
  {
    key: 'iat',
    name: 'Khoảng cách giữa các request',
    unit: 'Mili giây (dự kiến)',
    meaning: 'Thời gian trung bình giữa các request liên tiếp của một client.',
    source:
      'Thời điểm bắt đầu request và định nghĩa client được chốt trong M2.',
    gap: 'Chưa chốt client và trường hợp chỉ có một request; không dùng thời điểm hoàn tất thay thế.',
  },
  {
    key: 'l_markov',
    name: 'Độ phù hợp chuỗi điều hướng',
    unit: 'Log-likelihood (cơ số chờ chốt)',
    meaning:
      'Mức phù hợp của chuỗi truy cập với mô hình chuyển trang tham chiếu.',
    source:
      'Chuỗi endpoint theo client và mô hình Markov chỉ fit trên tập train.',
    gap: 'Chưa có bộ dựng chuỗi, mô hình tham chiếu hoặc quy tắc cho chuyển tiếp chưa thấy.',
  },
  {
    key: 't_up',
    name: 'Độ trễ backend trung bình',
    unit: 'Mili giây (dự kiến)',
    meaning:
      'Thời gian phản hồi upstream trung bình theo ranh giới đo thống nhất.',
    source: 'Phép đo upstream và bộ tổng hợp cửa sổ.',
    gap: 'Độ trễ request hiện có là tổng tại Gateway; chưa có phép đo upstream riêng, không dùng thay t_up.',
  },
] as const;
