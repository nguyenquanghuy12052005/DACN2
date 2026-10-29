# DACN2 — checkpoint tiếp tục dự án

Cập nhật: 30/10/2026 (Asia/Bangkok). Milestone: M1. Người dùng yêu cầu **dừng tại đây và cập nhật tiến độ**. Chỉ ghi checkpoint, không tiếp tục triển khai. Tracker duy nhất: tasks/current.md.

## Đọc trước ở chat mới — điểm dừng hiện tại

- Rà soát trước push theo yêu cầu riêng của người dùng: đã bổ sung .gitignore cho TLS session keys (*.keys/*.keylog/sslkeylog*), raw captures (*.pcap/*.pcapng/*.cap/*.etl), Go binaries/test executables và *.tsbuildinfo. Kiểm chứng git check-ignore từng đường dẫn; .env.example, workflow, source Go và package-lock vẫn được đưa vào Git. Danh sách tracked/untracked không có env thật/private-key/capture/binary; scan nhẹ private-key/GitHub-token không thấy match (không phải full secret audit). Không stage/commit/push, không tiếp tục tính năng; mọi thay đổi local giữ nguyên.

- Backend đã đủ làm workload API cho lab, giữ 5 file nguồn; không mở rộng nghiệp vụ, tài khoản hay frontend. Backend/DB và setup M0 không làm lại.
- Gateway có HTTPS proxy trên 8443, ClientHello và JA4. JA4 Postman đối chiếu độc lập bằng TShark PASS; Chrome headful cũng có JA4 Wireshark/Gateway khớp và DevTools health 200/protocol h2. Chi tiết bằng chứng nằm bên dưới.
- H2 mới xong **kiểm chứng nguồn dữ liệu**: capture Chrome thật, dùng key log lab để Wireshark đọc SETTINGS/WINDOW_UPDATE/pseudo-header order/priority metadata. Chưa có chức năng thu fingerprint H2 tự động trong Gateway, chưa tính Akamai text/hash. Không gọi M1-03 DONE; chưa có dataset/model/mitigation/scaling/K3s/monitoring. Training sau này trên Google Colab.
- Kiểm tra runtime read-only khi chốt phiên: Gateway đang chạy lại trên 127.0.0.1:8443 PID 13316, backend trên 127.0.0.1:3000 PID 9432; không có process dumpcap. Agent giữ nguyên các tiến trình này theo trạng thái quan sát, không dừng thêm. PID thay đổi sau restart; cần kiểm tra lại ở phiên sau.
- Trước đó agent đã dừng Gateway PID 10340 sau capture để kết thúc ghi khóa; nay có Gateway mới PID 13316. Không kiểm tra env của process mới, nên không khẳng định key logging đã tắt. Mặc định code không ghi khóa nếu DACN2_TLS_KEYLOG không được đặt. Khi chạy lại bình thường, bỏ biến bằng Remove-Item Env:DACN2_TLS_KEYLOG -ErrorAction SilentlyContinue rồi go run . từ gateway.
- Evidence/capture/key log đều nằm trong .local-backups ignored. Không đọc/in/gửi khóa; không xóa capture, khóa hay backup cũ khi chưa được yêu cầu. Wireshark/TShark 4.6.9 và Npcap 1.88 đã cài.
- Checks gần nhất: Go fmt/vet PASS, 2 test functions/6 JA4 subtests PASS; backend gần nhất lint/build/8 unit/9 E2E PASS. Phiên ghi checkpoint này không chạy lại tests, không tạo traffic/capture mới. Hosted CI chưa có kết quả được ghi nhận vào tracker, không tự coi PASS.
- Git HEAD local 052704e; nhiều modified/untracked, gồm gateway/ và workflow/docs. Agent chưa commit/push; không reset/clean hay suy ra chúng đã có trên remote. Chỉ sửa docs/PROGRESS.md và tasks/current.md để chốt lần này.
- Người dùng chưa quen Wireshark và cần **giải thích mục đích trước thao tác**, chỉ từng bước nhỏ, tránh đưa nhiều thay đổi/code cùng lúc. Test API ưu tiên Postman. Trước mỗi phần mới mô tả mã task/mục đích/phạm vi, chờ chọn “bạn làm” hoặc “tôi làm”; chưa được tự tiếp tục sau yêu cầu dừng.
- Bước đề xuất khi người dùng quay lại: giải thích và chốt phạm vi nhỏ M1-03 contract/observer H2, kiểm tra cơ chế lấy frame của Go và missing/error handling trước code. Dùng capture hiện có làm đối chiếu; không dùng TLS key logging thường trực làm giải pháp Gateway. Raw/original JA4 variants còn thiếu; giữ mục tiêu 12 features và các câu hỏi nghiệm thu trong tracker.

## M1-03 — H2 capture chẩn đoán đã giải mã PASS

- Người dùng tự thêm TLSConfig.KeyLogWriter có opt-in qua DACN2_TLS_KEYLOG, sau đó yêu cầu agent tiếp quản vì Explorer hiển thị file 0 KB. Khi agent kiểm tra, .local-backups/h2-lab.keys đã có 2528 bytes; mã opt-in đúng, không cần sửa. File chỉ ghi khi có bắt tay TLS, không phải mỗi request. Phiên Chrome mới làm file tăng lên 3160 bytes; không in nội dung khóa.
- Dùng Chrome 156 headless thật với profile thử riêng trong thư mục ignored, chỉ allowlist SPKI certificate lab cho process này; không đổi profile/cấu hình Chrome đang mở. GET /health trả status=ok/service=dacn2-backend; Chrome tự gọi thêm /favicon.ico trả 404 (không phải lỗi health). Không POST hay phát tải.
- dumpcap NPF_Loopback filter TCP 8443/host 127.0.0.1, tối đa 25 giây/1024 KB/200 packets. Capture thực 35 packets/0 drop, một tcp.stream 0. TShark 4.6.9 dùng tls.keylog_file đọc được 11 packet chứa H2, response HEADERS /health :status=200 ở frame 22.
- Dữ liệu client thực: frame 12 SETTINGS theo thứ tự 1:65536, 2:0, 4:6291456, 6:262144; WINDOW_UPDATE stream 0 increment=15663105. Frame 14 HEADERS stream 1 có thứ tự :method,:authority,:scheme,:path; priority flag=1, exclusive=1, dependency=0, weight thực=256. Không thấy standalone PRIORITY frame trong phiên này, nhưng CÓ priority metadata trong HEADERS; không đánh đồng hai loại.
- Artifact ignored: .local-backups/h2-capture-1793294875724/chrome-health.pcapng, http2.json, http2-frames.tsv, h2-observations.json, result.txt, dumpcap.log; script local .local-backups/capture-h2-lab.cjs. Khóa nằm riêng ở .local-backups/h2-lab.keys, không embed vào pcap/không commit. Đã mở Wireshark với -o tls.keylog_file cho phiên xem này và filter http2; không cần đổi preference lâu dài. Đối chiếu cách đọc frame theo RFC 9113 và hướng dẫn TLS decryption của Wireshark.
- Cleanup: capture và Chrome thử đã kết thúc. Agent dừng đúng Gateway PID 10340 để chấm dứt ghi khóa; cổng 8443 không còn listener, backend PID 9432 vẫn chạy trên 3000. Không thể xóa biến env của terminal PowerShell cha từ agent: trước khi người dùng chạy lại, cần Remove-Item Env:DACN2_TLS_KEYLOG -ErrorAction SilentlyContinue rồi go run . từ gateway. Không khởi động server nền khác.
- Kiểm tra thực: go fmt/vet PASS; 2 test functions/6 JA4 subtests PASS. Agent không thay thuật toán/source; chỉ kiểm tra phần KeyLogWriter do người dùng viết và tạo artifact local. Chưa có live H2 frame observer trong Gateway, Akamai text/hash chưa tính (null trong observations), chưa bulk dataset/model/mitigation. Không gọi M1-03 DONE.
- Bằng chứng user tự làm trước đó: Chrome headful JA4 t13i1516h2_8daaf6152771_cb7bf5808d99 khớp Wireshark/Gateway; ảnh Chrome Network health status=200/protocol=h2. Có một TLS attempt unknown certificate trước request thành công; không tính failed attempt là phiên HTTPS thành công. Browser fingerprint có thể khác giữa headful/headless/version; không coi tất cả Chrome là một giá trị cố định.

## M1-03 — JA4 Postman đối chiếu capture độc lập PASS

- Người dùng hoàn tất wizard sau khi Windows admin boundary chặn tool điều khiển installer. Đã xác minh TShark/Wireshark 4.6.9, Npcap 1.88/libpcap 1.10.6, service running và NPF_Loopback hoạt động. Không còn chờ cài prerequisite.
- Agent dùng dumpcap bắt riêng `tcp port 8443 and host 127.0.0.1` trên loopback, snaplen đầy đủ, tự dừng sau tối đa 30 giây/1024 KB/200 packets. Qua Postman UI gửi đúng một GET tới https://127.0.0.1:8443/health, nhận 200 và body status=ok/service=dacn2-backend. Giữ nguyên URL/collection; không POST, phát tải hay ghi TLS session keys.
- Capture thực có 49 packets, received/dropped 49/0. TShark đọc pcap (decode port 8443 as TLS), ClientHello frame 4/tcp.stream 0, tự tính JA4 **t13i180900_5d04281c6031_78e6aca7449b**: khớp nguyên fingerprint Gateway người dùng báo trước capture. Đây là đối chiếu với prior Gateway log của cùng loại client; chưa ghép log live theo connection ID.
- Artifact ignored: .local-backups/ja4-capture-20261030-postman/postman-health.pcapng; clienthello.json (fields/JA4/JA4_r do TShark xuất); result.txt; dumpcap.log. PCAP SHA256 DA05B247F10EA93C2EB4D9A9F10FB6C2F91573642A52E020988290A3EF713800. TShark xuất JA4_r độc lập không có nghĩa Gateway đã có raw/original variants.
- Capture PID 4696 đã tự kết thúc; không dừng Gateway/backend do người dùng đang chạy. Không sửa application code/dependencies, không commit/push và không chạy lại unit/backend checks không liên quan. Go JA4 fixture tests PASS là bằng chứng phiên fix trước.
- Phạm vi kết luận: verified một ClientHello Postman/TLS-over-TCP. Chưa real-browser capture, Akamai H2, raw/original variants của Gateway, bulk dataset, model hay chặn DDoS. M1-03 vẫn IN_PROGRESS. Bước đề xuất tiếp theo: real-browser ClientHello/ALPN và kiểm tra HTTP/2, phải mô tả phạm vi rồi chờ người dùng chọn.

## M0-04 — CI tối thiểu

- Người dùng chọn “bạn làm”, cho biết đã push Git. Đã xác minh HEAD và remote main cùng 052704e8cee8c868d43949560ecd095df67ae7f8; còn các docs/env example local chưa commit, đã giữ nguyên. Không agent commit/push.
- Chỉ thêm .github/workflows/backend-ci.yml và cập nhật hướng dẫn/checkpoint/tracker. Một job Ubuntu, Node 20.20.2, PostgreSQL 17 tạm; push/PR/manual trigger, permissions contents:read, timeout 10 phút. Actions checkout/setup-node v7 được xác minh bằng official GitHub API và pin SHA. Không dùng credential hay DB local, không sửa 5 file backend.
- Workflow: npm ci → role/schema/seed/test-only grants → read-only lint → build → unit → E2E → compiled health smoke. Health chạy node dist/main.js trên 3300, retry có giới hạn, kiểm tra process còn sống và trap dừng khi thoát. Quy ước console Nest LOG/ERROR ghi trong backend/README.md, không thêm logging framework.
- PASS local: parse YAML; chạy nguyên bootstrap và smoke script lấy từ YAML qua Git Bash, cộng ESLint/build/8 unit/9 E2E. Dùng container mới dacn2-ci-check-1793289320634 với CI-only credentials và DB test trên 25432; test fixture cleanup còn 5 môn/0 đăng ký. Container/anonymous volume đã xóa, process smoke đã dừng. Không tác động DB demo. npm ci đã có clean-install evidence M0-02b; không cài lại dependencies ở working tree đang dùng trong lượt này.
- Evidence ignored: .local-backups/dacn2-ci-check-1793289320634/result.txt và checks.log; harness verify-backend-ci.cjs. Đây là rehearsal Windows/Git Bash, chưa phải hosted Ubuntu/GitHub Actions PASS.
- GitHub CLI trong sandbox báo token invalid; retry read-only ngoài sandbox xác nhận keyring login hợp lệ. Remote gh run list trả []; workflow mới chưa commit/push, nên hosted CI NOT_RUN. Người dùng có thể commit/push bằng giao diện Git rồi mở GitHub → Actions → Backend CI; chỉ đánh dấu hosted CI PASS khi mọi bước xanh.

## Ngữ cảnh các bước đã thực hiện

- Sau capture H2, Gateway PID 10340 đã được dừng để kết thúc ghi khóa; runtime mới nhất khi chốt phiên được ghi ở mục đầu (Gateway đã chạy lại). Không bật key logging mặc định hoặc dùng làm cơ chế capture production. Phần tiếp theo cần chọn riêng là contract/observer H2 trong Gateway, không chỉ tiếp tục giải mã pcap rồi gọi feature DONE.

- Capture Postman đã PASS, prerequisite Wireshark/Npcap đã cài và xác minh; xem mục mới nhất phía trên. Tiếp tục giữ phạm vi Gateway nhỏ và phân biệt Postman với real-browser/H2 evidence.

- M1 đang được người dùng tự triển khai có hướng dẫn: Gateway HTTP → HTTPS trên 8443, ClientHello và JA4 đã có trong gateway/main.go, ja4.go, ja4_test.go. Người dùng báo đã test proxy/read/write/input/backend-stop-recovery bằng Postman và TLS metadata; đó là user-reported evidence. Go 1.27.3 có ClientHelloInfo.Extensions, đã đối chiếu installed source; không cần tự parse TLS chỉ để lấy extension IDs.
- Fix `llog.Printf` → `log.Printf` đã qua go fmt/vet/tests PASS, 2 test functions/6 subtests gồm fixture FoxIO chuẩn. JA4 đã đối chiếu với Postman và Chrome; capture H2 diagnostic cũng đã có. Chưa có JA4 raw-original variants của Gateway và live H2 observer/Akamai fingerprint; không đánh dấu M1-03 DONE.

- Backend chỉ là **API tạo tải đọc/ghi PostgreSQL cho lab DDoS**. Không mở rộng nghiệp vụ đăng ký, tài khoản, frontend, vé phim hay mua hàng. Công việc chính tiếp theo thuộc Gateway/AI/data/scaling.
- Người dùng thấy quá nhiều file và yêu cầu gom/xóa phần thừa. Đã gom backend/src từ 16 file TS (kể cả unit cũ) còn 5: main.ts, app.module.ts, courses.controller.ts, courses.service.ts, database.service.ts. Bản đồ tác dụng từng file nằm đầu backend/README.md.
- Tests gom thành test/backend.spec.ts và test/backend.e2e-spec.ts; vẫn giữ 8 unit/9 E2E. setup-env.ts buộc DB test; SQL fixture grants giữ để cleanup an toàn. Không bỏ các kiểm tra lỗi/concurrency/rollback để làm tests pass.
- Bỏ scaffold Hello World (GET / hiện 404), app service/controller riêng, 2 module trung gian, 2 pipe và 2 file interface riêng. Logic validation/types được chuyển vào controller/service tương ứng. Health/list/detail/registration giữ nguyên contract.
- CI/log conventions/health-smoke đã triển khai ở mức tối thiểu; hosted CI chưa có output ghi vào tracker. M1 Gateway/JA4 đang làm. Trước mỗi phần mới: mô tả mã task, mục đích/phạm vi và chờ người dùng chọn “bạn làm” hoặc “tôi làm”. Không tự mở rộng backend.
- Giữ local chưa commit/push; không reset/clean hay ghi đè env. Có bản sao source/tests/README/package trước gom ở .local-backups/backend-before-simplify-20261029/ (ignored); cả nội dung local chưa commit đã được giữ tại đó. Bản sao là artifact phục hồi, không phải source đang chạy.

## Kiểm chứng sau rút gọn

- ESLint không --fix PASS; npm run build PASS; npm test -- --runInBand PASS: 1 suite/8 tests.
- npm run test:e2e -- --runInBand PASS: 1 suite/9 tests trên dacn2_test. E2E vẫn kiểm tra input, thiếu môn, duplicate/full, last-seat race, duplicate race, rollback và cleanup. Test Hello World đã thay bằng kiểm tra health thực.
- Smoke bản build qua node dist/main.js trên loopback 3300: health/list/detail 200, tên tiếng Việt đúng; GET / trả 404. Server thử đã dừng. Không POST smoke lên DB demo.
- Trong lần gom đầu, build/lint bắt được 2 import interface cũ; đã xóa import sau khi interface được chuyển cùng service, chạy lại PASS. E2E sandbox ban đầu EACCES trên 15432; chạy lại với quyền kết nối local PASS. Log rollback failed trong unit là nhánh giả lập có chủ đích.
- Không cài/nâng dependency, sửa schema/migrations/env/Compose hay phát tải. Không đo hiệu năng, train/deploy, production hoặc real-user validation.

## Tiến độ đã có

- M0-01 khảo sát DONE. NestJS/PostgreSQL và M0-03 backend local DONE; M0-02b setup DONE.
- M0-02b: README root, root/backend env examples, hướng dẫn role/password/migrations/start-stop/checks đã có; không làm lại. Rehearsal sạch dùng project dacn2-m002b-945797ca, volume mới, bản sao source + npm ci; ESLint/build/8 unit/9 E2E/compiled smoke PASS. Project/volume/server thử đã dọn. Evidence ignored: .local-backups/dacn2-m002b-945797ca/result.txt và checks.log. Chỉ kiểm chứng trên Windows/Docker host hiện có, chưa cài OS/prerequisite trên máy khác.
- M0-02a còn câu hỏi nghiệm thu; M0-04 đã có implementation/local evidence, hosted CI chờ commit/push. M0 tổng thể chưa DONE.
- Go Gateway HTTPS/JA4 đã có, H2 có diagnostic capture baseline. Chưa có dataset/model, inference, policy, K3s, scale hay monitoring. Chưa cài k3d/K3s. Training sẽ dùng Google Colab.

## Môi trường cần nhớ

- Backend loopback 127.0.0.1:3000; PostgreSQL loopback 15432. DB demo dacn2, test dacn2_test; app role dacn2_app, admin dacn2_admin. Mật khẩu nằm trong env ignored; không in secrets.
- Migrations 001–003 đã áp dụng ở DB hiện tại. Không chạy lại 001 trên schema có sẵn, không xóa volume. Copy SQL nguyên file bằng docker compose cp rồi psql -f để giữ UTF-8.
- Docker data đã chuyển qua Docker Desktop tới D:\DockerData\DockerDesktopWSL. Backup pg_dump ở .local-backups/postgres-20261029-220228/; chưa restore rehearsal, không có backup global-role/password. Không xóa các backup này.
- Windows 11, RAM 15.8 GB; snapshot available trước khoảng 2 GB. Go/Node/Python/Docker/WSL/kubectl có, cluster chưa cài. Chi tiết survey và giới hạn ở docs/ARCHITECTURE.md.
- studentCode là mã lab giả lập do client đưa vào, chưa phải xác thực danh tính. Chỉ phát tải vào mục tiêu lab được phép, có giới hạn và cleanup. Thiết kế network/trusted-client boundary trước triển khai qua mạng.

## Chạy và tự kiểm tra

Từ root: docker compose up -d postgres; docker compose ps. Từ backend: npm run start:dev. Terminal khác gọi GET http://127.0.0.1:3000/health và /courses. Dừng server bằng Ctrl+C; docker compose stop postgres giữ volume.

Từ backend: npm run build; npm test -- --runInBand; npm run test:e2e -- --runInBand. Lint không sửa file: npx --no-install eslint "src/**/*.ts" "test/**/*.ts". Mong đợi 8 unit/9 E2E. E2E chỉ ghi fixture vào dacn2_test và tự dọn.

## Điểm tiếp tục

Đang dừng theo yêu cầu người dùng. Khi được yêu cầu tiếp tục, dùng điểm dừng ở đầu file: backend/proxy/TLS/JA4 cơ bản đã có, không triển khai lại M1-01. Phần còn thiếu chính là live H2 observer/contract/Akamai serialization và raw/original JA4 variants. Đọc scope rồi chờ chọn cách làm; giữ capture diagnostic làm mẫu đối chiếu, chưa thu dataset đại trà hay cài cluster. Hosted CI vẫn cần bằng chứng thực trước khi gọi PASS.

Câu hỏi 12 features, nghiệm thu lab/production, nguồn lực và skill revision còn mở trong tasks/current.md. Kiến trúc Go/Python/NestJS/PostgreSQL/K3s/Prometheus/Grafana giữ nguyên. HEAD/remote main đã xác minh 052704e; không suy ra workflow/docs local đã lên remote. Agent chưa commit/push.
