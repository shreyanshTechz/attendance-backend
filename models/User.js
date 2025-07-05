import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Not required for Google users
  googleId: { type: String },
  role: { type: String, enum: ['employee', 'admin'], default: 'employee' },
  createdAt: { type: Date, default: Date.now },
  pushToken: { type: String },
  photo: { type: String },
  deviceId: { type: String },
  // OTP fields for email verification and password reset
  otp: { type: String },
  otpExpiry: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
});

const User = mongoose.model('User', userSchema);
export default User; 