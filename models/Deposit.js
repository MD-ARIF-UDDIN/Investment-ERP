const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    depositFor: {
        type: String,
        enum: ['Member', 'Project'],
        default: 'Member',
        required: true
    },
    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: function () { return this.depositFor === 'Member'; }
    },
    amount: {
        type: Number,
        required: [true, 'পরিমাণ আবশ্যক'],
    },
    type: {
        type: String,
        enum: ['Monthly', 'One-time', 'Project-Return', 'Income', 'Profit'],
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: function () { return this.depositFor === 'Project'; }
    },
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

module.exports = mongoose.model('Deposit', depositSchema);
