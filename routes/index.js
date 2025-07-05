import express from 'express';
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('API is running');
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

export default router;
