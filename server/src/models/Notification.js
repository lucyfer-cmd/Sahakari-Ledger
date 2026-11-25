const mongoose = require('mongoose');
const jsonId = require('./_json');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    message: { type: String, required: true, maxlength: 300 },
    key: { type: String, default: null, index: true }, // prevents sending the same reminder twice
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);
jsonId(notificationSchema);

module.exports = mongoose.model('Notification', notificationSchema);
