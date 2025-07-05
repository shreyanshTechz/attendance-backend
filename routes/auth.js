import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// Get admin emails from env
const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(email, otp, subject) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Attendance App</h2>
        <p>Your OTP for ${subject.toLowerCase()} is:</p>
        <h1 style="color: #1976d2; font-size: 32px; letter-spacing: 5px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

// Auth middleware
function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.REACT_APP_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
}

// Register
router.post('/register', [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password, deviceId } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
    const role = isAdmin ? 'admin' : 'employee';
    user = new User({ name, email, password: hashed, deviceId, role });
    console.log(user);
    user.save();
    res.status(200).json({ msg: 'User created successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, deviceId } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
    if (!deviceId) return res.status(400).json({ msg: 'Device ID required' });
    if (!user.deviceId) {
      user.deviceId = deviceId;
      await user.save();
    } else if (user.deviceId !== deviceId) {
      return res.status(403).json({ msg: 'Login not allowed from this device. Please use your registered device.' });
    }
    // Always set role to admin if email is in ADMIN_EMAILS
    let role = user.role;
    if (ADMIN_EMAILS.includes(email.toLowerCase()) && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
      role = 'admin';
    }
    const token = jwt.sign({ id: user._id, role: role }, process.env.REACT_APP_JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: role, photo: user.photo } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Send OTP for password reset
router.post('/send-otp', [
  body('email').isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    await sendOTPEmail(email, otp, 'Password Reset OTP');
    
    res.json({ msg: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ msg: 'Failed to send OTP' });
  }
});

// Verify OTP and reset password
router.post('/reset-password', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { email, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    if (user.otp !== otp) return res.status(400).json({ msg: 'Invalid OTP' });
    if (user.otpExpiry < new Date()) return res.status(400).json({ msg: 'OTP expired' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    
    res.json({ msg: 'Password reset successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ msg: 'Failed to reset password' });
  }
});

// Send OTP for email change verification
router.post('/send-email-otp', auth, async (req, res) => {
  const { newEmail } = req.body;
  try {
    // Check if new email already exists
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) return res.status(400).json({ msg: 'Email already in use' });
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    await sendOTPEmail(newEmail, otp, 'Email Change Verification');
    
    res.json({ msg: 'OTP sent to new email' });
  } catch (err) {
    console.error('Error sending email OTP:', err);
    res.status(500).json({ msg: 'Failed to send OTP' });
  }
});

// Verify email change OTP
router.post('/verify-email-otp', auth, [
  body('newEmail').isEmail(),
  body('otp').isLength({ min: 6, max: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { newEmail, otp } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    if (user.otp !== otp) return res.status(400).json({ msg: 'Invalid OTP' });
    if (user.otpExpiry < new Date()) return res.status(400).json({ msg: 'OTP expired' });
    
    user.email = newEmail;
    user.otp = null;
    user.otpExpiry = null;
    user.isEmailVerified = true;
    await user.save();
    
    res.json({ msg: 'Email updated successfully', user: { id: user._id, name: user.name, email: user.email, role: user.role, photo: user.photo } });
  } catch (err) {
    console.error('Error updating email:', err);
    res.status(500).json({ msg: 'Failed to update email' });
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
  res.json({ token: req.user.token, user: req.user });
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  const { name, photo } = req.body;
  try {
    // Validate image size if photo is base64
    if (photo && typeof photo === 'string' && photo.startsWith('data:image')) {
      // Roughly estimate base64 size (4/3 of original, minus header)
      const base64Length = photo.length - (photo.indexOf(',') + 1);
      const sizeInKB = base64Length * 0.75 / 1024;
      if (sizeInKB > 300) {
        return res.status(413).json({ msg: 'Profile image too large. Please use an image under 300KB.' });
      }
    }
    const user = await User.findByIdAndUpdate(req.user.id, { name, photo }, { new: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Change password (requires current password)
router.put('/change-password', auth, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ msg: 'Failed to change password' });
  }
});

export default router; 