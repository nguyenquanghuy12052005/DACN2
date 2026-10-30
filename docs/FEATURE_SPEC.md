# Gateway feature specification

## M1-03 — HTTP/2 fingerprint (draft)

### Mục đích
Thu đặc điểm HTTP/2 phía client để phục vụ fingerprint.
Chưa dùng fingerprint để tự kết luận hoặc chặn client.

### Dữ liệu cần quan sát
- SETTINGS đầu tiên của client, không phải ACK:
  giữ danh sách ID/value theo đúng thứ tự xuất hiện.
- WINDOW_UPDATE đầu tiên trên connection (stream_id = 0):
  giữ giá trị increment.
- PRIORITY frames và priority metadata trong HEADERS:
  lưu riêng, không đánh đồng hai loại.
- Pseudo-header của request đầu tiên:
  giữ thứ tự tên, không lưu giá trị header.

### Baseline Chrome đã kiểm chứng
- SETTINGS: 1:65536;2:0;4:6291456;6:262144
- WINDOW_UPDATE increment: 15663105
- Pseudo-header order: :method,:authority,:scheme,:path
- HEADERS priority: exclusive=1, dependency=0, weight=256
- Không thấy standalone PRIORITY frame trong capture mẫu.

### Quy tắc
- Phân biệt giá trị 0 quan sát được với dữ liệu chưa thu được.
- Dữ liệu thiếu/lỗi không được tạo fingerprint như dữ liệu đầy đủ.
- Không lưu body, cookie, authorization hoặc TLS session keys.
- Observer phải có giới hạn thời gian, bộ nhớ và số connection.
- Giới hạn thử nghiệm cho mỗi kết nối: tối đa 64 KiB dữ liệu đầu vào,
  tối đa 32 frame và tối đa 2 giây kể từ khi bắt đầu đọc H2.
- Tối đa 128 kết nối được quan sát cùng lúc; khi hết chỗ, đánh dấu
  observation_unavailable cho kết nối mới.
- Ngừng quan sát khi đã có SETTINGS đầu tiên, WINDOW_UPDATE của
  connection và pseudo-header request đầu tiên, hoặc khi chạm giới hạn.
- Nếu thiếu một trường bắt buộc, ghi incomplete cùng lý do; không tính hash.
- Không giữ byte/header value sau khi trích xuất các trường cần thiết.
- Akamai four-field text/MD5 đã triển khai ở M1-03g, cùng phiên Chrome headless
  đã đối chiếu độc lập PASS ở M1-03h. JA4 variants đã có ở M1-03i; chờ runtime
  restart/log check trước khi chốt phạm vi M1-03.

### M1-03i — JA4 raw/original (hiện tại, 30/10/2026)
- Runtime bổ sung15:44:35: user restart, đủ4JA4 logs và H2/Akamai event; Node
  SHA256 từ raw phiên thành công khớp JA4/JA4_o. M1-03 extraction local scope
  chốt DONE trong tracker; các dòng “chờ runtime” dưới đây là trạng thái trước lần này.
- ja4.go dùng chung raw-list helpers; không mutate các slice ClientHello.
  JA4/JA4_r sort cipher/extension, extension bỏ0000/0010; JA4_o/JA4_ro giữ thứ tự
  gốc và giữ0000/0010. Mọi dạng bỏ GREASE, signature algorithms luôn giữ wire order.
- JA4_r/JA4_ro dùng hex lowercase4 ký tự, danh sách dấu phẩy; signature list có
  underscore riêng khi có giá trị. JA4_o hash SHA256 truncated12 của original lists.
  Empty cipher/extension hash dùng000000000000 theo technical spec; raw empty dùng
  field rỗng. Prefix dùng cùng hàm đã có; scope TLS-over-TCP, không QUIC/DTLS.
- main.go giữ dòng JA4 cũ, thêm JA4_r/JA4_o/JA4_ro trong ClientHello callback.
  Chỉ ID/algorithm metadata, không domain/header/body/secret trong các dòng mới.
  JA4_o/ro có thể đổi khi browser thay wire order, không phải lỗi sorted JA4.
- FoxIO reference pin c6469a7b0dbf8fe963810162429fbfd9d1acc4d5:
  https://github.com/FoxIO-LLC/ja4/blob/c6469a7b0dbf8fe963810162429fbfd9d1acc4d5/technical_details/JA4.md
  và python/ja4.py đã đọc để đối chiếu. Published JA4/JA4_r/JA4_o/JA4_ro fixture
  PASS, cùng GREASE/order/empty/no-signatures/input-nonmutation tests.
- Offline capture M1-03h: TShark4.6.9 JA4/JA4_r khớp Go; original/raw-original
  từ ordered ClientHello metadata khớp Node independent computation. Không dùng
  TLS key log hoặc phát traffic mới. TShark không xuất original variants ở check này.
- Capture sample: JA4 t13i1516h2_8daaf6152771_cb7bf5808d99,
  JA4_o t13i1516h2_acb858a92679_866014123543.
  Evidence .local-backups/ja4-variants-offline-1793349598621/result.json.
- gofmt/vet/full Go tests/race/build PASS; chưa restart user Gateway để kiểm log
  bốn dạng trên phiên mới. Không tự gọi toàn bộ M1 hoặc 12-feature pipeline DONE.

### M1-03h — đối chiếu capture cùng phiên (hiện tại, 30/10/2026)
- Chrome156.0.8078.79 headless profile mới → Gateway bản sao trên127.0.0.1:18443
  → backend thật3000. Bản sao chỉ đổi bind port, SHA256 từng source/module đã ghi
  trong evidence; không sửa Gateway source/tiến trình8443 người dùng.
- Capture NPF_Loopback TCP18443/host127.0.0.1, max20s/1024KiB/200packets.
  Thực tế35packets/0drop,11packet chứa H2; tcp.stream0 client49806, stream H2=1.
- TShark4.6.9 với keylog lab riêng đọc SETTINGS/WU packet12, health HEADERS14,
  response22/:status200. Chỉ một Gateway observation và một health request trong
  capture, ghép cùng phiên rõ ràng. Mọi metadata và Akamai text/Node MD5 khớp Go.
- SETTINGS1:65536;2:0;4:6291456;6:262144, WU15663105, standalone priorities[],
  HEADERS exclusive=true/dependency0/weight256, pseudo method/authority/scheme/path.
  Akamai text/hash khớp baseline Chrome ở M1-03g.
- Evidence ignored: .local-backups/h2-same-session-1793349076648/result.json,
  http2.json, gateway.log, dumpcap.log, chrome-health.pcapng; tls.keys riêng không
  in/embed/share. PCAP SHA2563ca176015673fba91c2a7207f68aa9a480905d1e55087da110804a86a4301636.
- Gateway/Chrome/dumpcap thử kết thúc, cổng18443 đã kiểm tra bind lại được.
  TLS keylog chỉ bật trong env process thử. Chứng chỉ allowlist SPKI chỉ Chrome
  process/profile lab; không thay trust store hay cấu hình browser người dùng.
- Đây là một Chrome headless sample, không chứng minh mọi browser/session hoặc
  hiệu năng/tất cả failure paths. Không rerun application tests ở capture-only slice;
  bằng chứng vet/tests/race/build của M1-03g giữ nguyên. Không dataset/K3s/model.

### M1-03g — Akamai serialization/hash (hiện tại, 30/10/2026)
- akamai.go tạo chuỗi numeric SETTINGS|connection-WU|standalone-PRIORITY|pseudo-order.
  Giữ wire order, không sort; ID lạ/ID lặp/settings value0 giữ nguyên.
  PRIORITY tuple dùng stream:exclusive(0/1):dependency:weight(1..256), nối dấu phẩy;
  danh sách quan sát rỗng dùng 0. HEADERS priority vẫn là metadata riêng, không gộp vào tuple.
- Profile output: akamai-h2-four-field-v1, text không whitespace/newline và MD5
  lowercase hex của đúng bytes text. MD5 là nhãn fingerprint tương thích, không xác thực.
- Chỉ xuất khi status=headers_observed, SETTINGS đã quan sát, connection WU có
  increment hợp lệ, PRIORITY interval đã quan sát và đủ bốn pseudo-header m/a/s/p
  không lặp. Extended/partial CONNECT chưa hỗ trợ serializer, vẫn giữ metadata.
- Mọi status lỗi/thiếu/unsupported trả akamai=null, akamai_reason cụ thể.
  Không thay WU thiếu bằng 0/00 dù format tham chiếu có sentinel absent. Đây là
  missing-capture policy của dự án, không được hiểu là client không gửi WU.
- Event JSON có akamai={format,text,md5} hoặc null. Serializer chạy trên snapshot
  sau khi trả slot, không giữ parser/headers và không ảnh hưởng proxy decision.
- Fixture Chrome baseline/live metadata: text
  1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p
  MD5 52d84b11737d980aef856699f885ca86.
- Test fixture Firefox từ paper, Chrome từ baseline; MD5 kỳ vọng tính độc lập bằng
  Node crypto. Order/duplicate/unknown/settings empty/priority vs HEADERS priority,
  missing/error/unsupported và live event integration PASS. gofmt/vet/full tests/
  race/build PASS. Chưa restart code mới hay đối chiếu hash live cùng phiên bằng tool độc lập.
- Nguồn primary format: Akamai Black Hat EU2017 whitepaper §4 (bản gốc có pseudo
  suffix và absent WU00); curl_cffi customize docs (four-field representation).
  TrackMe source đã đọc tại commit 9d2e865ad663ae114e28c33ddc08a4797b4ecaa8:
  https://github.com/pagpeter/TrackMe/blob/9d2e865ad663ae114e28c33ddc08a4797b4ecaa8/pkg/http/fingerprint_h2.go
  và pkg/server/connection_handler.go (MD5 call, priority weight+1).
  https://www.blackhat.com/docs/eu-17/materials/eu-17-Shuster-Passive-Fingerprinting-Of-HTTP2-Clients-wp.pdf
  https://github.com/lexiforest/curl_cffi/blob/main/docs/impersonate/customize.rst

### M1-03f — live owner và tích hợp Gateway (hiện tại, 30/10/2026)
- main.go nạp certificate, cấu hình ALPN h2/http/1.1 rồi Server.Serve qua
  observedTLSListener. Go 1.27.3 nhận diện wrapper TLS qua HandshakeContext/
  ConnectionState; GetConfigForClient/JA4 và keylog opt-in vẫn hoạt động theo code.
- h2_live.go giữ parser riêng cho mỗi connection; tối đa 128 observer đang thu
  bằng channel slots. Đây không phải giới hạn tổng số TCP connection/request.
  Hết slot: một event observation_unavailable/capacity, proxy tiếp tục bình thường.
- Làm rõ mốc timeout: 2 giây từ lần Read H2 đầu tiên được gọi sau handshake,
  trước khi chờ byte plaintext. Client im lặng cũng hết thời gian quan sát.
  Không tính từ TCP accept; không thay read deadline/đóng kết nối khi observer timeout.
- Read, timer callback và Close dùng chung mutex. Kết thúc quan sát chỉ một lần,
  dừng timer, bỏ parser/block và trả slot trước report; các Read sau không thu lại.
  H1/TLS handshake chưa thành công không chiếm slot observer. Không tạo keylog mặc định.
- Event H2 observation là JSON có connection_id, status/reason, settings,
  window_increment, priorities, headers_priority, pseudo_headers, frames, bytes.
  Missing=null; settings/priorities đã quan sát rỗng=[]; giá trị header/body/key không
  có trong snapshot/log. ID này chưa được ghép vào log JA4, không phải client identity.
- Integration tests dùng production listener/manager: H1/H2 proxy 200, saturated
  slots vẫn 200, TLS peer im lặng timeout nhưng Read mạng còn chờ, Close đồng thời,
  đúng 128 observer/129 bypass/re-admission và cleanup PASS. Full Go tests/vet/race/
  build PASS. Không đo throughput/latency/memory full-lab hoặc chống DDoS thực tế.
- Chưa restart Gateway do người dùng đang chạy, chưa smoke binary trên 8443/backend
  thật, chưa live Chrome/capture độc lập hoặc Akamai text/hash. Source đã tích hợp;
  cần restart để tiến trình cũ dùng code mới. Không gọi M1-03 DONE.

### M1-03e — HPACK/CONTINUATION (hiện tại, 30/10/2026)
- Ghi đè điểm dừng M1-03d bên dưới: quan sát tới END_HEADERS của header block
  đầu tiên, kể cả nhiều CONTINUATION. Không được chen frame khác hay đổi stream.
- Dùng golang.org/x/net/http2/hpack v0.62.0, kiểm tra API trong source đã cài;
  go.mod/go.sum pin dependency. Không tự viết Huffman/dynamic-table decoder.
- Tối đa 16 KiB block nén; 4096 byte dynamic table; 8192 byte mỗi name/value;
  tối đa 128 fields và 16 KiB decoded header-list size (name+value+32 mỗi field).
  Vẫn chung budget 64 KiB/32 frame/2 giây. Đây là lab caps, không phải KPI.
- HPACK cần giữ encoded bytes và header values tạm thời để giải mã/dynamic table.
  Không ghi file/log/gửi đi các giá trị này; bỏ tham chiếu block/decoder ở mọi
  trạng thái kết thúc (không cam kết secure-zero bộ nhớ Go). Chỉ tên pseudo-header
  theo wire order được giữ làm kết quả. Không giữ body hay header values sau đó.
- headers_observed thay first_headers_observed. Chỉ nói đã giải mã header block
  và có :method, không chứng minh HTTP request hợp lệ toàn bộ. Kiểm tra duplicate/
  pseudo sau regular/unknown pseudo; net/http vẫn chịu trách nhiệm validation request.
  Không có WU stream0 vẫn là nil; không được tính hash đầy đủ từ dữ liệu thiếu.
- HPACK sai/truncated: invalid. Vượt cap hoặc thiếu :method: incomplete, có reason.
  Không xuất pseudo-header list một phần khi lỗi/EOF/timeout/limit.
- END_HEADERS flag lưu cho HEADERS ban đầu; false có thể vẫn thành công sau
  CONTINUATION. Status kết thúc cho biết block đã giải mã, không dựa riêng flag này.
- Tests: RFC7541 C.3.1/C.4.1 độc lập; Huffman/indexed/dynamic table, mọi split
  HPACK qua CONTINUATION/từng byte/EOF, wrong stream/interleave, malformed/limits/
  cleanup và TLS Go client proxy H1/H2 PASS. gofmt/vet/full tests/race/mod verify PASS.
- Chrome fixture trong h2_frames_test.go là tổng hợp metadata và static HPACK để
  test logic, không phải raw replay của capture Chrome. Chưa live Chrome verification.
- Chưa main.go integration, admission128/idle timer, Akamai serialization/hash.
- Nguồn: https://pkg.go.dev/golang.org/x/net/http2/hpack@v0.62.0
  và https://www.rfc-editor.org/rfc/rfc7541.html (Appendix C).

### M1-03c — parser SETTINGS đầu tiên (30/10/2026)
- Phạm vi: h2_initial.go đọc preface, frame header 9 byte và payload SETTINGS
  theo RFC 9113 §3.4, §4.1, §6.5. Đây chưa phải bộ kiểm tra toàn bộ HTTP/2.
- Giữ đúng thứ tự ID/value, kể cả ID lạ, ID lặp và giá trị 0. SETTINGS rỗng
  hợp lệ được phân biệt với chưa quan sát được SETTINGS.
- Trần riêng cho SETTINGS đầu tiên: 64 mục; đây là giới hạn lab, không phải
  giới hạn giao thức. Vượt trần: incomplete/settings_limit. Header khai báo
  vượt ngân sách đầu vào 64 KiB: incomplete/byte_limit, không cấp phát payload.
- Trạng thái collecting → settings_observed, incomplete hoặc invalid.
  Sai preface/header/giá trị SETTINGS được kiểm tra: invalid kèm lý do.
  EOF/read error khi chưa đủ dữ liệu: incomplete/read_ended. Timeout: incomplete/timeout.
  Dữ liệu SETTINGS một phần bị loại bỏ khi kết thúc thất bại.
- settings_observed chỉ xác nhận SETTINGS đầu tiên, chưa là fingerprint hoàn chỉnh.
  feed trả số byte đã dùng để lớp gọi có thể chuyển tiếp phần còn lại cho parser sau.
- Deadline 2 giây được kiểm tra khi gọi feed (kể cả feed rỗng). Parser không tạo
  timer/goroutine; owner tương lai phải kiểm tra khi read idle và dọn tài nguyên.
- Test wrapper hiện gọi parser với dữ liệu Go client thật. Chưa tích hợp main.go;
  giới hạn 32 frame/128 connection và timeout idle thực tế chưa được triển khai.
- Tests bao phủ mọi vị trí chia đôi, từng byte, EOF tại mọi vị trí, order/duplicate/
  unknown ID/zero/empty, reserved stream bit, frame header/SETTINGS sai, deadline,
  giới hạn 64/65 mục và độ dài payload lớn. Fixture Chrome là baseline đã chép
  từ capture; integration mới dùng Go client, chưa đối chiếu live Chrome.
- Nguồn: https://www.rfc-editor.org/rfc/rfc9113.html
- Kiểm chứng M1-03c: gofmt/go vet/full Go tests và go test -race PASS;
  race detector chỉ kiểm tra các đường chạy trong tests hiện có.

### Kiểm chứng dự kiến
- Đối chiếu từng trường với capture Chrome đã lưu.
- Kiểm tra frame bị chia qua nhiều lần đọc.
- Kiểm tra thiếu dữ liệu, dữ liệu lỗi và vượt giới hạn.
- Xác nhận proxy HTTP/1.1 và HTTP/2 vẫn hoạt động.

### M1-03d — metadata sau SETTINGS (30/10/2026)
- h2_frames.go ghép parser SETTINGS với vòng đọc frame tiếp theo, dùng chung
  ngân sách 64 KiB/2 giây. Trần 32 frame tính cả SETTINGS đầu tiên.
- Giữ WINDOW_UPDATE stream 0 đầu tiên (bỏ reserved bit), increment phải khác 0.
  WINDOW_UPDATE stream khác không được dùng làm connection increment.
  nil có nghĩa chưa thấy trong khoảng quan sát, không thay bằng số 0.
- PRIORITY frames giữ wire order, stream, exclusive, dependency và weight thực
  bằng byte + 1. HEADERS priority giữ riêng, xử lý đúng PADDED/PRIORITY flags.
  Kiểm tra độ dài, stream 0 không hợp lệ, tự phụ thuộc và padding vượt payload.
- Chỉ giữ tối đa 6 byte metadata của frame; bỏ qua payload không cần thiết,
  không giữ HPACK/body/header values, không cấp phát theo payload length.
- Lát cắt hiện tại dừng ở cuối HEADERS frame đầu tiên, ghi stream và END_HEADERS.
  first_headers_observed chỉ nói metadata frame đã thu, không khẳng định HPACK
  hợp lệ hoặc fingerprint đủ. CONTINUATION/HPACK/pseudo-header chưa xử lý.
- Danh sách PRIORITY rỗng chỉ có nghĩa không có PRIORITY frame trước HEADERS
  đầu tiên trong cửa sổ đã đọc; không kết luận client không bao giờ gửi PRIORITY.
  EOF/timeout/limit là incomplete; invalid frame được nhận diện là invalid.
  Các metadata đã quan sát trước lỗi có thể còn để chẩn đoán, không dùng tạo hash.
- Trần frame/byte đã có trong parser; idle timer thực tế và 128-slot admission
  vẫn cần owner khi tích hợp live. Không thay main.go trong lát cắt này.
- Kiểm chứng: mọi split/từng byte/EOF; Chrome metadata fixture 15663105 và
  HEADERS exclusive=1/dependency=0/weight=256; standalone priorities khác với
  HEADERS priority; reserved bits, padding, missing metadata, malformed frames,
  timeout và biên 32 frame/64 KiB. Go-client TLS proxy H1/H2, vet/full tests/race PASS.
- Nguồn: RFC 9113 §6.2/6.9 và RFC 7540 §6.2/6.3 cho legacy priority fields.

### Vị trí observer — phương án cần kiểm chứng
TLS giải mã → observer đọc bản sao có giới hạn → net/http xử lý H2 → proxy.

Observer chỉ đọc dữ liệu client gửi vào; phải chuyển nguyên byte và lỗi đọc
cho net/http. Chỉ kích hoạt khi TLS đã thương lượng ALPN `h2`.
HTTP/1.1 đi qua đường xử lý hiện tại.

Một kết nối chỉ giữ dữ liệu cần thiết để hoàn thành fingerprint đầu tiên.
Hết thời gian, vượt giới hạn hoặc lỗi giải mã thì ghi trạng thái incomplete
và ngừng quan sát; request vẫn được net/http xử lý theo lỗi thực tế.

Cần kiểm chứng trước khi chọn cách bọc kết nối:
- Go vẫn nhận ra kết nối TLS và tự bật HTTP/2.
- Byte bị chia giữa nhiều lần Read vẫn được ghép đúng.
- Không đọc trước làm treo request hoặc thay đổi timeout.
- Không lưu toàn bộ body hay header value.

### M1-03b — thử điểm bọc TLS (đã kiểm chứng 30/10/2026)
- Test-only: gateway/observer_conn_test.go, chưa tích hợp vào main.go.
- Trên Go 1.27.3, kiểu bọc nhúng *tls.Conn giữ HandshakeContext và
  ConnectionState. Read gọi tls.Conn.Read rồi trả nguyên n/err cho net/http.
- Server.Serve với TLSConfig.NextProtos có h2/http/1.1 phục vụ được cả hai
  giao thức qua proxy tới upstream loopback thử nghiệm.
- Hai GET /health cho mỗi giao thức trả 200 và body đúng; H2 ALPN=h2,
  observer nhận đúng 24 byte client preface. H1 không kích hoạt observer.
- Chỉ giữ prefix cố định 24 byte trong test; chưa parser frame, chưa cơ chế
  timeout/capacity/cleanup của observer thực tế, chưa Akamai fingerprint.
- gofmt, go vet và toàn bộ Go tests PASS. Đây là Go-client integration test,
  chưa chứng minh Chrome capture hoặc byte-fragment/error handling đầy đủ.
- Cách nhận diện kiểu bọc phụ thuộc Go 1.27.3 đã kiểm tra; cần chạy lại test
  khi nâng Go, không mặc định mọi phiên bản có cùng hành vi.

## M1-04 — request telemetry và health (implemented locally)

Chốt contract M1-04a, triển khai/kiểm chứng M1-04b ngày30/10/2026. Schema/HTTP behavior/acceptance canonical nằm tại
[API_CONTRACT.md — Gateway M1-04](API_CONTRACT.md#gateway-m1-04--contract-v1-implemented-locally).
Phần này ghi mục đích/cách đo; không phải evidence runtime hay bảng12features hoàn chỉnh.

### Workflow và nguồn event
- Gateway nhận HTTP request sau TLS → tạo request ID + lấy connection context →
  local health hoặc proxy → ghi một JSON completion event sau return/abort/panic.
- `/gateway/health` GET/HEAD kiểm Gateway liveness, không gọi backend; `/health`
  vẫn đi tới backend. Cả local health405 cũng thuộc route_kind=gateway_local.
- `request_id` do Gateway tạo; client không tự chọn request ID đáng tin cậy.
  `connection_id` là ID listener/H2 hiện có, không phải IP hoặc user identity.
- `client_ip` lấy socket RemoteAddr, không source port; unmap IPv4-mapped IPv6.
  Parse lỗi: null/unavailable, không gán tất cả về127.0.0.1. Không tin forwarded
  headers; outbound XFF phải được dựng lại từ peer thật, không nối spoofed list.
  NAT/shared IP chưa được giải quyết bằng mô hình client identity này.

### Định nghĩa phép đo
- `started_at`: wall-clock UTC tại handler entry; `completed_at`: UTC khi chốt
  completion event, trước encode/write log. RFC3339Nano, timestamps không lấy từ client.
- `latency_ms = time.Since(start).Seconds()*1000`: monotonic duration của handler,
  bao gồm upstream wait/body copy, không bao gồm TLS setup hoặc thời gian ghi log
  sau khi đã chốt event. Giá trị finite >=0, đơn vị ms, có thể có phần thập phân.
- `response_bytes`: tổng n ghi body thành công, không cộng byte header và không
  dùng len(buffer) khi partial write. Status final chưa commit: null, không tự gán200.
- `upstream_attempted`: transport RoundTrip đã được gọi; không đồng nghĩa backend
  nhận request, HTTP success hay workload được admitted. `upstream_status` và
  `status_code` phân biệt response backend với response Gateway sinh ra.
- `route` chỉ là tập template cố định trong API contract; không log raw URL/query,
  body, headers, synthetic identity hoặc arbitrary error/panic text.

### Ranh giới với ML/window/scaling
- M1-04 chỉ hoàn tất per-request telemetry/health. Không tính hay xuất mock12features,
  model input, policy decision, Prometheus labels, dataset ground truth hoặc replicas.
- Completion event đến sau request start; không đếm số event nhận trong cửa sổ để
  suy ra arrival RPS. Collector sau này phải ghi nhận arrival/admission tại đúng thời
  điểm và xử lý pending/late/canceled requests trước khi chốt công thức5s window.
- Health local không thuộc workload/admitted RPS; lỗi backend, local rejection và
  traffic thực sự forwarded cần thống kê riêng. Bộ đếm/fail-safe đó thuộc contract
  window/policy sau, không được suy luận từ upstream_attempted ở bước này.
- JA4/H2 messages hiện không có đầy đủ correlation/missing schema cho mọi request;
  phần join TLS fingerprint vào request/window sẽ cần đặc tả trước thu dataset.

### Verification dự kiến cho M1-04b
- Local health hoạt động khi backend down; forwarded health lỗi đúng502.
- H1/H2/reused connection/concurrent requests, ID generation/propagation/correlation,
  spoofed headers/IP parsing và bounded route fields có regression tests.
- Upstream domain errors vs transport errors, timeout/cancel/partial writes/abort/
  panic được log đúng1event, status/bytes thật, không rò body/query/headers/secrets.
- Không tạo client map/queue vô hạn; metadata chỉ giữ trong lifecycle request.
  Console output synchronous có thể block; chưa claim benchmark hay durable delivery.
- M1-04b gofmt/vet/full tests/race/build và controlled compiled smoke PASS,
  evidence trong API_CONTRACT.md/PROGRESS.md. M1-04a trước đó chỉ review docs.
  User Gateway vẫn cần restart để nạp code; window12features chưa triển khai.
