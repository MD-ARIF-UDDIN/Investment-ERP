const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: function () { return this.type !== 'Project Investment'; }
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: function () { return this.type === 'Project Investment'; }
    },
    amount: {
        type: Number,
        required: [true, 'উত্তোলনের পরিমাণ আবশ্যক'],
    },
    date: {
        type: Date,
        default: Date.now,
    },
    type: {
        type: String,
        enum: ['Normal', 'Profit', 'Project Investment'],
        default: 'Normal',
    },
    reason: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
