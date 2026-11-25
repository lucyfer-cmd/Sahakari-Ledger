const Notification = require('../models/Notification');
const User = require('../models/User');

/** Creates a notification. If a key is given, the same key is never notified twice. Never throws. */
async function notify(userId, type, message, key = null) {
  try {
    if (!userId) return null;
    if (key && (await Notification.exists({ user: userId, key }))) return null;
    return await Notification.create({ user: userId, type, message, key });
  } catch (err) {
    console.error('Notification failed:', err.message);
    return null;
  }
}

/** Finds the login account that belongs to a member (if the member has registered). */
async function notifyMember(memberId, type, message, key = null) {
  const user = await User.findOne({ member: memberId, status: 'active' });
  return user ? notify(user._id, type, message, key) : null;
}

module.exports = { notify, notifyMember };
