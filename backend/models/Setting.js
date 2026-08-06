const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema({

    siteName:{
        type:String,
        default:"Campora"
    },

    siteDescription:{
        type:String,
        default:"India's Smart Student Accommodation Platform"
    },

    supportEmail:{
        type:String,
        default:"support@campora.in"
    },

    supportPhone:{
        type:String,
        default:""
    },

    maintenanceMode:{
        type:Boolean,
        default:false
    },

    allowRegistration:{
        type:Boolean,
        default:true
    },

    allowPropertyUpload:{
        type:Boolean,
        default:true
    },

    featuredPropertyFee:{
        type:Number,
        default:0
    },

    commissionPercentage:{
        type:Number,
        default:5
    },

    currency:{
        type:String,
        default:"INR"
    }

},{
    timestamps:true
});

module.exports = mongoose.model("Setting", SettingSchema);