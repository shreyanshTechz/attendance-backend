const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerContact: { type: String },
  customerAddress: { type: String },
  serviceLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    address: { type: String },
  },
  description: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['Assigned', 'In Progress', 'At Location', 'Photos Uploaded', 'Completed', 'Verified', 'Rejected'],
    default: 'Assigned',
  },
  photos: [{ type: String }], // URLs or base64
  reachedLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] },
    timestamp: { type: Date },
  },
  completedAt: { type: Date },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verificationComment: { type: String },
  rejectedComment: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

TaskSchema.index({ serviceLocation: '2dsphere' });

module.exports = mongoose.model('Task', TaskSchema); 