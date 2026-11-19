const express = require('express');
const Music = require('../models/Music');

const router = express.Router();

// GET /api/music - danh sach nhac dang bat (public). Client tu random 1 bai khi vao web.
router.get('/', async (req, res, next) => {
  try {
    const tracks = await Music.find({ isActive: true }).select('title url -_id').lean();
    res.set('Cache-Control', 'no-store');
    res.json({ tracks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
