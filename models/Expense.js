const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'খরচের শিরোনাম আবশ্যক'],
    },
    amount: {
        type: Number,
        required: [true, 'খরচের পরিমাণ আবশ্যক'],
    },
    category: {
        type: String,
        required: [true, 'ক্যাটাগরি আবশ্যক'],
    },
    date: {
        type: Date,
        default: Date.now,
    },
    note: String,
    receipt: {
        type: String,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    withdrawalRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Withdrawal',
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Expense', expenseSchema);
