const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(protect, getExpenses)
    .post(protect, admin, upload.single('receipt'), createExpense);

router.route('/:id')
    .put(protect, admin, upload.single('receipt'), updateExpense)
    .delete(protect, admin, deleteExpense);

module.exports = router;
