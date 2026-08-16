const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({

    receiverId:{

        type:mongoose.Schema.Types.ObjectId,

        ref:"User",

        required:true

    },

    title:{

        type:String,

        required:true

    },

    message:{

        type:String,

        required:true

    },

    type:{

        type:String,

        enum:[
            "general",
            "booking",
            "payment",
            "property",
            "system",
            "NEW_MESSAGE",
            "BOOKING_CONFIRMED",
            "MOVE_IN_REMINDER",
            "NEW_ANNOUNCEMENT",
            "CHECK_IN_UPDATE",
            "DOCUMENT_REQUEST",
            "BOOKING_UPDATE",
            "NEW_RESIDENT_REQUEST",
            "RESIDENT_REQUEST_APPROVED",
            "RESIDENT_REQUEST_REJECTED"
        ],

        default:"general"

    },

    isRead:{

        type:Boolean,

        default:false

    }

},{
    timestamps:true
});
NotificationSchema.index({
    receiverId: 1,
    createdAt: -1
});
module.exports = mongoose.model(
    "Notification",
    NotificationSchema
);