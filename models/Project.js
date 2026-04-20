const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'প্রকল্পের নাম আবশ্যক'],
    },
    totalInvestment: {
        type: Number,
        required: [true, 'মোট বিনিয়োগ আবশ্যক'],
    },
    currentProfit: {
        type: Number,
        default: 0,
    },
    distributedProfit: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['Running', 'Completed', 'Cancelled'],
        default: 'Running',
    },
    description: {
        type: String,
    },
    location: {
        type: String,
    },
    projectType: {
        type: String,
        enum: ['Real Estate', 'Business', 'Agriculture', 'Technology', 'Trade', 'Other'],
        default: 'Other',
    },
    expectedReturn: {
        type: Number,
    },
    responsiblePerson: {
        type: String,
    },
    contactPhone: {
        type: String,
    },
    returnPercentage: {
        type: Number,
        default: 0,
    },
    returnMonths: {
        type: Number,
        default: 1,
    },
    image: {
        type: String,
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: Date,
    paymentsReceived: [{
        amount: Number,
        date: { type: Date, default: Date.now },
        note: String
    }],
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

module.exports = mongoose.model('Project', projectSchema);
