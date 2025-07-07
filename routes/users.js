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
    res.status(200).json({
      users: employees,
      total,
      hasMore: skip + employees.length < total,
      page,
      limit
    });
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

export default router;
