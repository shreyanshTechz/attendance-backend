import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  location: {
    latitude: Number,
    longitude: Number,
  },
  ipAddress: String,
  status: { type: String, enum: ['present', 'unknown'], default: 'present' },
  loginTime: { type: Date },
  logoutTime: { type: Date },
  duration: { type: Number }, // in minutes
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance; 