# Yêu cầu và tiêu chí kiểm chứng DACN2

Cập nhật: 29/10/2026. Phạm vi sản phẩm: [PRODUCT.md](PRODUCT.md). Nguồn: master plan §1–4, §7, §10; [CONSTRAINTS.md](../CONSTRAINTS.md); [API_CONTRACT.md](API_CONTRACT.md). Đây là baseline làm việc; các câu hỏi nghiệm thu vẫn mở tại [tracker](../tasks/current.md).

## Cách đọc trạng thái

Mỗi mã dưới đây xác định yêu cầu và cách chấp nhận. Bằng chứng local được trích từ checkpoint phiên triển khai và đối chiếu tên test/source; không chạy lại runtime trong phiên chỉ viết tài liệu. Những yêu cầu lab chưa có artifact được ghi là chưa triển khai/chưa kiểm chứng, không tự đánh dấu đạt theo lịch.

## Backend local — M0

### BE-01 — Health và đọc môn học

- GET /health trả 200 với status/service; GET /courses đọc các môn từ PostgreSQL và trả id, code, name, capacity, registeredCount, availableSeats; GET /courses/:id trả đúng môn hoặc 404.
- availableSeats = capacity − registeredCount, tên môn tiếng Việt giữ nguyên UTF-8; ID phản hồi là string. ID đường dẫn là số nguyên dương dạng decimal trong miền safe integer theo contract; sai trả 400.
- Kiểm chứng: API/health/UTF-8 ở backend/test/backend.e2e-spec.ts; unit mapping/not-found/transaction ở backend/test/backend.spec.ts. Backend được gom thành 5 file nguồn để dễ hiểu trong phạm vi lab sinh viên; hành vi đọc/ghi DB giữ nguyên.

### BE-02 — Đăng ký và kiểm tra đầu vào

- POST /courses/:id/registrations chỉ nhận object có studentCode, chuỗi ASCII 1–30 ký tự chữ/số/_/-, chuẩn hóa uppercase. Body thừa trường, sai kiểu, khoảng trắng, rỗng, quá dài hoặc ID sai trả 400, không ghi dữ liệu.
- Môn tồn tại và còn chỗ: trả 201 chứa id, courseId, studentCode và lưu đúng một đăng ký.
- Môn không tồn tại: 404/COURSE_NOT_FOUND. Đăng ký trùng: 409/ALREADY_REGISTERED, kể cả môn đã đầy. Môn hết chỗ với mã mới: 409/COURSE_FULL. Lỗi phải theo API_CONTRACT.
- Kiểm chứng: backend/test/backend.e2e-spec.ts có success, normalization, malformed input, absent course, duplicate/full và đối chiếu hàng dữ liệu/counter. Đã qua local sau khi gom file.

### BE-03 — Tính đúng khi đồng thời và lỗi

- Với mỗi môn: 0 ≤ registeredCount ≤ capacity; số đăng ký thực bằng counter. Cùng courseId/studentCode chỉ có một bản ghi.
- Sáu request mã khác nhau tranh một ghế: một 201, năm COURSE_FULL. Bốn request cùng mã: một 201, ba ALREADY_REGISTERED. Không có tăng counter cho request thất bại.
- Insert và counter update dùng một transaction/cùng connection; lỗi sau insert rollback dữ liệu; release connection cả khi lỗi, discard nếu rollback hỏng. Lock/statement wait được giới hạn theo cấu hình hiện tại 3/5 giây.
- Kiểm chứng: concurrency và constraint rollback E2E; unit transaction commit/release/rollback/discard và service không trả thành công khi update lỗi. Đã qua local; load/performance ở quy mô lab chưa được đo.

### BE-04 — Dữ liệu và phạm vi truy cập

- Dùng studentCode giả lập; chưa xác thực người dùng, không khẳng định đây là danh tính sinh viên thật. Server local bind loopback; PostgreSQL host 127.0.0.1:15432.
- App dùng role riêng với quyền cần thiết; không dùng admin cho request ứng dụng. Query có input phải tham số hóa; secret không commit/log.
- E2E dùng riêng dacn2_test, tạo fixture duy nhất và cleanup; quyền INSERT/DELETE fixture chỉ cấp trong database test. Không làm thay đổi demo dacn2.
- Kiểm chứng hiện có: source/contract/schema grants; E2E cleanup và số hàng DB đã được kiểm tra cuối phiên trước. Chưa có kiểm thử auth thực vì chưa xây auth. Trước networked deployment cần contract auth/network boundary và kiểm thử truy cập trái phép.

## Hệ thống lab — M1 đến M6 (chưa triển khai/kiểm chứng)

### LAB-01 — Gateway và capture

- Client → Go HTTPS Gateway → NestJS hoạt động; lỗi upstream/timeout/cancellation quan sát được, tài nguyên request/connection/client state có giới hạn và cleanup.
- TLS/H2 fingerprint được kiểm chứng bằng known fixtures và browser capture độc lập. Missing/incomplete có flag và reason; không tạo hash giả hoặc dùng zero như dữ liệu quan sát.
- Chấp nhận khi proxy smoke/error tests, fixture và capture evidence tái lập được; trusted proxy/IP handling không tin header do client tự đặt.

### LAB-02 — Feature và dataset

- Trước thu đại trà có docs/FEATURE_SPEC.md: nguồn, công thức, đơn vị, range, zero-denominator, timestamp/window và missing/error cho 12 features mục tiêu.
- Event/window có schema version, session_id, timestamp và cửa sổ 5 giây; giữ raw data và manifest phiên. Bốn lớp: Normal, Flash_Crowd, Pure_L7_DDoS, Mixed_Traffic.
- Generator ground truth theo client/request lưu riêng để đánh giá chặn; không dùng label, tool/scenario ID hay ground truth làm feature. Kiểm tra IP thực sự quan sát, không giả nhiều client bằng header không tin cậy.
- Chấp nhận khi QA schema/missing/timestamp, lineage và script tái lập chạy được. Mục tiêu kế hoạch khoảng 25 phiên, 2.400–3.600 windows, ≥50% traffic hợp lệ từ Playwright là mục tiêu thu thập chưa đạt, không phải dataset hiện có.

### LAB-03 — Train và inference

- Train trên Google Colab; split theo session_id với holdout độc lập, overlapping windows không xuyên split. Fit preprocessing và resampling chỉ trên train fold.
- Artifacts lưu feature order, preprocessing, dataset/model/schema/dependency version. FastAPI xác thực/validate input và dùng đúng preprocessing; trả bốn probabilities, predicted class, model version, latency.
- Chấp nhận khi validation/leakage checks, predict offline, inference sample/batch/malformed/missing/version/timeout tests và báo cáo holdout có thể chạy lại. Báo confusion matrix, per-class metrics, Macro F1, legitimate FPR và inference latency.

### LAB-04 — Policy theo client và fail-safe

- Classifier toàn window không được tự biến thành danh sách bot. Client scorer dùng bằng chứng riêng; threshold, TTL, observe/limit/block cấu hình được, có log và rollback.
- Khi AI lỗi, stale/invalid response hoặc timeout: Gateway không treo và không chặn hàng loạt client chỉ vì nhãn Mixed/DDoS. Feedback control API có auth, timeout, bounded retry.
- Chấp nhận khi failure tests và replay/demo cho thấy decision evidence, policy rollback, số client/request hợp lệ bị chặn và bot bị hạn chế đối chiếu generator ground truth. Thông số tham chiếu trong master plan phải được cấu hình/đo, không coi là đã tối ưu.

### LAB-05 — K3s và scale

- Xác minh topology trước cài. Đo C = năng lực một Pod trong điều kiện ghi rõ; replica dựa admitted RPS thực đo, dự kiến clamp(ceil(RPS_admitted/C), 1, 5), có cooldown/hysteresis.
- Một controller sở hữu replica target, quyền scale tối thiểu; kiểm tra desired/current/Ready. Không scale theo blocked traffic hay lấy 40–45 req/s làm capacity đã chứng minh.
- Chấp nhận khi có benchmark một Pod, test scale-up/down/cooldown, API failure/permission/stale evidence và timestamps tới Ready/critical-flow response. Backend trên K3s vẫn phải giữ tính đúng BE-03.

### LAB-06 — Monitoring và lab release

- Prometheus/Grafana hiển thị real total/admitted/limited/blocked traffic, AI probabilities, latency, replica và tài nguyên. Định nghĩa counter đối soát được; không dùng raw IP/JA4/request ID/URL làm nhãn metrics tăng vô hạn.
- Demo Flash Crowd → Mixed → Cooldown và phiên Normal/Pure L7 DDoS có logs, metrics, ground truth và kết quả backend khớp nhau. Có start/stop/health/demo, emergency stop, cleanup/recovery và failure tests.
- Chấp nhận lab release khi người vận hành chạy lại được từ hướng dẫn và artifacts thật, có limitations và kết quả thất bại ghi rõ. Các tải 220/200/400 req/s là kịch bản tham chiếu; mức chạy thực phải ghi giới hạn phù hợp phần cứng.

## Yêu cầu chất lượng xuyên suốt

- Q-01: Chỉ phát tải vào lab được phép; cấu hình cap tải/concurrency/thời lượng/tài nguyên, kill switch và cleanup trước khi chạy. Chưa có load generator trong phạm vi backend local.
- Q-02: Không commit secret hoặc log credentials/payload nhạy cảm. Control endpoints/networked deployments cần authorization ở boundary đáng tin; chưa có bằng chứng pentest/production hardening.
- Q-03: Lint/build/test liên quan phải qua, không hạ assertion để pass; có regression cho lỗi thực tế. Kết quả gần nhất là 8 unit và 9 E2E qua local. Build bao gồm biên dịch TypeScript; chưa có CI hoặc script typecheck riêng.
- Q-04: Cài mới/start/stop/recovery phải tái lập được bằng cấu hình mẫu. README hiện có lệnh local/test database, nhưng fresh-install role provisioning và topology/CI vẫn còn việc tại tracker.
- Q-05: Production release cần deployment, health/critical-flow, logs và recovery thực; project completion cần real users/feedback theo CONSTRAINTS. Chưa đạt và không được thay thế bằng lab release.

## Mục tiêu định lượng chưa đo

- Macro F1 >95% và legitimate classification FPR ≤2% trên holdout theo phiên; phải ghi định nghĩa FPR và thành phần lớp hợp lệ trước đánh giá.
- Inference <10 ms cho window đã tổng hợp; đo riêng preprocessing/network/window-collection delay, không coi đây là detection end-to-end.
- Scale 1→5 Pods trong 4 giây: báo điều kiện, mốc lệnh scale tới Ready và khả năng backend phục vụ; chưa đo.
- Client false-blocking và tỷ lệ thao tác hợp lệ thành công phải đo riêng với classifier FPR. Ngưỡng nghiệm thu chính thức cho các chỉ số này còn mở; không tự đặt số rồi tuyên bố đạt.

Các KPI lấy từ master plan, chưa được đối chiếu độc lập với Report.pdf hoặc xác nhận thành tiêu chuẩn nghiệm thu cuối cùng. Không giảm mục tiêu/feature hoặc tuyên bố đạt chỉ vì thiếu tài nguyên/thời gian.
