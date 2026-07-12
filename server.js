require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Project = require("./models/Project");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const fileRoutes = require("./routes/fileRoutes");
const aiRoutes = require("./routes/aiRoutes");
const executionRoutes = require("./routes/executionRoutes");
const versionRoutes = require("./routes/versionRoutes");
const userRoutes = require("./routes/userRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const inviteRoutes = require("./routes/inviteRoutes");
connectDB();

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

// ---- Global middleware ----
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// basic rate limiter (tighten separately for /api/ai/* routes later)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api", apiLimiter);

// ---- Routes ----
app.use("/api/ai", aiRoutes);
app.use("/api/versions", versionRoutes);
app.get("/api/health", (req, res) => res.json({ status: "ok", service: "synq-backend" }));
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/execution", executionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/invites", inviteRoutes);

// ---- Socket.io: simple broadcast-based live collab (last-write-wins) ----

// Verify the same JWT access token used for REST — sent as socket.handshake.auth.token
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
});

const PRESENCE_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#ec4899", "#eab308", "#8b5cf6", "#14b8a6", "#ef4444"];
const colorForUser = (userId) => {
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
};

// fileId -> Map<socketId, { userId, name, color }>
const filePresence = new Map();

const getPresenceList = (fileId) => {
  const room = filePresence.get(fileId);
  return room ? Array.from(room.values()) : [];
};

const broadcastPresence = (fileId) => {
  io.to(`file:${fileId}`).emit("presence:update", { fileId, users: getPresenceList(fileId) });
};

const canAccessProject = async (userId, projectId) => {
  const project = await Project.findById(projectId).select("ownerId collaborators");
  if (!project) return false;
  if (project.ownerId.toString() === userId) return true;
  return project.collaborators.some((c) => c.userId.toString() === userId);
};

const leaveFile = (socket, fileId) => {
  if (!fileId) return;
  socket.leave(`file:${fileId}`);
  const room = filePresence.get(fileId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) filePresence.delete(fileId);
  }
  broadcastPresence(fileId);
};

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("project:join", (projectId) => {
    socket.join(projectId);
  });

  // Join the collab room for a specific file within a project the user has access to
  socket.on("file:join", async ({ projectId, fileId }, ack) => {
    try {
      if (!projectId || !fileId) return ack?.({ ok: false, message: "projectId and fileId required" });

      const allowed = await canAccessProject(socket.userId, projectId);
      if (!allowed) return ack?.({ ok: false, message: "No access to this project" });

      if (!socket.data.name) {
        const user = await User.findById(socket.userId).select("name");
        socket.data.name = user?.name || "Anonymous";
        socket.data.color = colorForUser(socket.userId);
      }

      socket.join(`file:${fileId}`);
      if (!filePresence.has(fileId)) filePresence.set(fileId, new Map());
      filePresence.get(fileId).set(socket.id, {
        userId: socket.userId,
        name: socket.data.name,
        color: socket.data.color,
      });

      broadcastPresence(fileId);
      ack?.({ ok: true });
    } catch (err) {
      console.error("file:join error:", err.message);
      ack?.({ ok: false, message: "Join failed" });
    }
  });

  socket.on("file:leave", ({ fileId }) => leaveFile(socket, fileId));

  // Last-write-wins broadcast — no CRDT merge, just relay to everyone else on the file
  socket.on("code:change", ({ fileId, content }) => {
    if (!fileId || typeof content !== "string") return;
    socket.to(`file:${fileId}`).emit("code:update", {
      fileId,
      content,
      userId: socket.userId,
      name: socket.data.name,
    });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room.startsWith("file:")) leaveFile(socket, room.slice("file:".length));
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ---- Error handling ----
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Synq backend running on port ${PORT}`);
});