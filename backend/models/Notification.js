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
            "system"
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