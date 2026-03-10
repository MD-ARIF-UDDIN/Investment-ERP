const express = require('express');
const router = express.Router();
const { getWithdrawals, createWithdrawal, updateWithdrawal, deleteWithdrawal } = require('../controllers/withdrawalController');
const { protect, admin } = require('../middleware/auth');

router.route('/')
    .get(protect, getWithdrawals)
    .post(protect, admin, createWithdrawal);

router.route('/:id')
    .put(protect, admin, updateWithdrawal)
    .delete(protect, admin, deleteWithdrawal);

module.exports = router;
