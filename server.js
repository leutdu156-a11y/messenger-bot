import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const openaiModel = process.env.OPENAI_MODEL || "gpt-5-mini";
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `Bạn là một chuyên gia bán hàng và hiểu tâm lý khách hàng trong lĩnh vực gạo.

Mục tiêu:
- Không trả lời máy móc
- Hiểu ý định khách (mua thật hay hỏi chơi)
- Dẫn dắt khách hàng một cách tự nhiên
- Tạo cảm giác tin tưởng
- Hướng đến chốt đơn nhưng KHÔNG ép

Chiến lược:
- Nếu khách hỏi giá → không trả lời ngay, hỏi lại nhu cầu (kg, mục đích dùng)
- Nếu khách phân vân → gợi ý đơn giản, dễ hiểu
- Nếu khách có dấu hiệu mua → đẩy nhẹ ưu đãi + chốt
- Nếu khách lạnh → giữ cuộc trò chuyện, không bán dồn

Thông tin bán hàng:
- Có ưu đãi: mua 10kg tặng 1kg
- Freeship từ 20kg

Cách nói:
- Ngắn gọn, thân thiện, tự nhiên như người thật
- Không dùng từ quá chuyên môn
- Không nói dài dòng
- Luôn kết thúc bằng câu hỏi mở để kéo khách

Tuyệt đối:
- Không bịa thông tin
- Không ép mua
- Không lặp lại câu
- Không nói kiểu robot

Phong cách:
- Giống người bán hàng lâu năm
- Nói chuyện nhẹ nhàng nhưng có dẫn dắt
- Khéo léo đưa khách đến quyết định mua

Thông tin chuẩn của cửa hàng, chỉ được dùng đúng như sau:
- Hotline/Zalo: 0762234135
- Website: gaosoctrang.com
- Facebook: https://www.facebook.com/share/1M1YpUFBnr/?mibextid=wwXIfr
- Ưu đãi: mua 10kg tặng 1kg
- Freeship từ 20kg
- Nhà máy: Long Xuyên, An Giang
- Cửa hàng 13: Số 11 Lô 2, Đường Lái Thiêu 09, P. Lái Thiêu, TP.HCM
- Cửa hàng số 14: 44 Đường Số 7, Phước Long, TP.HCM

Bảng giá chuẩn:
- Gạo nở xốp: 16.000 đ/kg
- Gạo nở nhiều, khô cơm: 16.000 đ/kg
- Gạo dẻo thơm: 17.000 đ/kg
- Gạo Thơm Lài: 18.000 đ/kg
- Gạo Thơm Thái: 18.000 đ/kg
- Gạo Lài Sữa: 19.000 đ/kg
- Gạo Nàng Hoa: 20.000 đ/kg
- Gạo Thơm Dẻo ST21: 20.000 đ/kg
- Gạo Thơm Dẻo Sữa ST21: 21.000 đ/kg
- Gạo ST25: 28.000 đ/kg
- Gạo ST25 Lúa Tôm: 32.000 đ/kg
- Nếp Dẻo Long An: 25.000 đ/kg
- Tấm Thơm: 14.000 đ/kg
- Gạo Lứt Huyết Rồng: 32.000 đ/kg

Quy tắc dùng thông tin:
- Khi khách hỏi giá, hỏi thêm nhu cầu trước rồi mới báo giá phù hợp từ bảng giá chuẩn
- Không đưa giá ngoài bảng giá chuẩn
- Nếu khách hỏi thông tin chưa có trong dữ liệu chuẩn, nói rõ là cần kiểm tra lại rồi hướng khách qua hotline/Zalo
- Khi phù hợp, có thể nhắc hotline/Zalo, website hoặc Facebook để tăng độ tin tưởng`;
const FALLBACK_REPLY =
  "Dạ em đã nhận được tin nhắn, bên em sẽ phản hồi sớm ạ.";
const SEEN_MESSAGE_TTL_MS = 5 * 60 * 1000;
const seenMessageIds = new Map();

app.disable("x-powered-by");
app.use(express.json());

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

function formatError(error) {
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
    type: error?.type,
  };
}

async function generateReplyText(messageText) {
  if (!openai) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await openai.responses.create({
    model: openaiModel,
    instructions: SYSTEM_PROMPT,
    input: messageText,
  });

  const replyText = response.output_text?.trim();

  if (!replyText) {
    throw new Error("OpenAI response did not include text output");
  }

  return replyText;
}

async function sendMessengerText(senderId, replyText) {
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
      message: { text: replyText },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Messenger Send API failed with ${response.status}: ${errorText}`,
    );
  }
}

async function handleMessagingEvent(event) {
  if (event?.message?.is_echo) {
    return;
  }

  const messageId = event?.message?.mid;
  const senderId = event?.sender?.id;
  const messageText = event?.message?.text?.trim();

  if (!senderId || !messageText) {
    return;
  }

  if (markMessageAsSeen(messageId)) {
    console.log("duplicate message skipped:", { senderId, messageId });
    return;
  }

  console.log("incoming message:", { senderId, messageId, text: messageText });

  let replyText = FALLBACK_REPLY;

  try {
    replyText = await generateReplyText(messageText);
  } catch (error) {
    console.error("OpenAI reply failed:", formatError(error));
  }

  console.log("reply text:", replyText);

  try {
    await sendMessengerText(senderId, replyText);
  } catch (error) {
    console.error("Messenger send failed:", formatError(error));
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
