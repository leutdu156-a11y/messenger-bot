# Deploy on Render

Build Command: `npm install`

Start Command: `npm start`

Required environment variables:
- `META_VERIFY_TOKEN`
- `META_PAGE_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Optional order integrations:
- `ADMIN_NOTIFY_PSID`: PSID admin để page gửi tin nhắn báo có đơn mới
- `ADMIN_REGISTER_CODE`: mã bí mật cho lệnh chat `đăng ký admin <mã>`
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID file Google Sheet nhận đơn
- `GOOGLE_SHEETS_RANGE`: ví dụ `Orders!A:K`
- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON service account của Google Sheets API
- `STORE_ORDER_WEBHOOK_URL`: endpoint nhận đơn từ bot để đẩy vào hệ thống quản lý cửa hàng
- `STORE_ORDER_WEBHOOK_SECRET`: secret gửi kèm header `x-store-order-secret`

Notes:
- Render provides `PORT` dynamically at runtime.
- The app must bind to `0.0.0.0`.
- Keep secrets in the Render environment settings, not in code.
- Muốn admin cố định không mất sau redeploy: đặt `ADMIN_NOTIFY_PSID` trên Render.
- Muốn lấy PSID của tài khoản đang chat: nhắn `psid của tôi` vào fanpage.
