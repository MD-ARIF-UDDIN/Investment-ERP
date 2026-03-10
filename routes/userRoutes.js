const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { protect, admin } = require('../middleware/auth');

router.route('/').get(protect, getUsers).post(protect, admin, createUser);
router.route('/:id').put(protect, admin, updateUser).delete(protect, admin, deleteUser);

module.exports = router;
