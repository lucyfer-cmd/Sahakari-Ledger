const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Notification = require('../models/Notification');

exports.list = asyncHandler(async (req, res) => {
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ notifications, unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  if (!n.readAt) { n.readAt = new Date(); await n.save(); }
  res.json({ notification: n });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.status(204).end();
});
