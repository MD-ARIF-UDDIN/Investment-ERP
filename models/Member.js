const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'সদস্যের নাম আবশ্যক'],
    },
    memberId: {
        type: String,
        unique: true,
        required: [true, 'সদস্য আইডি আবশ্যক'],
    },
    phone: {
        type: String,
        required: [true, 'ফোন নম্বর আবশ্যক'],
    },
    email: {
        type: String,
        default: ''
    },
    dateOfBirth: {
        type: Date,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', ''],
        default: ''
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
        default: ''
    },
    occupation: {
        type: String,
        default: ''
    },
    address: String,
    nid: {
        type: String,
        default: ''
    },
    joinDate: {
        type: Date,
        default: Date.now
    },
    // Nominee Information
    nomineeName: {
        type: String,
        default: ''
    },
    nomineePhone: {
        type: String,
        default: ''
    },
    nomineeRelation: {
        type: String,
        default: ''
    },
    nomineeNid: {
        type: String,
        default: ''
    },
    photo: {
        type: String,
        default: ''
    },
    nidPhoto: {
        type: String,
        default: ''
    },
    totalDeposit: {
        type: Number,
        default: 0,
    },
    totalWithdrawal: {
        type: Number,
        default: 0,
    },
    totalProfitShare: {
        type: Number,
        default: 0,
    },
    withdrawnProfit: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    userRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Member', memberSchema);
