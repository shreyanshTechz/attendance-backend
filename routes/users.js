import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import Attendance from '../models/Attendance.js';

const router = express.Router();

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

/* GET users listing. */
router.get('/', auth, async function(req, res) {
  try {
    // Pagination logic
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const total = await User.countDocuments({});
    const employees = await User.find({})
      .skip(skip)
      .limit(limit);
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Attach status to each user
    const usersWithStatus = await Promise.all(employees.map(async (emp) => {
      const att = await Attendance.findOne({ user: emp._id, loginTime: { $gte: today } }).sort({ loginTime: -1 });
      let status = 'Absent';
      if (att && att.loginTime && att.logoutTime) status = 'Present';
      else if (att && att.loginTime && !att.logoutTime) status = 'In Progress';
      return { ...emp.toObject(), status };
    }));
    res.status(200).json({
      users: usersWithStatus,
      total,
      hasMore: skip + employees.length < total,
      page,
      limit
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET all users' latest locations
router.get('/locations', auth, async function(req, res) {
  try {
    const users = await User.find({});
    const locations = await Promise.all(users.map(async (user) => {
      const latest = await Attendance.findOne({ user: user._id, 'location.latitude': { $exists: true }, 'location.longitude': { $exists: true } })
        .sort({ loginTime: -1, timestamp: -1 });
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        location: latest && latest.location ? latest.location : null,
      };
    }));
    res.status(200).json({ locations });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

/* GET individual user by ID */
router.get('/:id', auth, async function(req, res) {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// PUT update user location
router.put('/:id/location', auth, async function(req, res) {
  try {
    const { latitude, longitude } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { location: { latitude, longitude, updatedAt: new Date() } },
      { new: true }
    ).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(200).json({ msg: 'Location updated', user });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
