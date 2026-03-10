const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema({
    totalAmount: {
        type: Number,
        required: [true, 'মোট বিতরণের পরিমাণ আবশ্যক'],
    },
    method: {
        type: String,
        enum: ['Equal', 'ByDeposit', 'Manual'],
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    shares: [{
        member: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Member',
            required: true
        },
        amount: {
            type: Number,
            required: true
        }
    }],
    note: String,
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

module.exports = mongoose.model('Distribution', distributionSchema);
