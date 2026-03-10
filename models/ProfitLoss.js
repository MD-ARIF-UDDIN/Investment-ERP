const mongoose = require('mongoose');

const profitLossSchema = new mongoose.Schema({
    period: {
        type: String, // e.g., "March 2026"
        required: true,
    },
    totalIncome: {
        type: Number,
        required: true,
    },
    totalExpense: {
        type: Number,
        required: true,
    },
    netProfitLoss: {
        type: Number,
        required: true,
    },
    distributions: [{
        member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
        amount: Number,
        date: { type: Date, default: Date.now }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('ProfitLoss', profitLossSchema);
