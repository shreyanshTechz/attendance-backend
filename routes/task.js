const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const multer = require('multer');
const path = require('path');

// Multer setup for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/images'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// Create a new task
router.post('/', async (req, res) => {
  try {
    const { customerName, customerContact, customerAddress, description, location } = req.body;
    if (!customerName || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'Customer name and location are required.' });
    }
    // Assume req.user._id is set by authentication middleware
    const assignedTo = req.user && req.user._id ? req.user._id : undefined;
    const task = new Task({
      customerName,
      customerContact,
      customerAddress,
      description,
      serviceLocation: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        address: customerAddress,
      },
      status: 'Assigned',
      assignedTo,
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a task by ID
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a task
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update task status (with optional geo-verification)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, location, comment } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Geo-verification for 'At Location' status
    if (status === 'At Location' && location) {
      const [lng, lat] = task.serviceLocation.coordinates;
      const dist = Math.sqrt(Math.pow(lat - location.latitude, 2) + Math.pow(lng - location.longitude, 2));
      if (dist > 0.001) return res.status(400).json({ error: 'Not at assigned location' });
      task.reachedLocation = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        timestamp: new Date(),
      };
    }
    task.status = status;
    task.history.push({ status, timestamp: new Date(), user: req.user?._id, comment });
    await task.save();
    res.json(task);
  } catch (err) {
    console.error('Error updating task status:', err);
    res.status(400).json({ error: err.message });
  }
});

// Photo upload (must be at location)
router.post('/:id/photos', upload.array('photos', 10), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Optionally check geo-location here (req.body.location)
    if (req.files) {
      req.files.forEach(f => task.photos.push('/images/' + f.filename));
    }
    if (task.photos.length >= 5) task.status = 'Photos Uploaded';
    task.history.push({ status: 'Photos Uploaded', timestamp: new Date(), user: req.user?._id });
    await task.save();
    res.json(task);
  } catch (err) {
    console.error('Error uploading photos:', err);
    res.status(400).json({ error: err.message });
  }
});

// Admin verify/reject
router.patch('/:id/verify', async (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'verify' or 'reject'
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (action === 'verify') {
      task.status = 'Verified';
      task.verifiedAt = new Date();
      task.verifiedBy = req.user?._id;
      task.verificationComment = comment;
      task.history.push({ status: 'Verified', timestamp: new Date(), user: req.user?._id, comment });
    } else if (action === 'reject') {
      task.status = 'Rejected';
      task.rejectedComment = comment;
      task.history.push({ status: 'Rejected', timestamp: new Date(), user: req.user?._id, comment });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    await task.save();
    res.json(task);
  } catch (err) {
    console.error('Error verifying/rejecting task:', err);
    res.status(400).json({ error: err.message });
  }
});

// Analytics endpoint (basic)
router.get('/analytics/summary', async (req, res) => {
  try {
    const total = await Task.countDocuments();
    const byStatus = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json({ total, byStatus });
  } catch (err) {
    console.error('Error in analytics summary:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 