const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const STORE_PATH = path.join(__dirname, "data", "schedules.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let schedules = [];
let accountStatus = {
  state: "initializing",
  phoneNumber: null,
  qrCodeDataUrl: null,
  lastError: null,
};

function loadSchedules() {
  if (!fs.existsSync(STORE_PATH)) {
    schedules = [];
    return;
  }

  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  schedules = Array.isArray(parsed) ? parsed : [];
}

function saveSchedules() {
  fs.writeFileSync(STORE_PATH, JSON.stringify(schedules, null, 2));
}

function sanitizePhone(phone) {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  if (!digitsOnly) {
    throw new Error("Phone number is required.");
  }
  return `${digitsOnly}@c.us`;
}

function validateScheduleInput(payload) {
  const { to, message, sendAt } = payload;

  if (!to || typeof to !== "string") {
    throw new Error("'to' is required and must be a phone number string.");
  }
  if (!message || typeof message !== "string") {
    throw new Error("'message' is required and must be a string.");
  }
  if (!sendAt || typeof sendAt !== "string") {
    throw new Error("'sendAt' is required and must be an ISO date-time string.");
  }

  const sendAtDate = new Date(sendAt);
  if (Number.isNaN(sendAtDate.getTime())) {
    throw new Error("'sendAt' must be a valid date-time.");
  }

  if (sendAtDate.getTime() <= Date.now()) {
    throw new Error("'sendAt' must be in the future.");
  }

  return {
    to,
    message: message.trim(),
    sendAt: sendAtDate.toISOString(),
  };
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "scheduler-account" }),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", async (qr) => {
  accountStatus.state = "qr_required";
  accountStatus.lastError = null;
  accountStatus.qrCodeDataUrl = await QRCode.toDataURL(qr);
  io.emit("account:update", accountStatus);
});

client.on("authenticated", () => {
  accountStatus.state = "authenticated";
  accountStatus.qrCodeDataUrl = null;
  io.emit("account:update", accountStatus);
});

client.on("ready", async () => {
  const info = client.info;
  accountStatus.state = "ready";
  accountStatus.phoneNumber = info?.wid?.user || null;
  accountStatus.qrCodeDataUrl = null;
  accountStatus.lastError = null;
  io.emit("account:update", accountStatus);
});

client.on("auth_failure", (errorMessage) => {
  accountStatus.state = "auth_failure";
  accountStatus.lastError = errorMessage;
  io.emit("account:update", accountStatus);
});

client.on("disconnected", (reason) => {
  accountStatus.state = "disconnected";
  accountStatus.lastError = reason;
  accountStatus.phoneNumber = null;
  io.emit("account:update", accountStatus);
});

client.initialize();

io.on("connection", (socket) => {
  socket.emit("account:update", accountStatus);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/account-status", (_req, res) => {
  res.json(accountStatus);
});

app.get("/api/schedules", (_req, res) => {
  const ordered = [...schedules].sort((a, b) => new Date(a.sendAt) - new Date(b.sendAt));
  res.json(ordered);
});

app.post("/api/schedules", (req, res) => {
  try {
    const payload = validateScheduleInput(req.body);
    const item = {
      id: randomUUID(),
      to: payload.to,
      message: payload.message,
      sendAt: payload.sendAt,
      status: "pending",
      createdAt: new Date().toISOString(),
      sentAt: null,
      error: null,
    };

    schedules.push(item);
    saveSchedules();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/schedules/:id", (req, res) => {
  const before = schedules.length;
  schedules = schedules.filter((entry) => entry.id !== req.params.id || entry.status === "sent");

  if (before === schedules.length) {
    return res.status(404).json({ error: "Pending schedule not found." });
  }

  saveSchedules();
  return res.status(204).send();
});

async function processDueSchedules() {
  if (accountStatus.state !== "ready") {
    return;
  }

  const now = Date.now();

  for (const schedule of schedules) {
    if (schedule.status !== "pending") {
      continue;
    }

    if (new Date(schedule.sendAt).getTime() > now) {
      continue;
    }

    try {
      const chatId = sanitizePhone(schedule.to);
      await client.sendMessage(chatId, schedule.message);
      schedule.status = "sent";
      schedule.sentAt = new Date().toISOString();
      schedule.error = null;
    } catch (error) {
      schedule.status = "failed";
      schedule.error = error.message;
    }
  }

  saveSchedules();
}

setInterval(() => {
  processDueSchedules().catch((error) => {
    accountStatus.lastError = error.message;
  });
}, 5000);

loadSchedules();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
