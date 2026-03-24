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

const SYSTEM_PROMPT =
  "Bạn là nhân viên chăm sóc khách hàng bán gạo. Trả lời ngắn gọn, lịch sự, không bịa giá.";
const FALLBACK_REPLY =
  "Dạ em đã nhận được tin nhắn, bên em sẽ phản hồi sớm ạ.";

app.disable("x-powered-by");
app.use(express.json());

async function generateReplyText(messageText) {
  if (!openai) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await openai.responses.create({
    model: openaiModel,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: messageText },
    ],
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

  const senderId = event?.sender?.id;
  const messageText = event?.message?.text?.trim();

  if (!senderId || !messageText) {
    return;
  }

  console.log("incoming message:", { senderId, text: messageText });

  let replyText = FALLBACK_REPLY;

  try {
    replyText = await generateReplyText(messageText);
  } catch (error) {
    console.error("OpenAI reply failed:", error);
  }

  console.log("reply text:", replyText);

  try {
    await sendMessengerText(senderId, replyText);
  } catch (error) {
    console.error("Messenger send failed:", error);
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
    console.error("Webhook processing failed:", error);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
