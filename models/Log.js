const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
    },
    entityType: {
        type: String,
        required: true, // User, Member, Deposit, etc.
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Log', logSchema);
