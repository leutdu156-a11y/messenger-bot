import dotenv from "dotenv";
import express from "express";
import { google } from "googleapis";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const openaiModel = process.env.OPENAI_MODEL || "gpt-5-mini";
const openaiMaxOutputTokens = 140;
const adminNotifyPsid = process.env.ADMIN_NOTIFY_PSID || "";
const googleSheetsSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";
const googleSheetsRange = process.env.GOOGLE_SHEETS_RANGE || "Orders!A:K";
const googleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
const storeOrderWebhookUrl = process.env.STORE_ORDER_WEBHOOK_URL || "";
const storeOrderWebhookSecret = process.env.STORE_ORDER_WEBHOOK_SECRET || "";
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn bán hàng cho fanpage bán gạo.

Mục tiêu:
- Trả lời khách nhanh, rõ, dễ hiểu
- Tư vấn đúng loại gạo theo nhu cầu
- Dẫn dắt khách đến chốt đơn
- Thu thập thông tin cần thiết để lên đơn
- Nếu không chắc, không tự bịa thông tin

Phong cách:
- Lịch sự, thân thiện, tự nhiên
- Nói ngắn gọn, dễ hiểu
- Giống nhân viên bán hàng thật
- Không lan man, không trả lời quá dài
- Luôn ưu tiên giúp khách chọn nhanh
- Mặc định xưng em và gọi khách là anh/chị
- Nếu khách xưng hô là cô, chú hoặc bác thì chuyển sang xưng con và gọi đúng là cô/chú/bác
- Không xưng hô bằng mình
- Không gọi khách là bạn
- Trình bày tin nhắn đẹp trên Messenger mobile bằng icon nhẹ như 🌾 💰 📞 📍 ✅ khi phù hợp
- Làm nổi thông tin quan trọng bằng cách xuống dòng rõ, không dùng ký hiệu rườm rà
- Không dùng markdown kiểu **in đậm** vì không hiển thị ổn định trên Messenger mobile

Nguyên tắc tư vấn:
1. Nếu khách chưa nói rõ nhu cầu, hãy hỏi ngắn gọn:
- Anh/chị thích cơm dẻo nhiều hay tơi vừa ạ?
- Anh/chị mua cho gia đình hay quán ăn ạ?
- Anh/chị muốn loại ngon nổi bật hay loại giá hợp lý ạ?
- Anh/chị cần khoảng bao nhiêu kg ạ?

2. Sau khi hiểu nhu cầu, chỉ gợi ý 2-3 loại phù hợp nhất.

3. Khi gợi ý sản phẩm, trình bày theo mẫu:
- Tên gạo
- Đặc điểm chính
- Giá
- Phù hợp với ai

4. Khi khách có ý định mua, cần xin:
- Loại gạo
- Số lượng / số kg
- Tên người nhận
- Số điện thoại
- Địa chỉ giao hàng

5. Nếu khách phân vân, hãy so sánh ngắn gọn, thiên về giúp khách quyết định.

6. Mặc định hướng chốt đơn theo giao hàng:
- xin thông tin nhận hàng để giao tận nơi
- ưu tiên hỏi số kg, số điện thoại và địa chỉ giao hàng
- không chủ động bảo khách ra cửa hàng
- chỉ nhắc địa chỉ cửa hàng nếu khách hỏi trực tiếp

7. Nếu khách hỏi ngoài dữ liệu có sẵn, hãy trả lời:
"Dạ phần này em xin phép báo lại anh/chị, bên em sẽ kiểm tra và phản hồi sớm ạ."

8. Nếu khách khiếu nại, hãy ưu tiên xin lỗi và chuyển người thật:
"Dạ em rất xin lỗi anh/chị. Em xin ghi nhận thông tin và chuyển ngay bộ phận hỗ trợ để liên hệ anh/chị ạ."

Không được:
- Tự bịa giá
- Tự bịa tồn kho
- Tự bịa chương trình khuyến mãi
- Tự hứa giao hàng khi chưa có dữ liệu
- Tranh cãi với khách
- Nói chuyện máy móc, khô cứng

Thông tin cửa hàng:
- Tên cửa hàng: Vựa Gạo Sóc Trăng
- Địa chỉ:
  Cửa hàng 13: 11 Lái Thiêu 09, P Lái Thiêu, TP HCM
  Cửa hàng 14: 44 Đường số 7, P.Phước Long, TP.HCM
- Hotline/Zalo: 0762234135
- Khu vực giao hàng: Toàn Quốc
- Giờ mở cửa: trực từ 6h sáng đến 23h khuya
- Chính sách giao hàng: Miễn phí đơn hàng từ 20kg
- Khuyến mãi hiện tại: Mua 10kg tặng 1kg

Danh sách sản phẩm:
- Tấm Thơm: 14.000 đ/kg
- Gạo nở xốp: 16.000 đ/kg
- Gạo nở nhiều, khô cơm: 16.000 đ/kg
- Gạo dẻo thơm: 17.000 đ/kg
- Gạo Thơm Lài: 18.000 đ/kg
- Gạo Thơm Thái: 18.000 đ/kg
- Gạo Lài Sữa: giá cũ 21.000 đ/kg, hiện giảm còn 19.000 đ/kg
- Gạo Nàng Hoa: giá cũ 25.000 đ/kg, hiện giảm còn 20.000 đ/kg
- Gạo Thơm Dẻo ST21: giá cũ 25.000 đ/kg, hiện giảm còn 20.000 đ/kg
- Gạo Thơm Dẻo Sữa ST21: giá cũ 28.000 đ/kg, hiện giảm còn 22.000 đ/kg
- Nếp Dẻo Long An: 25.000 đ/kg
- Gạo ST25: giá cũ 32.000 đ/kg, hiện giảm còn 28.000 đ/kg
- Gạo ST25 thường: giá cũ 29.000 đ/kg, hiện giảm còn 25.000 đ/kg
- Gạo ST25 Lúa Tôm: giá cũ 38.000 đ/kg, hiện giảm còn 32.000 đ/kg
- Gạo lứt Huyết Rồng: 32.000 đ/kg

Cách trả lời:
- Ưu tiên câu ngắn
- Mặc định chỉ trả lời 1-2 câu ngắn hoặc tối đa 3 dòng ngắn
- Chỉ dài hơn khi khách yêu cầu bảng giá, so sánh hoặc đang ở bước chốt đơn
- Có thể xuống dòng cho dễ đọc
- Không nhắc lại thông tin khách vừa nói
- Không giải thích dài dòng nếu khách chỉ hỏi ngắn
- Mỗi tin chỉ nên có 1 ý chính và 1 câu hỏi dẫn tiếp
- Mỗi tin chỉ 1 ý chính
- Chỉ hỏi lại đúng 1 câu
- Không liệt kê quá 2 lựa chọn trong một tin, trừ khi khách yêu cầu xem bảng giá
- Luôn kết thúc bằng 1 câu hỏi dẫn dắt nếu khách chưa chốt`;
const FALLBACK_REPLY =
  "Dạ bên em đã nhận tin nhắn ạ. Anh/chị cần em hỗ trợ loại gạo nào để em tư vấn nhanh hơn ạ?";
const SEEN_MESSAGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const seenMessageIds = new Map();
const customerSessions = new Map();
let googleSheetsClientPromise = null;

const PRODUCT_CATALOG = [
  { name: "Tấm Thơm", price: "14.000 đ/kg", aliases: ["tam thom"] },
  {
    name: "Gạo nở xốp",
    price: "16.000 đ/kg",
    aliases: ["gao no xop", "no xop"],
  },
  {
    name: "Gạo nở nhiều, khô cơm",
    price: "16.000 đ/kg",
    aliases: ["gao no nhieu kho com", "no nhieu kho com", "kho com"],
  },
  {
    name: "Gạo dẻo thơm",
    price: "17.000 đ/kg",
    aliases: ["gao deo thom", "deo thom"],
  },
  {
    name: "Gạo Thơm Lài",
    price: "18.000 đ/kg",
    aliases: ["gao thom lai", "thom lai"],
  },
  {
    name: "Gạo Thơm Thái",
    price: "18.000 đ/kg",
    aliases: ["gao thom thai", "thom thai"],
  },
  {
    name: "Gạo Lài Sữa",
    price: "19.000 đ/kg",
    aliases: ["gao lai sua", "lai sua"],
  },
  {
    name: "Gạo Nàng Hoa",
    price: "20.000 đ/kg",
    aliases: ["gao nang hoa", "nang hoa"],
  },
  {
    name: "Gạo Thơm Dẻo ST21",
    price: "20.000 đ/kg",
    aliases: ["gao thom deo st21", "thom deo st21", "st21"],
  },
  {
    name: "Gạo Thơm Dẻo Sữa ST21",
    price: "22.000 đ/kg",
    aliases: ["gao thom deo sua st21", "thom deo sua st21", "sua st21"],
  },
  {
    name: "Nếp Dẻo Long An",
    price: "25.000 đ/kg",
    aliases: ["nep deo long an", "long an"],
  },
  { name: "Gạo ST25", price: "28.000 đ/kg", aliases: ["gao st25", "st25"] },
  {
    name: "Gạo ST25 thường",
    price: "25.000 đ/kg",
    aliases: ["gao st25 thuong", "st25 thuong"],
  },
  {
    name: "Gạo ST25 Lúa Tôm",
    price: "32.000 đ/kg",
    aliases: ["gao st25 lua tom", "st25 lua tom", "lua tom"],
  },
  {
    name: "Gạo lứt Huyết Rồng",
    price: "32.000 đ/kg",
    aliases: ["gao lut huyet rong", "lut huyet rong", "huyet rong"],
  },
];

const MAIN_MENU_QUICK_REPLIES = [
  { title: "Gạo ăn gia đình", payload: "MENU_FAMILY_RICE" },
  { title: "Gạo cho quán ăn", payload: "MENU_RESTAURANT_RICE" },
  { title: "Xem bảng giá", payload: "MENU_PRICE_LIST" },
  { title: "Đặt hàng ngay", payload: "MENU_ORDER_NOW" },
];

const ORDER_FIELD_SEQUENCE = [
  "productName",
  "quantityKg",
  "recipientName",
  "phone",
  "address",
];
const ELDER_TITLES = new Set(["cô", "chú", "bác"]);

const COMPLAINT_REPLY =
  `Dạ em rất xin lỗi anh/chị về trải nghiệm chưa tốt ạ.

Anh/chị gửi giúp em:
- Số điện thoại
- Mã đơn hoặc thời gian nhận hàng
- Vấn đề mình đang gặp

Em xin chuyển ngay bộ phận hỗ trợ liên hệ anh/chị sớm ạ.`;
const WELCOME_TEXT =
  `Dạ em chào anh/chị ạ 🌾
Bên em hiện có gạo ăn gia đình và gạo cho quán ăn.
Anh/chị đang cần dòng cơm dẻo ngon cho gia đình hay loại giá tốt cho quán ạ?`;
const ORDER_NOW_TEXT = `Dạ em lên đơn cho anh/chị ngay ạ.

Anh/chị gửi giúp em:
- Loại gạo
- Số kg
- Tên người nhận
- Số điện thoại
- Địa chỉ giao hàng`;
const INDECISIVE_REPLY = `Dạ để em gợi ý nhanh cho anh/chị nhé:

- ST25: thơm, hạt đẹp
- ST21: mềm dẻo, dễ ăn

Anh/chị đang nghiêng về loại ngon nổi bật hay loại tiết kiệm hơn ạ?`;
const SALES_PLAYBOOK = `Mẫu trả lời tham khảo để tư vấn tự nhiên:
- Nếu khách hỏi gạo nào ngon nhất: ưu tiên gợi ý ST25, mô tả ngắn gọn rồi hỏi khách thích dẻo nhiều hay vừa.
- Nếu khách hỏi gạo nào dẻo: ưu tiên ST25, ST21 rồi hỏi khách thích dẻo nhiều hay dẻo vừa.
- Nếu khách hỏi gạo nào mềm cơm: gợi ý ST21, Nàng Hoa hoặc Thơm Lài.
- Nếu khách hỏi gạo nào rẻ hoặc cho quán: gợi ý dòng giá tốt đang có trong dữ liệu hiện tại, không được tự thêm sản phẩm ngoài catalog.
- Nếu khách hỏi giá: báo đúng giá trong dữ liệu hiện có, không báo giá ngoài dữ liệu.
- Nếu khách hỏi freeship: chỉ trả lời đúng chính sách hiện có là miễn phí đơn từ 20kg.
- Nếu khách hỏi giao hàng: nói giao toàn quốc, thời gian giao tùy khu vực và xin địa chỉ để kiểm tra thêm.
- Nếu khách hỏi mua nhiều, lấy sỉ: xin số lượng dự kiến và khu vực giao hàng để báo lại phù hợp.
- Nếu khách hỏi xuất hóa đơn hoặc nội dung chưa có dữ liệu: trả lời "Dạ phần này em xin phép báo lại anh/chị, bên em sẽ kiểm tra và phản hồi sớm ạ."
- Nếu khách hỏi gọi trực tiếp: mời liên hệ hotline/Zalo 0762234135.
- Nếu khách chưa biết chọn loại nào: dùng flow gợi ý ngắn gọn giữa ST25, ST21 và Thơm Lài.
- Nếu khách hỏi ST25 chung chung: liệt kê đủ 3 dòng ST25 đang có là ST25 thường, ST25 và ST25 Lúa Tôm; nhấn mạnh khuyến mãi mua 10kg tặng 1kg; sau đó hỏi khách muốn chốt giao loại nào.
- Nếu chỉ cần hỏi lại nhu cầu: chỉ hỏi 1 câu ngắn, không viết thêm phần mở rộng.
- Nếu khách hỏi 1 loại gạo cụ thể: trả lời thẳng vào loại đó, không lan sang quá nhiều loại khác.
- Không gửi đoạn văn dài khi chỉ cần 1 câu trả lời ngắn.
- Mỗi tin chỉ 1 ý chính.
- Chỉ hỏi lại đúng 1 câu.
- Không đưa quá 2 lựa chọn trong một tin, trừ khi khách yêu cầu xem bảng giá.
- Khi có tên gạo, giá, số điện thoại hoặc địa chỉ quan trọng: ưu tiên đặt trên dòng riêng với icon như 🌾 💰 📞 📍 để khách dễ đọc.
- Hướng chốt đơn là giao hàng tận nơi, không chủ động kêu khách ra cửa hàng.
- Không được nói 504, tồn kho, quy cách bao, thời gian giao cụ thể hoặc cam kết giao nhanh nếu dữ liệu hiện tại chưa xác nhận.`;
const STORE_NAME = "Vựa Gạo Sóc Trăng";
const STORE_HOTLINE = "0762234135";
const STORE_WEBSITE = "https://gaosoctrang.com";
const STORE_FACEBOOK =
  "https://www.facebook.com/share/1M1YpUFBnr/?mibextid=wwXIfr";

app.disable("x-powered-by");
app.use(express.json());

function renderInfoPage(title, bodyHtml) {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }

      body {
        margin: 0;
        background: #f8faf7;
        color: #17211a;
      }

      main {
        max-width: 760px;
        margin: 0 auto;
        padding: 40px 20px 56px;
        line-height: 1.6;
      }

      h1, h2 {
        line-height: 1.25;
      }

      .card {
        background: #ffffff;
        border: 1px solid #d8e3d2;
        border-radius: 16px;
        padding: 24px;
        margin-top: 20px;
      }

      a {
        color: #0f6b38;
      }

      ul {
        padding-left: 20px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      ${bodyHtml}
    </main>
  </body>
</html>`;
}

function formatProductListLine(product) {
  return `- ${product.name}: ${product.price}`;
}

function pruneSeenMessageIds() {
  const now = Date.now();

  for (const [messageId, expiresAt] of seenMessageIds.entries()) {
    if (expiresAt <= now) {
      seenMessageIds.delete(messageId);
    }
  }
}

function markMessageAsSeen(messageId) {
  if (!messageId) {
    return false;
  }

  pruneSeenMessageIds();

  if (seenMessageIds.has(messageId)) {
    return true;
  }

  seenMessageIds.set(messageId, Date.now() + SEEN_MESSAGE_TTL_MS);
  return false;
}

function createEmptyOrder() {
  return {
    active: false,
    awaitingConfirmation: false,
    prefillAnnounced: false,
    editingField: "",
    data: {
      productName: "",
      quantityKg: "",
      recipientName: "",
      phone: "",
      address: "",
    },
  };
}

function createEmptyCustomerProfile() {
  return {
    recipientName: "",
    phone: "",
    address: "",
  };
}

function pruneSessions() {
  const now = Date.now();

  for (const [senderId, session] of customerSessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      customerSessions.delete(senderId);
    }
  }
}

function getSession(senderId) {
  pruneSessions();

  if (!customerSessions.has(senderId)) {
    customerSessions.set(senderId, {
      greeted: false,
      customerTitle: "anh/chị",
      history: [],
      customerProfile: createEmptyCustomerProfile(),
      order: createEmptyOrder(),
      updatedAt: Date.now(),
    });
  }

  const session = customerSessions.get(senderId);
  session.updatedAt = Date.now();
  return session;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitleText(value) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCustomerTitle(messageText) {
  const titledText = normalizeTitleText(messageText);
  const normalizedText = normalizeText(messageText);

  if (
    /(^|\s)cô\s+(cần|muốn|hỏi|lấy|mua|đặt|thích|ở|đang)(\s|$)/u.test(titledText) ||
    /(^|\s)tôi là cô(\s|$)/u.test(titledText) ||
    /(^|\s)gọi cô(\s|$)/u.test(titledText)
  ) {
    return "cô";
  }

  if (
    /(^|\s)chú\s+(cần|muốn|hỏi|lấy|mua|đặt|thích|ở|đang)(\s|$)/u.test(titledText) ||
    /(^|\s)tôi là chú(\s|$)/u.test(titledText) ||
    /(^|\s)gọi chú(\s|$)/u.test(titledText) ||
    /(^|\s)chu\s+(can|muon|hoi|lay|mua|dat|thich|o|dang)(\s|$)/.test(normalizedText)
  ) {
    return "chú";
  }

  if (
    /(^|\s)bác\s+(cần|muốn|hỏi|lấy|mua|đặt|thích|ở|đang)(\s|$)/u.test(titledText) ||
    /(^|\s)tôi là bác(\s|$)/u.test(titledText) ||
    /(^|\s)gọi bác(\s|$)/u.test(titledText) ||
    /(^|\s)bac\s+(can|muon|hoi|lay|mua|dat|thich|o|dang)(\s|$)/.test(normalizedText)
  ) {
    return "bác";
  }

  if (
    /(^|\s)chị\s+(cần|muốn|hỏi|lấy|mua|đặt|thích|ở|đang)(\s|$)/u.test(titledText) ||
    /(^|\s)tôi là chị(\s|$)/u.test(titledText) ||
    /(^|\s)gọi chị(\s|$)/u.test(titledText) ||
    /(^|\s)chi\s+(can|muon|hoi|lay|mua|dat|thich|o|dang)(\s|$)/.test(normalizedText)
  ) {
    return "chị";
  }

  if (
    /(^|\s)anh\s+(cần|muốn|hỏi|lấy|mua|đặt|thích|ở|đang)(\s|$)/u.test(titledText) ||
    /(^|\s)tôi là anh(\s|$)/u.test(titledText) ||
    /(^|\s)gọi anh(\s|$)/u.test(titledText) ||
    /(^|\s)anh\s+(can|muon|hoi|lay|mua|dat|thich|o|dang)(\s|$)/.test(normalizedText)
  ) {
    return "anh";
  }

  return null;
}

function shouldUpdateCustomerTitle(currentTitle, nextTitle) {
  if (!nextTitle || currentTitle === nextTitle) {
    return false;
  }

  if (!currentTitle || currentTitle === "anh/chị") {
    return true;
  }

  return false;
}

function updateCustomerTitle(session, messageText) {
  const detectedTitle = detectCustomerTitle(messageText);

  if (shouldUpdateCustomerTitle(session.customerTitle, detectedTitle)) {
    session.customerTitle = detectedTitle;
  }
}

function capitalizeFirstLetter(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getAddressing(session) {
  const customer = session.customerTitle || "anh/chị";
  const self = ELDER_TITLES.has(customer) ? "con" : "em";

  return {
    self,
    customer,
  };
}

function replaceCustomerTitleVariants(text, customer) {
  if (customer === "anh/chị") {
    return text
      .replace(/\bMình\b/gu, "Anh/chị")
      .replace(/\bmình\b/gu, "anh/chị")
      .replace(/\bBạn\b/gu, "Anh/chị")
      .replace(/\bbạn\b/gu, "anh/chị");
  }

  return text
    .replace(/Anh\/chị/gu, "__CUSTOMER_CAP__")
    .replace(/anh\/chị/gu, "__CUSTOMER__")
    .replace(/\bAnh\b/gu, capitalizeFirstLetter(customer))
    .replace(/\banh\b/gu, customer)
    .replace(/\bChị\b/gu, capitalizeFirstLetter(customer))
    .replace(/\bchị\b/gu, customer)
    .replace(/\bCô\b/gu, capitalizeFirstLetter(customer))
    .replace(/\bcô\b/gu, customer)
    .replace(/\bChú\b/gu, capitalizeFirstLetter(customer))
    .replace(/\bchú\b/gu, customer)
    .replace(/\bBác\b/gu, capitalizeFirstLetter(customer))
    .replace(/\bbác\b/gu, customer)
    .replace(/\bMình\b/gu, capitalizeFirstLetter(customer))
    .replace(/\bmình\b/gu, customer)
    .replace(/\bBạn\b/gu, capitalizeFirstLetter(customer))
    .replace(/\bbạn\b/gu, customer)
    .replace(/__CUSTOMER_CAP__/g, capitalizeFirstLetter(customer))
    .replace(/__CUSTOMER__/g, customer);
}

function applyAddressing(session, text) {
  const { self, customer } = getAddressing(session);

  return replaceCustomerTitleVariants(text, customer)
    .replace(/\bEm\b/gu, capitalizeFirstLetter(self))
    .replace(/\bem\b/gu, self)
    .replace(/\bCon\b/gu, capitalizeFirstLetter(self))
    .replace(/\bcon\b/gu, self);
}

function appendHistory(session, role, text) {
  if (!text) {
    return;
  }

  session.history.push({ role, text });
  session.history = session.history.slice(-8);
}

function formatQuickReplies() {
  return MAIN_MENU_QUICK_REPLIES.map((item) => ({
    content_type: "text",
    title: item.title,
    payload: item.payload,
  }));
}

function formatError(error) {
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
    type: error?.type,
  };
}

function parseGoogleServiceAccountCredentials() {
  if (!googleServiceAccountJson) {
    return null;
  }

  const credentials = JSON.parse(googleServiceAccountJson);

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  return credentials;
}

async function getGoogleSheetsClient() {
  if (!googleSheetsSpreadsheetId || !googleServiceAccountJson) {
    return null;
  }

  if (!googleSheetsClientPromise) {
    googleSheetsClientPromise = (async () => {
      const credentials = parseGoogleServiceAccountCredentials();
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const authClient = await auth.getClient();

      return google.sheets({
        version: "v4",
        auth: authClient,
      });
    })();
  }

  return googleSheetsClientPromise;
}

function buildConfirmedOrderRecord(senderId, session, orderData) {
  const timestamp = new Date().toISOString();

  return {
    orderId: `MB-${Date.now()}-${senderId.slice(-6)}`,
    confirmedAt: timestamp,
    source: "messenger",
    senderId,
    customerTitle: session.customerTitle || "anh/chị",
    ...orderData,
  };
}

function buildAdminOrderMessage(order) {
  return `Đơn Messenger mới

- Loại gạo: ${order.productName}
- Số lượng: ${order.quantityKg} kg
- Người nhận: ${order.recipientName}
- SĐT: ${order.phone}
- Địa chỉ: ${order.address}
- Mã đơn: ${order.orderId}`;
}

async function notifyAdminAboutOrder(order) {
  if (!adminNotifyPsid) {
    return false;
  }

  await sendMessengerText(adminNotifyPsid, buildAdminOrderMessage(order));
  return true;
}

async function appendOrderToGoogleSheets(order) {
  const sheets = await getGoogleSheetsClient();

  if (!sheets) {
    return false;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: googleSheetsRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        order.confirmedAt,
        order.orderId,
        order.productName,
        order.quantityKg,
        order.recipientName,
        order.phone,
        order.address,
        order.senderId,
        order.customerTitle,
        order.source,
        "confirmed",
      ]],
    },
  });

  return true;
}

async function pushOrderToStoreManagement(order) {
  if (!storeOrderWebhookUrl) {
    return false;
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (storeOrderWebhookSecret) {
    headers["x-store-order-secret"] = storeOrderWebhookSecret;
  }

  const response = await fetch(storeOrderWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ order }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Store order webhook failed with ${response.status}: ${errorText}`,
    );
  }

  return true;
}

async function dispatchConfirmedOrder(order) {
  const jobs = [
    ["admin message", () => notifyAdminAboutOrder(order)],
    ["google sheets", () => appendOrderToGoogleSheets(order)],
    ["store webhook", () => pushOrderToStoreManagement(order)],
  ];

  for (const [jobName, job] of jobs) {
    try {
      const handled = await job();

      if (handled) {
        console.log(`${jobName} saved:`, order.orderId);
      }
    } catch (error) {
      console.error(`${jobName} failed:`, formatError(error));
    }
  }
}

function buildConversationInput(session, messageText) {
  const recentHistory = session.history
    .slice(-6)
    .map((item) =>
      item.role === "user" ? `Khách: ${item.text}` : `Tư vấn: ${item.text}`,
    )
    .join("\n");

  if (!recentHistory) {
    return `Tin nhắn mới của khách: ${messageText}`;
  }

  return `Lịch sử hội thoại gần đây:
${recentHistory}

Tin nhắn mới của khách: ${messageText}`;
}

function findProductByText(messageText) {
  const normalizedText = normalizeText(messageText);
  const matches = [];

  for (const product of PRODUCT_CATALOG) {
    for (const alias of product.aliases) {
      if (normalizedText.includes(alias)) {
        matches.push({ product, aliasLength: alias.length });
      }
    }
  }

  matches.sort((left, right) => right.aliasLength - left.aliasLength);
  return matches[0]?.product || null;
}

function isGenericSt25Mention(messageText) {
  const normalizedText = normalizeText(messageText);

  return (
    normalizedText.includes("st25") &&
    !normalizedText.includes("st25 thuong") &&
    !normalizedText.includes("lua tom")
  );
}

function buildSt25Reply(forOrdering = false) {
  const st25Products = PRODUCT_CATALOG.filter((product) =>
    product.name.startsWith("Gạo ST25"),
  );
  const lines = st25Products.map(
    (product) => `- ${product.name}: ${product.price}`,
  );
  const closingQuestion = forOrdering
    ? "Anh/chị muốn em lên đơn loại ST25 nào ạ?"
    : "Anh/chị muốn em chốt giao loại ST25 nào ạ?";

  return {
    text: `Dạ bên em đang có 3 dòng ST25:

${lines.join("\n")}

🎁 Khuyến mãi: mua 10kg tặng 1kg
🚚 Bên em giao tận nơi, freeship từ 20kg

${closingQuestion}`,
    includeMenu: true,
  };
}

function extractQuantityKg(messageText) {
  const match = messageText.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);

  if (!match) {
    return "";
  }

  return match[1].replace(",", ".");
}

function getNextOrderField(orderData) {
  return ORDER_FIELD_SEQUENCE.find((field) => !orderData[field]) || null;
}

function getOrderFieldPrompt(field) {
  if (field === "productName") {
    return "Dạ anh/chị muốn lấy loại gạo nào ạ?";
  }

  if (field === "quantityKg") {
    return "Dạ anh/chị cần khoảng bao nhiêu kg ạ?";
  }

  if (field === "recipientName") {
    return "Dạ anh/chị cho em xin tên người nhận giúp em nhé.";
  }

  if (field === "phone") {
    return "Dạ anh/chị cho em xin số điện thoại nhận hàng ạ.";
  }

  return "Dạ anh/chị gửi giúp em địa chỉ giao hàng đầy đủ nhé.";
}

function detectOrderFieldFromText(messageText) {
  const normalizedText = normalizeText(messageText);

  if (normalizedText.includes("loai") || normalizedText.includes("gao")) {
    return "productName";
  }

  if (
    normalizedText.includes("kg") ||
    normalizedText.includes("so luong") ||
    normalizedText.includes("so can")
  ) {
    return "quantityKg";
  }

  if (
    normalizedText.includes("ten") ||
    normalizedText.includes("nguoi nhan")
  ) {
    return "recipientName";
  }

  if (
    normalizedText.includes("sdt") ||
    normalizedText.includes("so dien thoai") ||
    normalizedText.includes("dien thoai")
  ) {
    return "phone";
  }

  if (
    normalizedText.includes("dia chi") ||
    normalizedText.includes("giao hang")
  ) {
    return "address";
  }

  return null;
}

function hydrateOrderFromMessage(orderData, messageText) {
  const product = isGenericSt25Mention(messageText)
    ? null
    : findProductByText(messageText);
  const quantityKg = extractQuantityKg(messageText);
  const phoneMatch = messageText.match(/\b0\d{8,10}\b/);

  if (!orderData.productName && product) {
    orderData.productName = product.name;
  }

  if (!orderData.quantityKg && quantityKg) {
    orderData.quantityKg = quantityKg;
  }

  if (!orderData.phone && phoneMatch) {
    orderData.phone = phoneMatch[0];
  }

  const lines = messageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizeText(line.slice(0, separatorIndex));
    const value = line.slice(separatorIndex + 1).trim();

    if (!value) {
      continue;
    }

    if (!orderData.recipientName && (key.includes("ten") || key.includes("nguoi nhan"))) {
      orderData.recipientName = value;
      continue;
    }

    if (!orderData.address && key.includes("dia chi")) {
      orderData.address = value;
    }
  }
}

function resetOrder(session) {
  session.order = createEmptyOrder();
}

function hydrateOrderFromProfile(session) {
  const { customerProfile, order } = session;

  if (!customerProfile) {
    return;
  }

  if (!order.data.recipientName && customerProfile.recipientName) {
    order.data.recipientName = customerProfile.recipientName;
  }

  if (!order.data.phone && customerProfile.phone) {
    order.data.phone = customerProfile.phone;
  }

  if (!order.data.address && customerProfile.address) {
    order.data.address = customerProfile.address;
  }
}

function syncCustomerProfileFromOrder(session) {
  const { customerProfile, order } = session;

  if (!customerProfile) {
    return;
  }

  if (order.data.recipientName) {
    customerProfile.recipientName = order.data.recipientName;
  }

  if (order.data.phone) {
    customerProfile.phone = order.data.phone;
  }

  if (order.data.address) {
    customerProfile.address = order.data.address;
  }
}

function buildRememberedFieldsReply(session, nextField) {
  if (session.order.prefillAnnounced || !session.customerProfile) {
    return "";
  }

  const rememberedLines = [];

  if (session.customerProfile.recipientName) {
    rememberedLines.push(`- Tên người nhận: ${session.customerProfile.recipientName}`);
  }

  if (session.customerProfile.phone) {
    rememberedLines.push(`- Số điện thoại: ${session.customerProfile.phone}`);
  }

  if (session.customerProfile.address) {
    rememberedLines.push(`- Địa chỉ: ${session.customerProfile.address}`);
  }

  if (rememberedLines.length === 0) {
    return "";
  }

  session.order.prefillAnnounced = true;

  return `Dạ em đang có sẵn:
${rememberedLines.join("\n")}

${getOrderFieldPrompt(nextField)}`;
}

function buildNextOrderReply(session) {
  const nextField = getNextOrderField(session.order.data);

  if (!nextField) {
    session.order.awaitingConfirmation = true;

    const summary = `Dạ em xin phép chốt lại đơn của anh/chị:

- Loại gạo: ${session.order.data.productName}
- Số lượng: ${session.order.data.quantityKg} kg
- Người nhận: ${session.order.data.recipientName}
- SĐT: ${session.order.data.phone}
- Địa chỉ: ${session.order.data.address}

Anh/chị xác nhận giúp em để bên em lên đơn ạ.`;

    return {
      text: summary,
    };
  }

  const rememberedFieldsReply = buildRememberedFieldsReply(session, nextField);

  if (rememberedFieldsReply) {
    return {
      text: rememberedFieldsReply,
    };
  }

  return {
    text: getOrderFieldPrompt(nextField),
  };
}

function startOrder(session, messageText = "") {
  resetOrder(session);
  session.order.active = true;
  hydrateOrderFromProfile(session);

  if (isGenericSt25Mention(messageText)) {
    return buildSt25Reply(true);
  }

  const detectedProduct = findProductByText(messageText);
  const detectedQuantity = extractQuantityKg(messageText);

  if (detectedProduct) {
    session.order.data.productName = detectedProduct.name;
  }

  if (detectedQuantity) {
    session.order.data.quantityKg = detectedQuantity;
  }

  return buildNextOrderReply(session);
}

function setOrderFieldValue(session, field, messageText) {
  if (field === "productName") {
    if (isRepeatPurchaseHint(messageText)) {
      return {
        text: "Dạ anh/chị muốn lấy lại loại cũ hay đổi sang loại khác ạ?",
      };
    }

    if (isGenericSt25Mention(messageText)) {
      return buildSt25Reply(true);
    }

    const product = findProductByText(messageText);

    if (!product) {
      return {
        text: "Dạ em chưa nhận ra loại gạo ạ. Anh/chị nhắn lại giúp em tên như ST25, ST21, Thơm Lài hoặc Tấm Thơm nhé?",
      };
    }

    session.order.data.productName = product.name;
    return null;
  }

  if (field === "quantityKg") {
    const quantityKg = extractQuantityKg(messageText);

    if (!quantityKg) {
      return {
        text: "Dạ anh/chị ghi rõ giúp em số kg, ví dụ 10kg hoặc 25kg nhé?",
      };
    }

    session.order.data.quantityKg = quantityKg;
    return null;
  }

  if (field === "recipientName") {
    session.order.data.recipientName = messageText.trim();
    return null;
  }

  if (field === "phone") {
    const phone = messageText.replace(/\D/g, "");

    if (phone.length < 9 || phone.length > 11) {
      return {
        text: "Dạ số điện thoại này chưa đúng định dạng ạ. Anh/chị gửi lại giúp em số nhận hàng nhé?",
      };
    }

    session.order.data.phone = phone;
    return null;
  }

  if (messageText.trim().length < 5) {
    return {
      text: "Dạ anh/chị gửi giúp em địa chỉ giao hàng rõ hơn một chút để bên em lên đơn nhé.",
    };
  }

  session.order.data.address = messageText.trim();
  return null;
}

function handleOrderStep(session, messageText) {
  hydrateOrderFromMessage(session.order.data, messageText);
  syncCustomerProfileFromOrder(session);

  if (session.order.editingField === "select") {
    const field = detectOrderFieldFromText(messageText);

    if (!field) {
      return {
        text: "Dạ anh/chị muốn chỉnh mục nào ạ: loại gạo, số kg, tên người nhận, số điện thoại hay địa chỉ?",
      };
    }

    session.order.editingField = field;
    session.order.awaitingConfirmation = false;
    return {
      text: getOrderFieldPrompt(field),
    };
  }

  if (session.order.editingField) {
    const field = session.order.editingField;
    const errorReply = setOrderFieldValue(session, field, messageText);

    if (errorReply) {
      return errorReply;
    }

    syncCustomerProfileFromOrder(session);
    session.order.editingField = "";
    return buildNextOrderReply(session);
  }

  if (session.order.awaitingConfirmation) {
    const normalizedText = normalizeText(messageText);

    if (
      ["xac nhan", "dong y", "ok", "oke", "roi", "dung", "chuan"].some(
        (keyword) =>
          normalizedText === keyword ||
          normalizedText.includes(` ${keyword}`) ||
          normalizedText.startsWith(`${keyword} `),
      )
    ) {
      console.log("order lead captured:", session.order.data);
      syncCustomerProfileFromOrder(session);
      const confirmedOrderData = { ...session.order.data };
      const confirmationText = `Dạ em đã ghi nhận đơn của anh/chị rồi ạ.

Bên em sẽ liên hệ xác nhận sớm qua số ${confirmedOrderData.phone}.
Anh/chị để ý điện thoại giúp em nhé.`;
      resetOrder(session);

      return {
        text: confirmationText,
        includeMenu: true,
        confirmedOrderData,
      };
    }

    if (
      ["khong", "chua", "sua", "doi"].some((keyword) =>
        normalizedText.includes(keyword),
      )
    ) {
      session.order.awaitingConfirmation = false;
      session.order.editingField = "select";
      return {
        text: "Dạ anh/chị muốn chỉnh mục nào ạ: loại gạo, số kg, tên người nhận, số điện thoại hay địa chỉ?",
      };
    }

    return {
      text: "Dạ anh/chị xác nhận giúp em để bên em lên đơn ạ. Nếu cần sửa, anh/chị nhắn tên mục cần chỉnh giúp em nhé.",
    };
  }

  const nextField = getNextOrderField(session.order.data);

  if (!nextField) {
    return buildNextOrderReply(session);
  }

  const errorReply = setOrderFieldValue(session, nextField, messageText);

  if (errorReply) {
    return errorReply;
  }

  syncCustomerProfileFromOrder(session);
  return buildNextOrderReply(session);
}

function isGreetingMessage(messageText) {
  const normalizedText = normalizeText(messageText);

  return [
    "xin chao",
    "chao",
    "hi",
    "hello",
    "alo",
    "shop oi",
    "ad oi",
  ].some((keyword) => normalizedText === keyword || normalizedText.startsWith(`${keyword} `));
}

function isComplaintMessage(messageText) {
  const normalizedText = normalizeText(messageText);

  return [
    "khieu nai",
    "khong hai long",
    "giao cham",
    "giao thieu",
    "giao nham",
    "doi tra",
    "moc",
    "sau",
    "loi",
  ].some((keyword) => normalizedText.includes(keyword));
}

function isMenuRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return ["menu", "bang chon", "chon nhanh"].some((keyword) =>
    normalizedText.includes(keyword),
  );
}

function isFamilyRiceRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return ["gia dinh", "nha an", "an gia dinh"].some((keyword) =>
    normalizedText.includes(keyword),
  );
}

function isRestaurantRiceRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return ["quan an", "quan com", "com phan"].some((keyword) =>
    normalizedText.includes(keyword),
  );
}

function isPriceListRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return ["bang gia", "gia gao", "bao gia", "xem gia"].some((keyword) =>
    normalizedText.includes(keyword),
  );
}

function isOrderIntent(messageText) {
  const normalizedText = normalizeText(messageText);

  return ["dat hang", "mua", "len don", "order", "chot don"].some((keyword) =>
    normalizedText.includes(keyword),
  );
}

function isCancelOrderRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return ["huy", "dung", "thoat"].some((keyword) =>
    normalizedText === keyword || normalizedText.includes(`${keyword} don`),
  );
}

function isIndecisiveRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return [
    "chua biet chon",
    "phan van",
    "tu van giup",
    "khong biet loai nao",
  ].some((keyword) => normalizedText.includes(keyword));
}

function isDirectCallRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return [
    "goi truc tiep",
    "goi lai",
    "hotline",
    "zalo",
    "lien he truc tiep",
  ].some((keyword) => normalizedText.includes(keyword));
}

function isRepeatPurchaseHint(messageText) {
  const normalizedText = normalizeText(messageText);

  return [
    "mua roi",
    "lay roi",
    "khach cu",
    "dat roi",
    "mua ben em roi",
    "mua roi ma",
  ].some((keyword) => normalizedText.includes(keyword));
}

function isDeliveryRequest(messageText) {
  const normalizedText = normalizeText(messageText);

  return [
    "giao hang",
    "ship",
    "freeship",
    "van chuyen",
    "gui ve",
  ].some((keyword) => normalizedText.includes(keyword));
}

function buildFamilyRiceReply() {
  return {
    text: `Dạ với nhu cầu gia đình, em gợi ý 2 loại dễ chọn:

- ST25: thơm, hạt đẹp
- ST21: mềm dẻo, dễ ăn

Anh/chị thích cơm dẻo nhiều hay dẻo vừa ạ?`,
    includeMenu: true,
  };
}

function buildRestaurantRiceReply() {
  return {
    text: `Dạ nếu anh/chị mua cho quán ăn, em sẽ ưu tiên dòng cơm ổn định và giá hợp lý ạ.

Anh/chị đang cần cơm nở nhiều hay dẻo vừa ạ?`,
    includeMenu: true,
  };
}

function buildDeliveryReply() {
  return {
    text: `Dạ bên em có giao hàng tận nơi ạ.

🚚 Freeship từ 20kg.
Anh/chị ở khu vực nào để em hỗ trợ nhanh hơn ạ?`,
    includeMenu: true,
  };
}

function buildPriceListReply() {
  const lines = PRODUCT_CATALOG.map((product) => formatProductListLine(product));

  return {
    text: `Dạ em gửi anh/chị bảng giá tham khảo bên em ạ:
${lines.join("\n")}

🎁 Ưu đãi: mua 10kg tặng 1kg
🚚 Freeship: từ 20kg

Anh/chị đang quan tâm loại nào để em tư vấn nhanh hơn ạ?`,
    includeMenu: true,
  };
}

function handleMenuPayload(session, payload) {
  if (payload === "MENU_FAMILY_RICE") {
    resetOrder(session);
    return buildFamilyRiceReply();
  }

  if (payload === "MENU_RESTAURANT_RICE") {
    resetOrder(session);
    return buildRestaurantRiceReply();
  }

  if (payload === "MENU_PRICE_LIST") {
    resetOrder(session);
    return buildPriceListReply();
  }

  resetOrder(session);
  session.order.active = true;
  return {
    text: ORDER_NOW_TEXT,
    includeMenu: true,
  };
}

async function generateReplyText(session, messageText) {
  if (!openai) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await openai.responses.create({
    model: openaiModel,
    instructions: `${SYSTEM_PROMPT}\n\n${SALES_PLAYBOOK}`,
    input: buildConversationInput(session, messageText),
    max_output_tokens: openaiMaxOutputTokens,
  });

  const replyText = response.output_text?.trim();

  if (!replyText) {
    throw new Error("OpenAI response did not include text output");
  }

  return replyText;
}

async function sendMessengerMessage(senderId, message) {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageAccessToken) {
    throw new Error("Missing META_PAGE_ACCESS_TOKEN");
  }

  const url = new URL("https://graph.facebook.com/v23.0/me/messages");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: senderId },
      messaging_type: "RESPONSE",
      message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Messenger Send API failed with ${response.status}: ${errorText}`,
    );
  }
}

async function sendMessengerText(senderId, replyText, options = {}) {
  const message = { text: replyText };

  if (options.includeMenu) {
    message.quick_replies = formatQuickReplies();
  }

  await sendMessengerMessage(senderId, message);
}

function maybePrefixGreeting(session, responseText) {
  return responseText;
}

async function buildBotResponse(session, messageText, menuPayload) {
  if (menuPayload) {
    return handleMenuPayload(session, menuPayload);
  }

  if (session.order.active) {
    if (isCancelOrderRequest(messageText)) {
      resetOrder(session);
      return {
        text: "Dạ em đã dừng tạo đơn rồi ạ. Anh/chị muốn em tư vấn lại loại gạo nào tiếp ạ?",
        includeMenu: true,
      };
    }

    return handleOrderStep(session, messageText);
  }

  if (!session.greeted && isGreetingMessage(messageText)) {
    return {
      text: WELCOME_TEXT,
      includeMenu: true,
      skipGreetingPrefix: true,
    };
  }

  if (isComplaintMessage(messageText)) {
    resetOrder(session);
    return { text: COMPLAINT_REPLY };
  }

  if (isDirectCallRequest(messageText)) {
    resetOrder(session);
    return {
      text: `📞 Hotline/Zalo: ${STORE_HOTLINE}

Nếu tiện, anh/chị để lại số điện thoại, bên em gọi lại cho anh/chị nhé.`,
      includeMenu: true,
    };
  }

  if (isMenuRequest(messageText)) {
    resetOrder(session);
    return {
      text: WELCOME_TEXT,
      includeMenu: true,
      skipGreetingPrefix: true,
    };
  }

  if (isFamilyRiceRequest(messageText)) {
    resetOrder(session);
    return buildFamilyRiceReply();
  }

  if (isRestaurantRiceRequest(messageText)) {
    resetOrder(session);
    return buildRestaurantRiceReply();
  }

  if (isPriceListRequest(messageText)) {
    resetOrder(session);
    return buildPriceListReply();
  }

  if (isDeliveryRequest(messageText)) {
    resetOrder(session);
    return buildDeliveryReply();
  }

  if (isOrderIntent(messageText)) {
    return startOrder(session, messageText);
  }

  if (isGenericSt25Mention(messageText)) {
    resetOrder(session);
    return buildSt25Reply();
  }

  if (isIndecisiveRequest(messageText)) {
    return {
      text: INDECISIVE_REPLY,
      includeMenu: true,
    };
  }

  return {
    text: await generateReplyText(session, messageText),
    includeMenu: true,
  };
}

async function handleMessagingEvent(event) {
  if (event?.message?.is_echo) {
    return;
  }

  const senderId = event?.sender?.id;
  const messageId = event?.message?.mid;
  const messageText = event?.message?.text?.trim() || "";
  const menuPayload = event?.message?.quick_reply?.payload || event?.postback?.payload;

  if (!senderId || (!messageText && !menuPayload)) {
    return;
  }

  if (messageId && markMessageAsSeen(messageId)) {
    console.log("duplicate message skipped:", { senderId, messageId });
    return;
  }

  const session = getSession(senderId);
  updateCustomerTitle(session, messageText);

  console.log("incoming message:", {
    senderId,
    messageId,
    payload: menuPayload,
    text: messageText,
  });

  let response = {
    text: FALLBACK_REPLY,
    includeMenu: true,
  };

  try {
    response = await buildBotResponse(session, messageText, menuPayload);
  } catch (error) {
    console.error("OpenAI reply failed:", formatError(error));
  }

  const finalText =
    response.skipGreetingPrefix || !response.text
      ? response.text
      : maybePrefixGreeting(session, response.text);
  const personalizedText = applyAddressing(session, finalText);

  session.greeted = true;

  console.log("reply text:", personalizedText);

  appendHistory(session, "user", messageText || menuPayload);
  appendHistory(session, "assistant", personalizedText);

  try {
    await sendMessengerText(senderId, personalizedText, {
      includeMenu: Boolean(response.includeMenu),
    });
  } catch (error) {
    console.error("Messenger send failed:", formatError(error));
  }

  if (response.confirmedOrderData) {
    const confirmedOrder = buildConfirmedOrderRecord(
      senderId,
      session,
      response.confirmedOrderData,
    );

    void dispatchConfirmedOrder(confirmedOrder);
  }
}

async function processWebhook(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const events = Array.isArray(entry?.messaging) ? entry.messaging : [];

    for (const event of events) {
      await handleMessagingEvent(event);
    }
  }
}

app.get("/privacy-policy", (_req, res) => {
  const html = renderInfoPage(
    "Chính Sách Quyền Riêng Tư",
    `<div class="card">
      <p><strong>${STORE_NAME}</strong> vận hành chatbot Messenger để tư vấn sản phẩm, báo giá và hỗ trợ đặt hàng.</p>
      <p>Chatbot có thể thu thập và xử lý các thông tin anh/chị chủ động cung cấp như nội dung tin nhắn, loại gạo quan tâm, số kg, tên người nhận, số điện thoại và địa chỉ giao hàng.</p>
      <p>Dữ liệu được dùng để:</p>
      <ul>
        <li>trả lời tin nhắn và tư vấn sản phẩm;</li>
        <li>hỗ trợ tiếp nhận và xác nhận đơn hàng;</li>
        <li>chăm sóc khách hàng khi có yêu cầu hoặc khiếu nại.</li>
      </ul>
      <p>Để tạo phản hồi tự động, nội dung tin nhắn có thể được xử lý bởi nhà cung cấp dịch vụ AI của bên em. Bên em không bán dữ liệu cá nhân cho bên thứ ba.</p>
      <p>Nếu cần liên hệ về quyền riêng tư hoặc dữ liệu cá nhân, anh/chị có thể nhắn trực tiếp fanpage, gọi/Zalo <a href="tel:${STORE_HOTLINE}">${STORE_HOTLINE}</a>, hoặc truy cập website <a href="${STORE_WEBSITE}">${STORE_WEBSITE}</a>.</p>
    </div>`,
  );

  res.status(200).type("html").send(html);
});

app.get("/terms-of-service", (_req, res) => {
  const html = renderInfoPage(
    "Điều Khoản Dịch Vụ",
    `<div class="card">
      <p>Chatbot Messenger của <strong>${STORE_NAME}</strong> được dùng để tư vấn sản phẩm, báo giá và tiếp nhận thông tin đặt hàng.</p>
      <p>Khi sử dụng chatbot, anh/chị đồng ý cung cấp các thông tin cần thiết để bên em hỗ trợ tư vấn hoặc xử lý đơn hàng như tên người nhận, số điện thoại và địa chỉ giao hàng khi cần.</p>
      <p>Chatbot chỉ cung cấp thông tin tham khảo tại thời điểm trao đổi. Với các nội dung cần xác nhận thêm như tồn kho, lịch giao cụ thể hoặc thông tin ngoài dữ liệu sẵn có, bên em sẽ kiểm tra lại trước khi phản hồi.</p>
      <p>Nếu cần hỗ trợ trực tiếp, anh/chị có thể liên hệ hotline/Zalo <a href="tel:${STORE_HOTLINE}">${STORE_HOTLINE}</a>, website <a href="${STORE_WEBSITE}">${STORE_WEBSITE}</a> hoặc fanpage <a href="${STORE_FACEBOOK}">${STORE_FACEBOOK}</a>.</p>
    </div>`,
  );

  res.status(200).type("html").send(html);
});

app.get("/data-deletion", (_req, res) => {
  const html = renderInfoPage(
    "Hướng Dẫn Xóa Dữ Liệu Người Dùng",
    `<div class="card">
      <p>Nếu anh/chị muốn yêu cầu xóa dữ liệu đã gửi qua chatbot Messenger của <strong>${STORE_NAME}</strong>, vui lòng làm theo một trong các cách sau:</p>
      <ol>
        <li>Nhắn trực tiếp vào fanpage và ghi rõ yêu cầu xóa dữ liệu.</li>
        <li>Liên hệ hotline/Zalo <a href="tel:${STORE_HOTLINE}">${STORE_HOTLINE}</a>.</li>
      </ol>
      <p>Khi gửi yêu cầu, anh/chị vui lòng cung cấp thông tin để bên em đối chiếu:</p>
      <ul>
        <li>tên hoặc tài khoản Facebook đã nhắn tin;</li>
        <li>số điện thoại đã cung cấp cho đơn hàng, nếu có;</li>
        <li>nội dung yêu cầu xóa dữ liệu.</li>
      </ul>
      <p>Sau khi xác minh, bên em sẽ xử lý yêu cầu trong thời gian phù hợp theo quy trình hỗ trợ khách hàng.</p>
      <p>Fanpage liên hệ: <a href="${STORE_FACEBOOK}">${STORE_FACEBOOK}</a></p>
    </div>`,
  );

  res.status(200).type("html").send(html);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received");
  console.log("mode:", mode);
  console.log("token:", token);
  console.log("challenge:", challenge);

  if (
    mode === "subscribe" &&
    token === process.env.META_VERIFY_TOKEN &&
    challenge
  ) {
    console.log("WEBHOOK VERIFIED");
    return res.status(200).send(String(challenge));
  }

  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  void processWebhook(req.body).catch((error) => {
    console.error("Webhook processing failed:", formatError(error));
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
