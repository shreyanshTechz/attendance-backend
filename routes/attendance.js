import express from 'express';
import jwt from 'jsonwebtoken';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import fetch from 'node-fetch';

const router = express.Router();

// Middleware to check JWT
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

// Mark attendance
router.post('/mark', auth, async (req, res) => {
  const { latitude, longitude, ipAddress } = req.body;
  console.log(latitude, longitude, ipAddress);
  // Office location and IP (should be set in env or config)
  const officeLat = 26.7428378, officeLng = 83.3797713, allowedIP = '123.123.123.123'; // Example values
  const isLocationValid = Math.abs(latitude - officeLat) < 20 && Math.abs(longitude - officeLng) < 20;
  // const isIPValid = ipAddress === allowedIP;
  const status = (isLocationValid) ? 'present' : 'unknown';
  try {
    const attendance = new Attendance({
      user: req.user.id,
      location: { latitude, longitude },
      ipAddress,
      status,
    });
    await attendance.save();
    const user = await User.findById(req.user.id);
    let message = `${user.name} marked attendance.`;
    if (status === 'unknown') message = `${user.name} tried to mark attendance from an unknown location or IP.`;
    res.json({ msg: 'Attendance marked', status });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Admin: View all attendance
router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  try {
    const records = await Attendance.find().populate('user', 'name email');
    res.json(records);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// User: View own attendance history
router.get('/history', auth, async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user.id }).sort({ timestamp: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Admin: Get attendance history for a specific user
router.get('/user/:userId', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  try {
    const records = await Attendance.find({ user: req.params.userId })
      .sort({ loginTime: -1 })
      .populate('user', 'name email');
    res.json(records);
  } catch (err) {
    console.error('Error fetching user attendance:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// User login (start office hours)
router.post('/login', auth, async (req, res) => {
  const { latitude, longitude, ipAddress } = req.body;
  const officeLat = 26.7428378, officeLng = 83.3797713;
  const isLocationValid = Math.abs(latitude - officeLat) < 0.2 && Math.abs(longitude - officeLng) < 0.2;
  if (!isLocationValid) return res.status(403).json({ msg: 'Not within office location' });
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    let attendance = await Attendance.findOne({ user: req.user.id, loginTime: { $gte: today } });
    if (!attendance) {
      attendance = new Attendance({
        user: req.user.id,
        location: { latitude, longitude },
        ipAddress,
        status: 'present',
        loginTime: new Date(),
      });
      await attendance.save();
    } else {
      attendance.loginTime = new Date();
      await attendance.save();
    }
    res.json({ msg: 'Login recorded', loginTime: attendance.loginTime });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// User logout (end office hours)
router.post('/logout', auth, async (req, res) => {
  const { latitude, longitude, ipAddress } = req.body;
  const officeLat = 26.7428378, officeLng = 83.3797713;
  const isLocationValid = Math.abs(latitude - officeLat) < 0.2 && Math.abs(longitude - officeLng) < 0.2;
  if (!isLocationValid) return res.status(403).json({ msg: 'Not within office location' });
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    let attendance = await Attendance.findOne({ user: req.user.id, loginTime: { $gte: today } });
    if (!attendance) return res.status(400).json({ msg: 'No login found for today' });
    attendance.logoutTime = new Date();
    attendance.duration = Math.round((attendance.logoutTime - attendance.loginTime) / 60000); // in minutes
    await attendance.save();
    res.json({ msg: 'Logout recorded', logoutTime: attendance.logoutTime, duration: attendance.duration });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 