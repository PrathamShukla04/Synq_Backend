const express = require("express");
const router = express.Router();
const {
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeConnection,
  listConnections,
  listIncoming,
  listOutgoing,
} = require("../controllers/connectionController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.get("/", listConnections);
router.get("/requests", listIncoming);
router.get("/sent", listOutgoing);

router.post("/request/:userId", sendRequest);
router.post("/:connectionId/accept", acceptRequest);
router.post("/:connectionId/reject", rejectRequest);
router.delete("/:connectionId", removeConnection);

module.exports = router;
