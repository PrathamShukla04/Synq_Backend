const express = require("express");
const router = express.Router();
const { listMyInvites, acceptInvite, rejectInvite } = require("../controllers/projectInviteController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.get("/", listMyInvites);
router.post("/:inviteId/accept", acceptInvite);
router.post("/:inviteId/reject", rejectInvite);

module.exports = router;
