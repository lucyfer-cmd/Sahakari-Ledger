const mongoose = require('mongoose');
const jsonId = require('./_json');

const memberSchema = new mongoose.Schema(
  {
    membershipNo: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['female', 'male', 'other', null], default: null },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254, default: '' },
    address: {
      ward: { type: String, trim: true, default: '' },
      municipality: { type: String, trim: true, default: '' },
      district: { type: String, trim: true, default: '' },
    },
    nominee: {
      name: { type: String, trim: true, default: '' },
      relation: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },
    status: { type: String, enum: ['active', 'suspended', 'closed'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);
memberSchema.index({ fullName: 1 });
memberSchema.index({ phone: 1 });
jsonId(memberSchema);

module.exports = mongoose.model('Member', memberSchema);
