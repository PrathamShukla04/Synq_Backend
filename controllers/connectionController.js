const Connection = require("../models/Connection");

const PUBLIC_FIELDS = "name email avatarUrl bio skills githubLink";

// POST /api/connections/request/:userId
const sendRequest = async (req, res, next) => {
  try {
    const toUserId = req.params.userId;
    if (toUserId === req.userId) {
      return res.status(400).json({ message: "You can't connect with yourself" });
    }

    const existing = await Connection.findOne({
      $or: [
        { requester: req.userId, recipient: toUserId },
        { requester: toUserId, recipient: req.userId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(409).json({ message: "You're already connected" });
      }
      if (existing.status === "pending") {
        return res.status(409).json({ message: "A request is already pending" });
      }
      // previously rejected — allow a fresh request by reopening it
      existing.status = "pending";
      existing.requester = req.userId;
      existing.recipient = toUserId;
      await existing.save();
      return res.status(201).json({ connection: existing });
    }

    const connection = await Connection.create({ requester: req.userId, recipient: toUserId });
    res.status(201).json({ connection });
  } catch (err) {
    next(err);
  }
};

// POST /api/connections/:connectionId/accept
const acceptRequest = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);
    if (!connection) return res.status(404).json({ message: "Request not found" });
    if (connection.recipient.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the recipient can accept this request" });
    }
    if (connection.status !== "pending") {
      return res.status(400).json({ message: "This request is no longer pending" });
    }

    connection.status = "accepted";
    await connection.save();
    res.json({ connection });
  } catch (err) {
    next(err);
  }
};

// POST /api/connections/:connectionId/reject
const rejectRequest = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);
    if (!connection) return res.status(404).json({ message: "Request not found" });
    if (connection.recipient.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the recipient can reject this request" });
    }

    connection.status = "rejected";
    await connection.save();
    res.json({ connection });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/connections/:connectionId  (cancel a sent request, or remove an accepted connection)
const removeConnection = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);
    if (!connection) return res.status(404).json({ message: "Request not found" });

    const isParty =
      connection.requester.toString() === req.userId || connection.recipient.toString() === req.userId;
    if (!isParty) return res.status(403).json({ message: "Not your connection" });

    await connection.deleteOne();
    res.json({ message: "Removed" });
  } catch (err) {
    next(err);
  }
};

// GET /api/connections  (accepted, either side is me)
const listConnections = async (req, res, next) => {
  try {
    const connections = await Connection.find({
      status: "accepted",
      $or: [{ requester: req.userId }, { recipient: req.userId }],
    })
      .populate("requester", PUBLIC_FIELDS)
      .populate("recipient", PUBLIC_FIELDS)
      .sort({ updatedAt: -1 });

    const users = connections.map((c) =>
      c.requester._id.toString() === req.userId ? c.recipient : c.requester
    );

    res.json({ connections: users });
  } catch (err) {
    next(err);
  }
};

// GET /api/connections/requests  (incoming, pending)
const listIncoming = async (req, res, next) => {
  try {
    const requests = await Connection.find({ recipient: req.userId, status: "pending" })
      .populate("requester", PUBLIC_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

// GET /api/connections/sent  (outgoing, pending)
const listOutgoing = async (req, res, next) => {
  try {
    const requests = await Connection.find({ requester: req.userId, status: "pending" })
      .populate("recipient", PUBLIC_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeConnection,
  listConnections,
  listIncoming,
  listOutgoing,
};
