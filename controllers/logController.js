const Log = require('../models/Log');

// @desc    Get all audit logs
// @route   GET /api/logs
// @access  Private/Admin
const getLogs = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    try {
        const total = await Log.countDocuments({});
        const logs = await Log.find({})
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email');

        res.json({
            logs,
            page,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Clear all audit logs
// @route   DELETE /api/logs
// @access  Private/Admin
const clearLogs = async (req, res) => {
    try {
        await Log.deleteMany({});
        res.json({ message: 'All audit logs have been cleared successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getLogs, clearLogs };
