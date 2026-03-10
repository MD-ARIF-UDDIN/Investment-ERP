const express = require('express');
const router = express.Router();
const { getDeposits, createDeposit, updateDeposit, deleteDeposit, getDepositsByMember } = require('../controllers/depositController');
const { protect, admin } = require('../middleware/auth');

router.route('/')
    .get(protect, getDeposits)
    .post(protect, admin, createDeposit);

router.get('/member/:memberId', protect, getDepositsByMember);

router.route('/:id')
    .put(protect, admin, updateDeposit)
    .delete(protect, admin, deleteDeposit);

module.exports = router;
