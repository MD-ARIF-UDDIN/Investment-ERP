const express = require('express');
const router = express.Router();
const { getLogs } = require('../controllers/logController');
const { protect, admin } = require('../middleware/auth');

router.route('/')
    .get(protect, getLogs);

module.exports = router;
