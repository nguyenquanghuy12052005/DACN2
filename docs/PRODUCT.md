# Định nghĩa sản phẩm DACN2

Cập nhật: 29/10/2026. Nguồn: [master plan](../DACN2_PROJECT_MASTER_PLAN.md) §1–4, §6–7, [contract backend](API_CONTRACT.md) và các quyết định người dùng trong quá trình triển khai. Tiến độ thực tế ở [tracker](../tasks/current.md), bằng chứng phiên gần nhất ở [checkpoint](PROGRESS.md).

## Bài toán và giá trị kỳ vọng

Khi website có nhiều truy cập, nguyên nhân có thể là người dùng hợp lệ cùng đến (Flash Crowd), bot tấn công L7, hoặc cả hai. Chặn chỉ vì tổng request cao có thể ảnh hưởng người dùng thật; scale theo tổng request có thể dành tài nguyên cho bot.

DACN2 hướng tới thu thập tín hiệu tại Go Gateway, phân loại trạng thái traffic bằng ML, dùng bằng chứng theo client để giới hạn/chặn, và scale backend K3s theo request thực sự được chuyển tiếp. Giá trị cần chứng minh: người dùng hợp lệ vẫn hoàn thành thao tác trong Mixed Traffic và hệ thống không tăng replica chỉ để phục vụ request đã bị từ chối. Đây là giả thuyết sản phẩm cần thực nghiệm; backend chạy local chưa chứng minh giá trị này.

## Người sử dụng và mức độ xác nhận

- Người vận hành lab: nhóm đồ án chạy phiên thử, theo dõi dashboard/log và đánh giá quyết định chặn/scale. Đây là đối tượng dự kiến từ kế hoạch, chưa có nghiên cứu/phỏng vấn người dùng được ghi nhận.
- Người tham gia demo: dùng mã giả lập để xem môn và đăng ký trong lab. Người dùng đã chọn kịch bản đăng ký học phần làm luồng đầu tiên; chưa có bằng chứng người dùng bên ngoài hoàn thành luồng.
- Giảng viên/người đánh giá: xem khả năng tái lập và bằng chứng thực nghiệm. Điều kiện nghiệm thu chính thức vẫn cần xác nhận; không tự coi các mục ưu tiên trong kế hoạch là tiêu chuẩn đã được giảng viên phê duyệt.

## Luồng chính

Luồng thao tác demo: xem danh sách môn → xem chi tiết/số chỗ → gửi đăng ký → nhận thành công hoặc lỗi rõ ràng khi sai dữ liệu, trùng hay hết chỗ. Dữ liệu dùng mã tham gia giả lập, không phải hệ thống quản lý sinh viên thật.

Luồng kiểm chứng hệ thống: chạy Normal làm baseline → Flash Crowd hợp lệ → Mixed Traffic → dừng tải/cooldown; có phiên Pure L7 DDoS riêng cho thu thập/đánh giá đủ bốn lớp. Đối chiếu generator ground truth với hành vi backend, chính sách Gateway, replica Ready và dashboard.

## Phạm vi phiên bản đầu theo kế hoạch

1. NestJS/PostgreSQL làm workload có ghi dữ liệu; bảo toàn trùng/capacity khi đồng thời.
2. Go Gateway reverse proxy HTTPS, thu HTTP/TLS/H2, client evidence và cửa sổ 5 giây.
3. Dataset lab tự thu với bốn lớp Normal, Flash_Crowd, Pure_L7_DDoS, Mixed_Traffic; tách phiên độc lập khi train/test.
4. Model ưu tiên XGBoost, train trên Google Colab theo lựa chọn người dùng; FastAPI phục vụ inference với preprocessing nhất quán.
5. Client scorer/policy cấu hình được, có timeout/fail-safe và rollback. Nhãn Mixed của toàn cửa sổ không tự xác định client nào là bot.
6. Backend trên K3s, scale theo admitted RPS và năng lực một Pod đo thực tế, có giới hạn/cooldown.
7. Prometheus/Grafana và script tái lập demo, kiểm tra sự cố, cleanup/recovery.

Mục tiêu 12 features, bao gồm JA4/Akamai H2, được giữ nguyên. Master plan có sự chưa nhất quán giữa phạm vi MVP và P1; việc chấp nhận ít feature hơn là câu hỏi mở, không phải quyết định trong tài liệu này. Phải chốt FEATURE_SPEC trước thu thập đại trà và ghi rõ thiếu capture.

## Ngoài lát cắt hiện tại

- Theo yêu cầu rút gọn của người dùng: backend chỉ là API tạo tải đọc/ghi DB cho lab; không triển khai thêm vé phim, mua hàng, tài khoản hoặc frontend. API môn học hiện có đủ cho vai trò workload.
- Chưa xây payments, email, hệ thống tài khoản sinh viên hay frontend thương mại hoàn chỉnh.
- So sánh đủ năm model, LOTO/ablation đầy đủ và public benchmarks là mở rộng theo kế hoạch, trừ khi nghiệm thu yêu cầu thêm.
- Chưa triển khai Internet/production hoặc mời người dùng thật. Lab chỉ chạy trên mục tiêu được phép với giới hạn tải và khả năng dừng.

## Thành công được hiểu như thế nào

Lát cắt backend đạt khi đọc được dữ liệu, đăng ký được một lần, lỗi có phản hồi rõ, và đồng thời/rollback không làm sai số chỗ. Phần này đã có bằng chứng local theo checkpoint; chi tiết test ở [REQUIREMENTS.md](REQUIREMENTS.md).

Lab đạt khi tái lập được phân loại bốn lớp, hành vi chặn theo client, bảo toàn thao tác hợp lệ và scale/cooldown theo admitted traffic; có dữ liệu, artifacts, logs, metrics và kiểm thử sự cố thực. Chưa đạt ở thời điểm tài liệu này.

Các KPI trong kế hoạch (Macro F1 >95%, FPR ≤2%, inference <10 ms/window đã tổng hợp, scale 1→5 Pod trong 4 giây) là mục tiêu tham chiếu chưa đo. FPR phân loại và tỷ lệ người dùng hợp lệ bị chặn phải báo cáo riêng. Không dùng KPI mô hình thay cho bằng chứng người dùng hoàn thành giao dịch.

Production release và project completion có thêm yêu cầu deploy/recovery, người dùng thật hoàn thành luồng và feedback theo [CONSTRAINTS.md](../CONSTRAINTS.md). Không suy ra các kết quả này từ demo lab.

## Giả định và câu hỏi còn mở

- Topology Linux/K3s khả thi với Windows, RAM khoảng 16 GB và Docker khoảng 8 GB cần xác minh trước cài đặt; training Colab không giải quyết giới hạn local lab.
- Chưa có xác thực người dùng: studentCode là input giả lập, không phải danh tính đáng tin. Trước triển khai qua mạng phải thiết kế auth và ranh giới truy cập.
- Chưa xác nhận ngân sách, phân công/thời gian thực tế, tiêu chuẩn nghiệm thu và yêu cầu đủ 12 features.
- Report.pdf chưa được đối chiếu độc lập trong lần trích xuất này; nguồn trực tiếp là master plan, code/contract và checkpoint.
- Các câu hỏi và công việc còn lại được theo dõi tại tracker, không tạo backlog riêng trong tài liệu này.
