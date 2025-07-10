import express from 'express';
import Task from '../models/Task.js';

const router = express.Router();

// Create a new task
router.post('/', async (req, res) => {
  try {
    const { customerName, customerContact, customerAddress, description, location, assignedTo } = req.body;
    if (!customerName || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'Customer name and location are required.' });
    }
    // Use assignedTo from body if provided (admin), else default to current user
    const assignedToFinal = assignedTo || (req.user && req.user._id ? req.user._id : undefined);
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
      assignedTo: assignedToFinal,
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error('Error getting all tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a task by ID
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('assignedTo', 'name email');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error('Error getting task by ID:', err);
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
    console.error('Error editing task:', err);
    res.status(400).json({ error: err.message });
  }
});

// Update task status (no more in progress, at location, photos uploaded)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, comment } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Only allow valid transitions
    const validTransitions = {
      'Assigned': ['Completed'],
      'Completed': ['Verified', 'Rejected', 'Assigned'],
      'Verified': ['Assigned'],
      'Rejected': ['Assigned']
    };
    if (!validTransitions[task.status] || !validTransitions[task.status].includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }
    task.status = status;
    task.history.push({ status, timestamp: new Date(), user: req.user?._id, comment });
    if (status === 'Completed') task.completedAt = new Date();
    if (status === 'Verified') task.verifiedAt = new Date();
    await task.save();
    res.json(task);
  } catch (err) {
    console.error('Error updating task status:', err);
    res.status(400).json({ error: err.message });
  }
});

// Photo upload (Cloudinary URLs, only triggers Completed if setCompleted=true)
router.post('/:id/photos', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { photos } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }
    photos.forEach(url => task.photos.push(url));
    const setCompleted = req.query.setCompleted === 'true';
    if (setCompleted && task.photos.length >= 5) {
      task.status = 'Completed';
      task.completedAt = new Date();
      task.history.push({ status: 'Completed', timestamp: new Date(), user: req.user?._id });
    }
    await task.save();
    res.json(task);
  } catch (err) {
    console.error('Error uploading photos:', err);
    res.status(400).json({ error: err.message });
  }
});

// Helper for distance in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

// Delete a task by ID
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
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

export default router; 