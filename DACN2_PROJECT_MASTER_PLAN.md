# DACN2 — PROJECT MASTER PLAN & AGENT HANDOFF

> **Đồ án chuyên ngành 2 (DACN2) — Product-first implementation plan**  
> **Tên đề tài gốc:** *An Autonomous Cyber-Defense Framework Using Golang Ingress Telemetry and Machine Learning for Distinguishing Layer-7 DDoS from Flash Crowds on Kubernetes*  
> **Tên ngắn:** Hệ thống phòng thủ L7 DDoS tự động bằng Go Gateway, AI và Kubernetes  
> **Phiên bản kế hoạch:** 1.1 — 29/10/2026 (đồng bộ tài liệu; chưa thay đổi kiến trúc/KPI)  
> **Tài liệu nguồn:** `Report.pdf` (Preliminary Report, 5 trang, VKU)  
> **Trạng thái triển khai thực tế:** **CHƯA XÁC MINH**. Đây là kế hoạch, không phải báo cáo đã hoàn thành.

---


## Trạng thái và quy ước sau rà soát 29/10/2026

- Đây là kế hoạch, không phải bằng chứng triển khai. Workspace được kiểm tra có tài liệu và Git metadata; chưa thấy mã ứng dụng, manifests, tests, CI, dataset hoặc model artifacts. Chưa audit đầy đủ runtime/phần cứng; M0 vẫn chưa hoàn thành.
- File master plan canonical nằm tại gốc: `DACN2_PROJECT_MASTER_PLAN.md`. Tracker duy nhất: `tasks/current.md`; quyết định: `docs/ARCHITECTURE.md`; checkpoint: `docs/PROGRESS.md`. Không tạo bản master plan trong docs hoặc tracker song song.
- Skill routing theo M0–M6 nằm trong `docs/SKILL_ROUTING.md`: API/security/observability bắt đầu từ thành phần đầu tiên; benchmark năng lực một Pod từ M1. Danh sách là routing index, chưa phải skill pack đã cài; revision upstream chưa được pin.
- **Câu hỏi mở về scope:** 12 features xuất hiện ở MVP/M1–M2 nhưng hoàn thiện capture được xếp P1 tại §7. Giữ nguyên mục tiêu 12 feature, ghi GAP nếu thiếu và xác nhận yêu cầu nghiệm thu trước khi chấp nhận phạm vi rút gọn; cập nhật này không tự giải quyết thay người dùng/giảng viên.
- **Câu hỏi mở về nghiệm thu:** demo lab tái lập là đầu ra mô tả trong kế hoạch. Production deployment và kiểm chứng với người dùng thật vẫn là các tiêu chuẩn riêng chưa đạt trong `CONSTRAINTS.md`; cần xác nhận phạm vi nghiệm thu học phần, không đánh đồng demo với các tiêu chuẩn đó.
- Lịch và phân công trong Report là tham chiếu; phải kiểm tra nguồn lực/ngày còn lại thực tế. Nội dung Report.pdf chưa được đối chiếu độc lập trong lượt cập nhật Markdown này.
## 0. HƯỚNG DẪN BẮT ĐẦU CHO CODING AGENT (ĐỌC TRƯỚC)

Bạn là coding agent triển khai một **đồ án phần mềm hoạt động thực tế**, **không phải** dự án thuần nghiên cứu. Mục tiêu là có sản phẩm chạy từ đầu đến cuối, kiểm thử được và demo được. Không dành phần lớn thời gian cho literature review, so sánh học thuật hoặc nhiều baseline ML nếu không cần thiết.

**Ngay khi nhận dự án:**

1. Đọc `tasks/current.md`, sau đó toàn bộ file này ở lần định hướng đầu tiên (các lần tiếp tục chỉ đọc phần liên quan), `CONSTRAINTS.md`, `docs/PROGRESS.md` và `docs/ARCHITECTURE.md`. Đối chiếu `Report.pdf` khi cần xác minh nội dung báo cáo; không tuyên bố đã đọc nếu chưa kiểm tra.
2. Khảo sát repository, cấu hình máy, công cụ sẵn có, mã nguồn và các service đang chạy. **Không mặc định bất kỳ hạng mục nào đã hoàn thành.**
3. Đối chiếu thực trạng với các cổng nghiệm thu (Definition of Done) trong tài liệu này; đánh dấu `DONE`, `IN_PROGRESS`, `BLOCKED`, `TODO` kèm bằng chứng (lệnh test, log, file, commit).
4. Nếu repository chưa có mã: bắt đầu từ **M0 → M1**. Nếu đã có: **tiếp tục từ hạng mục chưa hoàn thành sớm nhất** và không làm lại phần đã ổn định.
5. Làm theo từng lát cắt nhỏ có thể chạy được. Ưu tiên đường đi `client → Go Gateway → backend` trước, sau đó thêm telemetry, data, AI, phòng thủ, autoscaling và dashboard.
6. Với mọi thay đổi: triển khai → test → ghi kết quả → cập nhật `docs/PROGRESS.md` → mới chuyển nhiệm vụ kế tiếp.
7. Khi bị dừng, gần hết context/token, gặp lỗi hoặc kết thúc phiên làm việc: **bắt buộc viết checkpoint** theo mẫu ở §11. Agent tiếp theo phải tiếp tục được mà không cần hỏi lại thông tin đã có.

**Nguyên tắc không được vi phạm:**

- Không bịa dữ liệu, feature, kết quả huấn luyện, KPI, tiến độ, logs hoặc kết quả chạy test.
- Không coi IP/JA4 trùng nhau là bằng chứng duy nhất của bot; không đánh đồng phát hiện `Mixed_Traffic` với việc biết chính xác từng bot.
- Không tạo traffic tấn công tới dịch vụ công cộng hay hệ thống không được phép. Chỉ kiểm thử với mục tiêu do nhóm kiểm soát trong lab cô lập, giới hạn tài nguyên, có cơ chế dừng khẩn cấp.
- Không hard-code token/mật khẩu vào mã nguồn. Không log cookie, thông tin đăng nhập hay dữ liệu nhận dạng nhạy cảm không cần thiết.
- Không trộn ngẫu nhiên các cửa sổ 5 giây của cùng phiên vào train và test (data leakage).
- Không tự động chặn hàng loạt client chỉ vì model dự báo trạng thái DDoS/Mixed; phải có bằng chứng ở cấp client và cơ chế fail-safe.
- Không thay đổi kiến trúc chính, định nghĩa feature hoặc phạm vi dự án một cách âm thầm. Ghi `docs/ARCHITECTURE.md` và nêu rõ ảnh hưởng tới `Report.pdf`.

---

## 1. TỔNG QUAN SẢN PHẨM

### 1.1. Bài toán

Website có thể nhận lượng truy cập tăng mạnh vì:

- **Flash Crowd:** nhiều người dùng thật cùng truy cập (ví dụ đăng ký học phần, flash sale).
- **Layer-7 DDoS:** nhiều client/bot gửi HTTP/HTTPS request để làm cạn tài nguyên backend.
- **Mixed Traffic:** bot tấn công đồng thời với Flash Crowd.

Các tình huống này có thể cùng có RPS cao và IP đa dạng. Auto-scaling chỉ theo CPU hoặc tổng request có thể tăng tài nguyên để phục vụ bot, gây lãng phí (*Economic Denial of Sustainability*, EDoS).

### 1.2. Mục tiêu cốt lõi

**Xây dựng hệ thống tự động thu thập dữ liệu tại Go Ingress Gateway, phân loại trạng thái traffic bằng Machine Learning, giới hạn/chặn client đáng ngờ và điều khiển Kubernetes mở rộng backend theo request đã được cho phép đi qua.**

Sản phẩm cần minh họa được rằng:

1. Khi có Flash Crowd hợp lệ: website tiếp tục phục vụ, số Pod có thể tăng.
2. Khi có Pure L7 DDoS: Gateway phát hiện nguy cơ, áp dụng chính sách giới hạn/chặn phù hợp.
3. Khi có Mixed Traffic: hạn chế bot **mà vẫn giữ khả năng truy cập của người dùng thật**; không scale theo lưu lượng bị chặn.
4. Khi tải giảm: số Pod giảm về mức tối thiểu theo chính sách cooldown.
5. Có dashboard trực quan và log để quan sát các quyết định.

### 1.3. Phạm vi bắt buộc (MVP/đầu ra đồ án)

- [ ] Backend demo NestJS + PostgreSQL có API thể hiện thao tác người dùng (có thể là web đăng ký/mua hàng mô phỏng).
- [ ] Custom Golang Gateway nhận TLS/HTTPS và reverse proxy được tới backend.
- [ ] Gateway thu thập telemetry HTTP/TLS/HTTP2, xuất dữ liệu theo cửa sổ 5 giây và thống kê RPS total/admitted/blocked.
- [ ] Dataset **tự thu thập trong lab**, có nhãn 4 lớp và `session_id`; dữ liệu raw + dữ liệu feature/window.
- [ ] Python FastAPI phục vụ model ML phân loại 4 trạng thái; có model artifact, preprocessing artifact và API rõ schema.
- [ ] Cơ chế client suspicion score và chính sách giảm/giới hạn/chặn có thể cấu hình, có fail-safe khi AI không sẵn sàng.
- [ ] K3s triển khai backend và hỗ trợ scale số Pod dựa trên lượng traffic **được chấp nhận**, không chỉ dựa tổng traffic.
- [ ] Grafana thể hiện trạng thái traffic, xác suất AI, RPS, chặn request, latency, replica và tài nguyên.
- [ ] Bộ script kiểm thử và demo 3 pha; hướng dẫn chạy lại trên máy nhóm.

### 1.4. Không bắt buộc trong phiên bản sản phẩm đầu tiên

- Nghiên cứu/so sánh đầy đủ 5 model ML, LOTO chuyên sâu, ablation study hoặc viết paper khoa học.
- Sử dụng Black Friday Dataset hoặc các public dataset làm bộ train chính.
- Nhiều máy vật lý, cluster cloud production, CDN bên ngoài, driver kernel, công cụ chống tấn công quy mô Internet.
- Dashboard quá nhiều màn hình, frontend thương mại điện tử hoàn chỉnh hoặc phân tích danh tính chủ botnet.

> **Phân biệt với báo cáo gốc:** `Report.pdf` có đề cập 5 model, GroupKFold, SMOTE, LOTO, CPU-HPA baseline, IP-rate-limiter baseline và ablation study. Đây là thiết kế tham vọng của preliminary report. Với định hướng **đồ án xây sản phẩm**, ưu tiên hệ thống chạy được; chỉ làm so sánh mở rộng khi còn thời gian hoặc được giảng viên yêu cầu. Tuy nhiên, vẫn phải đánh giá AI trung thực trên các phiên độc lập.

---

## 2. KIẾN TRÚC KỸ THUẬT

```text
             Playwright / k6 / Browser / Traffic generators
                          (LAB ONLY)
                               |
                               v
                      HTTPS / HTTP2 clients
                               |
                               v
 +------------------------------------------------------------+
 | TIER 1 — CUSTOM GOLANG SECURITY INGRESS GATEWAY            |
 | TLS termination + JA4 + HTTP/2 observer + HTTP proxy      |
 | Per-client events / suspicion scoring / mitigation         |
 | 5-second telemetry windows + RPS total/admitted/blocked    |
 +----------------------+---------------------+---------------+
                        |                     |
            telemetry   |                     | admitted traffic
                        v                     v
 +--------------------------------+  +-----------------------+
 | TIER 2 — PYTHON FASTAPI         |  | TIER 3 — K3s BACKEND   |
 | Feature validation             |  | NestJS + PostgreSQL   |
 | 4-class ML inference           |  | 1–5 Pod replicas      |
 | Decision + Kubernetes scaler   |  +-----------------------+
 +----------------+---------------+              |
                  |                              |
       authenticated commands                    |
           +------+------------------------------+
           v
       Gateway policy updates + K3s replica updates
                  |
                  v
      Prometheus/metrics + Grafana Dashboard
```

### 2.1. Tier 1 — Go Gateway

- Là điểm tiếp nhận trực tiếp client HTTPS để có thể quan sát TLS ClientHello thật; không đưa CDN terminate TLS lên trước gateway trong lab.
- Reverse proxy tới backend; hạn chế giải mã hoặc tự viết lại HTTP/2 ngoài phạm vi cần thiết.
- Trích xuất JA4 theo đặc tả FoxIO; mục tiêu có `ja4`, `ja4_r`, `ja4_o`, `ja4_ro` như report.
- HTTP/2 fingerprint theo định dạng Akamai `SETTINGS|WINDOW_UPDATE|PRIORITY|PSEUDO_ORDER`, ghi `akamai_text`, `akamai_hash` và cờ completeness/error. **Không chế hash khi capture lỗi.**
- Tách event từng request/client và aggregate cửa sổ 5 giây; có danh sách client/connection nghi ngờ.
- Thiết kế telemetry schema có version; report nêu `traffic-lab.v2` đối với bản capture mới.
- Có điểm nối feedback từ AI để cập nhật threshold hoặc chính sách, với xác thực token.

### 2.2. Tier 2 — Python AI Control Plane

- Validate đầu vào và version schema; preprocessing **nhất quán** lúc train và lúc inference.
- Model 4-class: `0=Normal`, `1=Flash_Crowd`, `2=Pure_L7_DDoS`, `3=Mixed_Traffic`.
- Trả về xác suất 4 lớp, nhãn dự đoán, thời gian inference, model version.
- Điều phối policy Gateway và quyết định số Pod; không tự coi `p(Mixed)>...` là danh sách bot.
- API gateway↔orchestrator có auth, timeout, log và kiểm tra retry/idempotency.

### 2.3. Tier 3 — Kubernetes/K3s

- Backend NestJS và PostgreSQL; ứng dụng có endpoint dynamic (không chỉ trả JSON tĩnh) để đo tải có ý nghĩa.
- Theo Report, mỗi backend Pod mục tiêu `cpu: 200m`, `memory: 256Mi` trong môi trường lab; giới hạn tùy khả năng máy và kết quả đo.
- Scale tối thiểu 1, tối đa 5 Pod bằng Kubernetes API/Scale subresource thông qua tài khoản được phân quyền tối thiểu.
- `C` = năng lực phục vụ req/s của 1 Pod phải **đo thực tế** (Report nêu ước tính khoảng 40–45, không coi là số đã chứng minh).
- Công thức thực dụng: `replicas = clamp(ceil(RPS_admitted / C), 1, 5)`.
- Có cooldown/hysteresis để tránh liên tục tăng-giảm Pod; tránh xung đột với HPA khác cùng sửa `replicas`.

### 2.4. Monitoring

- Chỉ số: incoming RPS, admitted RPS, blocked/limited RPS, AI state/probabilities, inference latency, upstream latency, live replicas, CPU/RAM, threshold hiện hành, sự kiện AI timeout/fail-safe.
- Có time series cho 3 pha demo, kèm timestamps đồng bộ; dashboards không được hiển thị chỉ số mock khi đang quảng bá là số liệu thực.

---

## 3. DỮ LIỆU, TELEMETRY VÀ AI

### 3.1. Bốn nhãn dữ liệu

| Label | Tên | Ý nghĩa |
|---|---|---|
| 0 | `Normal` | Traffic hợp lệ ở mức bình thường |
| 1 | `Flash_Crowd` | Nhiều người dùng hợp lệ truy cập đồng thời |
| 2 | `Pure_L7_DDoS` | Traffic tấn công L7 trong lab, không có Flash Crowd chủ đích |
| 3 | `Mixed_Traffic` | Traffic hợp lệ tăng mạnh cùng lúc traffic tấn công |

**Hai cấp nhãn cần lưu riêng:**

1. `window_label` cho từng cửa sổ 5 giây: nhãn 0–3 của trạng thái tổng thể.
2. `client/request_ground_truth` tại traffic generator: hợp lệ/bot, `generator_id`, `scenario_id` để kiểm chứng mức chặn nhầm khi Mixed. **Không dùng ground truth làm đầu vào suy luận.**

Một mô hình chỉ dự báo `Mixed_Traffic` **không thể tự chỉ ra chính xác IP nào là bot**. Client Scorer cần dùng bằng chứng bổ sung và đo false positives độc lập.

### 3.2. 12 feature mục tiêu trong `Report.pdf`

| # | Tên logic | Ký hiệu trong báo cáo | Ý nghĩa |
|---|---|---|---|
| 1 | `r_no_grease` | `Rno-grease` | Tỷ lệ client/request thiếu TLS GREASE |
| 2 | `rho_ja4` | `ρJA4` | Tỷ lệ JA4 duy nhất trên số IP client duy nhất |
| 3 | `m_cross` | `Mcross` | Tỷ lệ User-Agent không phù hợp với TLS/H2 fingerprint |
| 4 | `s_mux` | `S̄mux` | Số HTTP/2 streams trung bình mỗi TCP connection |
| 5 | `h_ip` | `H(IP)` | Shannon entropy phân bố IP |
| 6 | `h_uri` | `H(URI)` | Shannon entropy phân bố base endpoint URI |
| 7 | `h_query` | `H(Query)` | Shannon entropy query string |
| 8 | `r_static` | `Rstatic` | Tỷ lệ request tài nguyên tĩnh |
| 9 | `r_ip` | `r̄IP` | Request trung bình mỗi IP hoạt động trong cửa sổ |
| 10 | `iat` | `IAT` | Khoảng cách request liên tiếp trung bình mỗi client |
| 11 | `l_markov` | `LMarkov` | Log-likelihood chuỗi điều hướng theo mô hình Markov |
| 12 | `t_up` | `T̄up` | Latency phản hồi backend trung bình |

**Bắt buộc trước khi thu thập đại trà:** Viết `docs/FEATURE_SPEC.md` nêu với mỗi feature: nguồn event, công thức, đơn vị, phạm vi hợp lệ, cách xử lý mẫu số bằng 0, mất kết nối, HTTP/1.1 không có H2, thiếu JA4, buffer đầy và timestamp. Bảng trên là **đặc tả cấp ý tưởng từ Report**, chưa thay cho công thức triển khai và test.

**Quy tắc chất lượng:**

- Log raw events cùng schema version; tổng hợp thành dữ liệu ML theo cửa sổ **5 giây**, ghi `window_start`, `window_end`, `session_id`.
- Nếu thực hiện sliding windows chồng lấn: ghi rõ `window_size` và `stride`; mọi cửa sổ từ cùng phiên phải ở cùng train/test split.
- Thiếu capture TLS/H2 phải có `is_complete`/error reason; không điền giá trị `0` như thể quan sát thực.
- Đừng trộn các giá trị metadata nhận biết tên công cụ tạo traffic, scenario ID hoặc label vào vector 12 feature.
- Bảo vệ riêng các khóa/ID; tránh log toàn bộ token phiên, cookie, credential, payload cá nhân.

### 3.3. Định dạng dữ liệu và API đề xuất

Đây là **đề xuất triển khai**, không phải JSON contract nguyên văn từ Report; cần chốt version và lưu vào `docs/API_CONTRACT.md`.

```json
{
  "schema_version": "traffic-lab.v2",
  "session_id": "session_001",
  "window_start": "2026-10-29T10:00:00Z",
  "window_end": "2026-10-29T10:00:05Z",
  "features": {
    "r_no_grease": null,
    "rho_ja4": null,
    "m_cross": null,
    "s_mux": null,
    "h_ip": null,
    "h_uri": null,
    "h_query": null,
    "r_static": null,
    "r_ip": null,
    "iat": null,
    "l_markov": null,
    "t_up": null
  },
  "metrics": {
    "rps_total": null,
    "rps_admitted": null,
    "rps_blocked": null
  },
  "quality": {
    "tls_capture_complete": false,
    "h2_capture_complete": false
  }
}
```

`null` trong ví dụ là placeholder (không phải dữ liệu đo). Pipeline phải có quy tắc xử lý missing rõ ràng và model không được âm thầm bỏ qua trường đầu vào khi inference.

### 3.4. Phương pháp tạo dataset (LAB cô lập)

- Chạy backend riêng do nhóm sở hữu; dùng Playwright cho client browser hợp lệ, kết hợp k6 cho traffic có think-time và luồng thao tác có mục tiêu.
- Report đặt mục tiêu **ít nhất 50% traffic người dùng hợp lệ được tạo bằng trình duyệt Playwright** để có TLS/HTTP2 thực hơn; đây là mục tiêu từ nguồn.
- Tạo đủ `Normal`, `Flash_Crowd`, `Pure_L7_DDoS`, `Mixed_Traffic`; mọi kiểm thử gây quá tải/tấn công chỉ chạy trên mục tiêu lab được phép, có rate cap, thời lượng tối đa và kill switch.
- Đa dạng phiên, thời điểm, lượng client và công cụ; tránh ràng buộc kiểu `k6 => Flash`, `aiohttp => DDoS` khiến model chỉ nhớ dấu hiệu tool.
- Mỗi phiên có `session_id` duy nhất, cấu hình traffic, ngày chạy, seed, code version, giới hạn tài nguyên, summary, nhãn và nhật ký lỗi.
- Report đề xuất **2.400–3.600 cửa sổ** 5 giây qua **~25 phiên độc lập**. Đây là mục tiêu kế hoạch, có thể điều chỉnh khi lab cho thấy chưa đủ đa dạng dữ liệu.
- Kiểm tra số IP thực sự quan sát tại Gateway (NAT, proxy hoặc môi trường Docker có thể làm nhiều client dùng chung IP). Không giả lập “nhiều IP” chỉ bằng cách đổi header `X-Forwarded-For` mà không có biên tin cậy.

### 3.5. Training và đánh giá

**Tối thiểu để có sản phẩm chạy được:**

1. Build dataset các cửa sổ 5 giây có nhãn; kiểm tra mất cân bằng lớp, missing/invalid values, chuỗi thời gian, phiên trùng.
2. Chia train/validation/test **theo `session_id`**, giữ test session độc lập; dùng GroupKFold khi đủ phiên. Không random split theo dòng.
3. Train ưu tiên **XGBoost**, có thể thêm Random Forest làm model dự phòng nếu khả thi.
4. Lưu model cùng encoder/scaler/imputer nếu có, feature order, model version, dataset version.
5. Đo Confusion Matrix, per-class Precision/Recall/F1, Macro F1, FPR trên traffic hợp lệ (đặc biệt Flash Crowd) và inference latency.
6. Kiểm thử lại bằng phiên **chưa được dùng để train**, quan sát khi mô hình nhầm Flash Crowd thành DDoS và khi xuất hiện Mixed Traffic.
7. SMOTE (nếu dùng) chỉ áp dụng ở train fold; không đụng vào validation/test. LOTO là kiểm thử mở rộng có ích, không được tuyên bố đã làm nếu chưa thực hiện.

**Các KPI trong Report là MỤC TIÊU, không phải số liệu đã đạt:**

- Macro F1 > 95%.
- False Positive Rate ≤ 2% trên traffic hợp lệ.
- Thời gian suy luận AI < 10 ms **cho một cửa sổ đã tổng hợp** (không đồng nghĩa thời gian phát hiện end-to-end < 10 ms).
- Scale 1 → 5 Pods trong 4 giây trong kịch bản hợp lệ (cần đo đủ thời gian Pod Ready).

---

## 4. LOGIC PHÒNG THỦ & TỰ ĐỘNG SCALE

### 4.1. Phân tách macro và micro decisions

- **Macro classifier**: dự đoán trạng thái của *toàn hệ thống* mỗi cửa sổ: Normal / Flash / DDoS / Mixed.
- **Micro client scorer**: chấm điểm từng client/connection theo tín hiệu đáng nghi (`S_i` trong Report) để ra quyết định cụ thể.
- Khi Mixed: giữ traffic thật qua Gateway, chỉ giới hạn/chặn client có đủ tín hiệu; không drop toàn bộ lưu lượng.
- Dùng policy layer rõ ràng, cấu hình threshold và TTL; có log quyết định để kiểm tra chặn nhầm.

### 4.2. Chính sách ban đầu từ Report

| Điều kiện | Quy tắc tham chiếu |
|---|---|
| Normal / Flash Crowd | Threshold `θ = 0.95` (nới lọc) |
| Pure DDoS / Mixed | Threshold `θ = 0.65` (siết lọc) |
| Client `S_i > θ` | Giới hạn/chặn kết nối theo policy; TTL tham chiếu `60 s` |
| Lưu lượng vào > `60 req/s` | Kích hoạt vòng đánh giá/điều phối theo thiết kế Report |
| Traffic < `35 req/s` trong `60 s` | Cooldown, về 1 Pod theo policy |
| AI không phản hồi > `500 ms` | Gateway fallback token-bucket, giữ replica hiện hành |

**Quan trọng:** Đây là các thông số **thiết kế tham chiếu**, không phải giá trị đã được tối ưu hoặc bảo đảm an toàn. Chính sách phải có cấu hình, unit tests và đo tỷ lệ chặn nhầm. Ưu tiên hạn chế tốc độ trước khi hard drop nếu bằng chứng chưa đủ.

### 4.3. Autoscaling theo admitted traffic

```text
C = capacity đo thực nghiệm của 1 backend Pod (req/s)
requested_replicas = ceil(RPS_admitted / C)
replicas = max(1, min(5, requested_replicas))
```

- `RPS_admitted` phải được đo từ số request thực sự forwarded, không phải AI đoán.
- Scale controller cần phân quyền tối thiểu, retries có giới hạn, và kiểm tra `desired`, `current`, `ready` replicas.
- Không ghi nhận mục tiêu “4 giây” là đạt nếu chưa đo chính xác từ lệnh scale tới khi Pod `Ready` và backend đáp ứng.
- Khi đang thử trên máy yếu, ưu tiên độ ổn định và tính tái lập demo trước tốc độ mở rộng cực hạn.

---

## 5. LỘ TRÌNH TRIỂN KHAI 6 TUẦN (GIỮ MỐC BÁO CÁO)

> Lịch gốc: 19/10/2026–04/12/2026. Ngày soạn kế hoạch là 29/10/2026 (đang ở tuần 2 theo lịch gốc). **Chưa xác minh tiến độ hiện có**; agent cần audit trước rồi cập nhật lại ngày nếu cần, không được giả định tuần 1 đã hoàn thành.

### M0 — Khảo sát, bootstrap và thiết lập quy tắc dự án (thực hiện ngay)

**Đầu ra:** repository chạy được tối thiểu, môi trường có thể tái lập.

- [ ] `M0-01` Kiểm tra repo, cấu trúc thư mục, dependencies, OS, Go/Python/Node, Docker/K3s, RAM/CPU/disk; ghi kết quả.
- [ ] `M0-02` Đồng bộ/cập nhật các file canonical đã có; trích xuất `docs/PRODUCT.md`, `docs/REQUIREMENTS.md`, chốt acceptance cho lát cắt đầu; bổ sung `.env.example`, `.gitignore`, README theo cấu hình và lệnh chạy thực tế. Không coi task này DONE chỉ vì đã có tài liệu.
- [ ] `M0-03` Tạo backend demo tối thiểu với một API `GET /health` và một API dynamic mô phỏng thao tác người dùng.
- [ ] `M0-04` Thiết lập smoke tests, conventions log và các lệnh start/stop/test.

**DoD:** Từ máy dev có thể chạy backend và gọi API; status thực tế, blockers và lệnh chạy được ghi rõ.

### Tuần 1 — 19/10–26/10 | M1: Golang Gateway, backend và K3s tối thiểu

**Phụ trách gốc trong Report:** Thiên + Huy.

- [ ] `M1-01` HTTP(S) reverse proxy Go hoạt động: client → Gateway → NestJS.
- [ ] `M1-02` TLS termination có certificate lab hợp lệ; ghi nhận ClientHello metadata để triển khai JA4.
- [ ] `M1-03` Thực hiện extraction FoxIO JA4 và passive HTTP/2 capture; kiểm thử fixture và browser capture độc lập.
- [ ] `M1-04` Thêm event log cho request/client, latency, lỗi proxy; có health endpoint của Gateway.
- [ ] `M1-05` Deploy NestJS backend lên K3s với 1 replica (PostgreSQL cấu hình phù hợp lab).
- [ ] `M1-06` Benchmark năng lực thực của **1 Pod** và lưu dữ liệu/thông số test.

**DoD:** Có thể gọi API qua Gateway tới 1 backend Pod; telemetry cơ bản ghi đúng, có bằng chứng TLS/HTTP2 capture hoặc blocker được ghi rõ. `C` đo được, không lấy 45 req/s làm hằng số mặc định.

**MVP fallback nếu thiếu thời gian:** Đảm bảo reverse proxy + HTTP events trước; JA4/H2 phải được tiếp tục hoàn thiện trước khi khẳng định dataset 12 features đã sẵn sàng.

### Tuần 2 — 27/10–03/11 | M2: Collector + tạo dataset 4 lớp

**Phụ trách gốc:** Huy + Bảo.

- [ ] `M2-01` Chốt và test `docs/FEATURE_SPEC.md` cho 12 features.
- [ ] `M2-02` Xây dựng 5-second aggregator + schema/version + export CSV/Parquet; raw logs lưu riêng.
- [ ] `M2-03` Xây dựng Playwright/k6 traffic generator cho Normal và Flash Crowd, có ghi `session_id` và ground truth.
- [ ] `M2-04` Thiết lập thử nghiệm DDoS L7 **chỉ trên lab cô lập**, có safety cap và kill switch.
- [ ] `M2-05` Chạy Mixed Traffic trong lab với các nguồn hợp lệ/tấn công được phân biệt trong manifest.
- [ ] `M2-06` Thu thập nhiều phiên độc lập, QA schema, phân bố nhãn, missing, timestamps, network identities.
- [ ] `M2-07` Lưu `datasets/README.md`, manifest môi trường và script tái lập dữ liệu.

**DoD:** Có mẫu thực sự từ cả 4 scenario, hệ thống xuất được dataset 5 giây đọc được bằng Python; mọi window truy lại được về session và log nguồn. Mục tiêu 2.400–3.600 mẫu là chỉ tiêu, chất lượng/độc lập phiên quan trọng hơn đếm dòng.

### Tuần 3 — 04/11–10/11 | M3: Data pipeline + AI bản đầu

**Phụ trách điều phối giai đoạn AI theo Report:** Bảo + Thiên.

- [ ] `M3-01` Xây dựng data validation và preprocessing tái sử dụng cho train/inference.
- [ ] `M3-02` Chia dữ liệu theo phiên, tách holdout độc lập, kiểm tra data leakage.
- [ ] `M3-03` Train XGBoost 4 lớp, lưu artifact và metric reports.
- [ ] `M3-04` Có script predict offline trên file window CSV chưa thấy lúc train.
- [ ] `M3-05` Phân tích nhầm lẫn Flash Crowd ↔ DDoS và Mixed; xác định vấn đề dữ liệu nếu kết quả yếu.

**DoD:** Chạy một lệnh training có thể sinh model + metrics + confusion matrix; infer từ dữ liệu mới không cần notebook tương tác.

### Tuần 4 — 11/11–18/11 | M4: AI Service + Client Scorer + Gateway policy

**Phụ trách gốc:** Bảo + Thiên.

- [ ] `M4-01` FastAPI load model, có `/health` và endpoint infer có xác thực/version schema.
- [ ] `M4-02` Gateway gửi 5-second window tới FastAPI, nhận probabilities/state, logs request-ID và latency.
- [ ] `M4-03` Implement client suspicion score `S_i` có test và cấu hình ngưỡng.
- [ ] `M4-04` Policy `observe → limit → block` (cấp độ tương ứng nguy cơ); rollback được.
- [ ] `M4-05` Fail-safe khi API lỗi/timeout; không treo proxy, không chặn hàng loạt vô cớ.
- [ ] `M4-06` Test Mixed Traffic: đo khách hợp lệ bị chặn nhầm và bot bị giới hạn/chặn.

**DoD:** Hệ thống tự chuyển sang chính sách phòng thủ dựa trên AI nhưng vẫn phục vụ client hợp lệ; có log quyết định, smoke test cho AI downtime.

### Tuần 5 — 19/11–26/11 | M5: Autoscaling + Monitoring + E2E integration

**Phụ trách gốc:** Cả nhóm.

- [ ] `M5-01` FastAPI Orchestrator đọc `RPS_admitted` và tính Pod replicas từ `C` đã đo.
- [ ] `M5-02` Tích hợp K3s scaler; xử lý permission, timeout, cooldown, minimum/maximum, scale conflict.
- [ ] `M5-03` Export metrics Go/AI/backend/K3s cho Prometheus và Grafana.
- [ ] `M5-04` Dashboard hiển thị total/admitted/blocked RPS, AI probabilities, latency, replicas, CPU/RAM.
- [ ] `M5-05` E2E tests: Normal, Flash, DDoS, Mixed và Cooldown, có đối soát log.
- [ ] `M5-06` Viết `scripts/start-lab`, `scripts/stop-lab`, `scripts/run-demo`, `scripts/check-health` hoặc tương đương hợp môi trường.

**DoD:** Từ môi trường sạch có thể dựng hệ thống bằng hướng dẫn; một kịch bản hợp lệ khiến K3s scale, một kịch bản tấn công có thể kích hoạt defense, Grafana phản ánh sự kiện thực.

### Tuần 6 — 27/11–04/12 | M6: Hardening + Demo + Bàn giao

**Phụ trách gốc:** Cả nhóm.

- [ ] `M6-01` Kiểm thử độ ổn định và sự cố (AI chết, Gateway lỗi capture, K3s API lỗi, backend quá tải).
- [ ] `M6-02` Đo F1/FPR trên holdout và hiệu quả defense (chặn nhầm/chặn đúng, latency, admitted RPS).
- [ ] `M6-03` Đo scale-up/down thực tế, có timestamp và `Ready` replicas.
- [ ] `M6-04` Rehearsal demo 5 phút, lưu screenshots và logs.
- [ ] `M6-05` README setup, kiến trúc, API contract, dataset lineage, hướng dẫn demo, limitation và báo cáo tổng kết.
- [ ] `M6-06` Đóng danh sách bugs và tag release đồ án.

**DoD:** Demo có thể chạy lặp lại; có hướng dẫn cài đặt, scripts, cấu hình mẫu, test evidence; báo cáo kết quả phân biệt mục tiêu đạt/chưa đạt trung thực.

---

## 6. KỊCH BẢN DEMO CHÍNH (THEO REPORT, CHƯA PHẢI KẾT QUẢ)

| Pha | Thời gian | Mô phỏng | Kỳ vọng quan sát |
|---|---|---|---|
| 1 — Flash Crowd | Phút 1–2 | ~220 req/s hợp lệ | AI `Flash_Crowd`, gateway nới lọc, Pods tăng theo admitted RPS |
| 2 — Mixed Attack | Phút 3–4 | ~200 req/s hợp lệ + ~200 req/s bot | AI `Mixed_Traffic`, bot bị giới hạn/chặn, admitted gần traffic thật, không scale theo bot |
| 3 — Cooldown | Phút 5 | Dừng tải, chờ ngưỡng 60 giây | Pods giảm về 1, dashboard ghi lại sự kiện |

- Hai màn hình đề xuất: Grafana ở bên trái, terminal `kubectl get pods -w` + gateway logs bên phải.
- Các số 220/200/400 req/s, <80 ms, 1→5 Pods là **mốc mô phỏng trong Report**, không được coi là dữ liệu thực nghiệm trước khi đo.
- Có thể giảm tải demo nếu phần cứng không đủ, nhưng phải ghi rõ và vẫn chứng minh logic phân loại + chặn + scale.
- Tất cả lưu lượng thử nghiệm phải chạy vào backend lab do nhóm sở hữu.

---

## 7. MỨC ƯU TIÊN VÀ QUẢN LÝ PHẠM VI

### P0 — Không được thiếu để nghiệm thu sản phẩm

- Proxy Go + backend chạy thật.
- Dataset tự thu thập và mô hình 4 lớp có đường inference hoạt động.
- AI feedback và client-policy có đo chặn nhầm.
- K3s auto-scale dựa admitted RPS, có cooldown.
- Dashboard + demo E2E + hướng dẫn tái lập.

### P1 — Quan trọng nếu còn đủ nguồn lực

- Thu thập đủ 12 feature đã xác minh, bao gồm JA4/Akamai H2 theo đúng đặc tả.
- GroupKFold theo phiên, phân tích chi tiết FPR và dữ liệu Mixed.
- Nâng chất lượng phát hiện botnet phân tán bằng behavioral/coordination signals.
- Hardening hơn cho auth, log retention, fail-safe, observability.

> **Lưu ý:** 12 features là mục tiêu kỹ thuật của Report. Nếu chưa thu thập đủ thì không được tuyên bố model “12-feature” đã đạt; phải đánh dấu GAP, giải thích nguyên nhân và lên kế hoạch bổ sung.

### P2 — Mở rộng, không chặn tiến độ sản phẩm

- Train đủ 5 model (XGBoost, Random Forest, Decision Tree, MLP, Logistic Regression).
- LOTO/ablation study đầy đủ, so sánh CPU-HPA và static IP rate limiting theo chuẩn paper.
- Sử dụng Black Friday, DDoS-Sandbox, MicroservicesDDoS như public benchmarks (không ghép thiếu kiểm soát với dataset lab).
- Nâng cấp UI backend hoặc các thử nghiệm quy mô cloud.

---

## 8. PHÂN CÔNG THEO REPORT.PDF

| Giai đoạn | Thành viên phụ trách chính trong báo cáo |
|---|---|
| Tuần 1: Gateway, TLS/HTTP2, K3s backend | Lê Quốc Thiên + Nguyễn Quang Huy |
| Tuần 2: Generator, traffic capture, dataset | Nguyễn Quang Huy + Võ Ngọc Bảo |
| Tuần 3–4: ML training, evaluation, client scoring | Võ Ngọc Bảo + Lê Quốc Thiên |
| Tuần 5: Integration, orchestration, Grafana | Cả nhóm |
| Tuần 6: Full demo, testing, documentation | Cả nhóm |

Phân công là điểm xuất phát từ Report; không suy diễn thành task ownership thực tế đã được các thành viên chấp nhận. Khi làm việc thực, gán `owner`, `reviewer`, `status` trong `tasks/current.md`.

---

## 9. CẤU TRÚC REPOSITORY ĐỀ XUẤT

```text
cyber-defense/
├── README.md
├── DACN2_PROJECT_MASTER_PLAN.md # kế hoạch canonical ở gốc
├── AGENTS.md
├── CONSTRAINTS.md
├── tasks/
│   └── current.md          # tracker thực thi duy nhất
├── .env.example
├── gateway/                # Go TLS/JA4/H2/reverse-proxy/telemetry/policy
├── ai-service/             # Python training, inference API, model artifacts
├── backend/                # NestJS demo web/API + database
├── traffic-generator/      # Normal, flash-crowd, attack-lab, mixed scripts
├── kubernetes/             # K3s manifests, RBAC, services, scaling
├── monitoring/             # Prometheus/Grafana provisioning
├── datasets/
│   ├── README.md           # provenance/labels/sessions; tránh commit data lớn
│   ├── raw/                # local only / gitignored nếu nhạy cảm/lớn
│   ├── processed/
│   └── manifests/
├── scripts/                # start, stop, health, smoke, demo
├── tests/                  # unit, integration, e2e
└── docs/
    ├── PRODUCT.md             # trích xuất phạm vi, tách đề xuất/đã xác minh
    ├── ARCHITECTURE.md
    ├── SKILL_ROUTING.md
    ├── FEATURE_SPEC.md
    ├── API_CONTRACT.md
    ├── REQUIREMENTS.md        # acceptance có thể kiểm chứng
    ├── PROGRESS.md
    └── DEPLOYMENT.md          # tạo khi có quy trình thực tế
```

Nếu repository đã có cấu trúc khác phù hợp, **không ép đổi hàng loạt**. Giữ kiến trúc hiện tại, cập nhật tài liệu cho đúng.

---

## 10. KIỂM THỬ VÀ ĐỊNH NGHĨA HOÀN THÀNH (DoD)

Một task chỉ được đánh dấu `DONE` khi:

Với task chỉ cập nhật tài liệu, artifact là file tài liệu và bằng chứng là kiểm tra liên kết/nội dung phù hợp. Hoàn thành task tài liệu không đồng nghĩa hoàn thành mốc ứng dụng hoặc đã chạy tests runtime.

1. Có mã nguồn/manifest/dataset artifact thật (đường dẫn cụ thể).
2. Có lệnh chạy/test tái lập và bằng chứng output (exit code, log, ảnh màn hình, metric).
3. Các giả định, giới hạn và cấu hình đã được ghi lại.
4. Không phá vỡ smoke tests đã chạy được ở mốc trước.
5. Tài liệu và `docs/PROGRESS.md` đã cập nhật.

**Các bài test tối thiểu cuối đồ án:**

- Reverse proxy HTTP(S), TLS termination, Web API hoạt động.
- JA4/H2: known fixtures và ít nhất một capture độc lập, lỗi capture có flag.
- Dữ liệu: đúng schema/feature order, session-aware split, không có label leak.
- AI: infer một sample và batch, timeout, malformed data, missing feature.
- Gateway: false positive trong Flash Crowd, hành vi khi AI tắt, policy rollback.
- Kubernetes: scale up/down bằng admitted RPS, kiểm tra Pod Ready và cooldown.
- E2E: Normal → Flash Crowd → Mixed → Cooldown có logs và dashboard khớp nhau.

---

## 11. QUY TẮC LÀM VIỆC VÀ CƠ CHẾ CHECKPOINT CHO AI AGENT

### 11.1. Quy tắc vận hành

- **Không hỏi lại** những thông tin đã có trong file kế hoạch, repo và các file checkpoint.
- **Không đoán trạng thái:** Nếu chưa thực thi test thì ghi `NOT_TESTED`, không ghi `PASS`.
- Thực hiện mỗi lần một hạng mục đủ nhỏ để có bằng chứng hoàn thành. Nếu không thể tiếp tục, ghi blockers và bước tiếp theo.
- Không xóa/reformat hàng loạt file hoặc làm thay đổi hệ thống ngoài phạm vi dự án mà chưa có lý do rõ.
- Trước khi thêm package hoặc dịch vụ mới: kiểm tra nhu cầu, tài nguyên và tác động; ưu tiên dependency ổn định, có tài liệu.
- Ưu tiên build/test tuần tự nếu máy ít RAM. Đảm bảo cleanup generator, Pods và tiến trình trước khi kết thúc.
- Nếu phát hiện Report có giả định sai hoặc KPI không đạt: ghi rõ bằng chứng, phương án thay đổi và phần bị ảnh hưởng; **không sửa âm thầm để hợp thức hóa số liệu**.

### 11.2. Mẫu `docs/PROGRESS.md` (agent phải tạo và liên tục cập nhật)

```markdown
# PROJECT PROGRESS — DACN2

Last updated: YYYY-MM-DD HH:MM (timezone)
Current milestone: Mx / task ID
Current state: TODO | IN_PROGRESS | BLOCKED | DONE

## 1. Tổng quan thực tế
- Hạng mục đã chạy được:
- Hạng mục chưa chạy được:
- Môi trường và các dependency có sẵn:

## 2. Đã hoàn thành trong phiên này
- [Task ID] Mô tả ngắn
  - Files changed:
  - Commands/tests run:
  - Result and evidence:

## 3. Đang làm / chưa hoàn thành
- Task ID:
- Đã làm tới đâu:
- Phần còn thiếu:

## 4. Blockers, risks, open questions
- Blocker:
- Evidence:
- Workaround / recommended next action:

## 5. Các lệnh khởi động/kiểm thử đã được xác minh
- Start:
- Smoke test:
- Stop/cleanup:

## 6. Quyết định mới
- Quyết định:
- Lý do:
- Ảnh hưởng đến Report/kế hoạch:

## 7. NEXT ACTION (rõ tới mức agent tiếp theo làm được ngay)
1. ...
2. ...
3. ...

## 8. Trạng thái git
- Branch:
- Last commit:
- Uncommitted changes:
```

### 11.3. Tracker duy nhất: `tasks/current.md`

Ghi milestone hiện tại, task ID, trạng thái có bằng chứng, acceptance, dependencies, câu hỏi mở và bước tiếp theo tại file này. Checklist M0–M6 trong master plan là khung kế hoạch; trạng thái thực thi lấy từ tracker. Không tạo `docs/TASKS.md`, `tasks/plan.md` hoặc `tasks/todo.md` làm backlog song song.

### 11.4. Quyết định: `docs/ARCHITECTURE.md`

Ghi ngày, trạng thái (đề xuất/đã chọn/đã xác minh), quyết định, lý do, phương án thay thế, bằng chứng và ảnh hưởng tới Report/kế hoạch. Không tạo `docs/DECISIONS.md` trùng chức năng. `docs/PROGRESS.md` chỉ giữ checkpoint phiên gần nhất, không thay tracker/quyết định.

### 11.5. Quy trình khi dừng hoặc gần hết context

1. Dừng tại trạng thái an toàn, không để traffic generator đang chạy ngoài kiểm soát.
2. Ghi toàn bộ file thay đổi và bài test đã chạy (chỉ những test có chạy thật).
3. Cập nhật `docs/PROGRESS.md`, `tasks/current.md`, `docs/ARCHITECTURE.md` nếu có thay đổi.
4. Tóm tắt các lỗi, nguyên nhân đã tìm thấy, bước tiếp theo cụ thể và cách tiếp tục.
5. Agent phiên sau bắt đầu bằng cách đọc 3 file trên, kiểm tra diff/branch, sau đó làm `NEXT ACTION`.

---

## 12. CÁC RỦI RO KỸ THUẬT CẦN ƯU TIÊN

1. **JA4/HTTP2 khó capture chính xác:** test fixture và browser real capture từ sớm; không fake signatures.
2. **Khác biệt giữa dataset lúc train và lúc chạy:** schema/version, feature order và preprocessing dùng chung; ưu tiên integration tests.
3. **Mẫu 5 giây gần nhau gây leakage:** group split theo session, giữ riêng holdout test.
4. **Botnet phân tán và Flash Crowd giống nhau:** kết hợp macro ML + per-client behavior; đo false positives thay vì hứa chặn 100%.
5. **AI đánh giá Mixed không chỉ ra từng bot:** giữ raw per-client evidence, không block toàn cục.
6. **Cơ chế scale sai:** đo C một Pod, scale từ admitted rate, có min/max và cooldown.
7. **K3s trên máy tài nguyên hạn chế:** khảo sát CPU/RAM/disk trước, giảm concurrency, không tự ý dọn dữ liệu người dùng.
8. **Đuổi theo KPI >95% quá sớm:** tập trung vào pipeline E2E rồi cải thiện số liệu; chỉ báo cáo kết quả đã đo.
9. **Scope creep:** không phát triển giao diện sản phẩm ngoài nhu cầu demo và không mở rộng thành nghiên cứu học thuật nếu không bắt buộc.
10. **Kiểm thử DDoS ngoài phạm vi:** chỉ dùng network lab được phép, thiết lập kill switch, cảnh báo và cleanup.

---

## 13. MẪU YÊU CẦU KHỞI ĐỘNG AGENT

Khi người dùng bảo “bắt đầu triển khai dự án”, agent phải làm theo hành động này, không cần họ lặp lại toàn bộ prompt:

> Đọc `DACN2_PROJECT_MASTER_PLAN.md` và tất cả file checkpoint trong `docs/`. Audit trạng thái hiện tại của repository và môi trường. Đối chiếu với milestones M0–M6, xác định task P0 sớm nhất chưa DONE. Lập kế hoạch nhỏ cho đúng task đó, triển khai và kiểm thử trực tiếp, ghi bằng chứng. Cập nhật `docs/PROGRESS.md`, `tasks/current.md`, `docs/ARCHITECTURE.md` nếu cần. Khi dừng, ghi checkpoint đầy đủ để phiên agent sau tiếp tục. Không bịa trạng thái hoặc kết quả chạy; mọi thử nghiệm traffic tấn công chỉ trong lab cô lập thuộc quyền kiểm soát của nhóm.

---

## 14. NGUỒN THAM CHIẾU VÀ PHÂN BIỆT THÔNG TIN

**Trích từ `Report.pdf` (nguồn chính của dự án):**

- Kiến trúc 3 tầng: Go Gateway → Python AI Control Plane → K3s/NestJS/PostgreSQL.
- JA4, HTTP/2 fingerprint, 12 cross-layer features trên cửa sổ 5 giây.
- Bốn nhãn traffic, session-aware GroupKFold, mục tiêu dataset ~2.400–3.600 windows qua ~25 sessions.
- Per-client suspicion score, policy thresholds, admitted-RPS-based scaling, cooldown/fail-safe.
- K3s Pod micro-quotas và mục tiêu scaling 1–5 Pods.
- Lịch 6 tuần 19/10–04/12/2026, phân công 3 thành viên, demo 5 phút.
- Các KPI tham vọng của report (Macro F1, FPR, inference time, scale latency).

**Bổ sung/điều chỉnh để phục vụ xây sản phẩm (không phải tuyên bố nguyên văn Report):**

- Product-first: xây pipeline chạy được trước, tối giản số model và không bắt buộc public baseline.
- Checklist P0/P1/P2, M0 audit, task IDs, DoD, contract đề xuất, repository layout, quy trình checkpoint.
- Tách `window_label` và `client/request_ground_truth` để kiểm thử Mixed Traffic, quy định an toàn lab.
- Chú trọng kiểm tra tính đúng của data, chống chặn nhầm, fail-safe và tái lập demo.

**Tài liệu dataset Black Friday (`README - Flash Crowd Dataset.pdf`)** chỉ phục vụ tham khảo, không phải dữ liệu cốt lõi bắt buộc của hệ thống. README mô tả traffic năm 2014 qua WAF/firewall với các trường HTTP đã mã hóa; không đáp ứng đầy đủ JA4/HTTP2 cần cho Gateway. Không ép dùng dataset này trong MVP.

---

**ĐỊNH NGHĨA THÀNH CÔNG CUỐI CÙNG:** Một người chấm đồ án có thể dựng và quan sát một hệ thống thật, thấy người dùng hợp lệ làm backend scale lên, thấy tấn công mô phỏng được phát hiện và giới hạn mà không khóa tất cả người dùng, thấy tài nguyên giảm khi traffic hết, và xem bằng chứng trong logs/dashboard. Mọi kết quả kỹ thuật và AI đều đo được, không phải chỉ có sơ đồ hoặc notebook.

