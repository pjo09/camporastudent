const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({

    property:{

        type:mongoose.Schema.Types.ObjectId,

        ref:"Property",

        required:true

    },

    user:{

        type:mongoose.Schema.Types.ObjectId,

        ref:"User",

        required:true

    },

    name:{
        type:String,
        default:""
    },

    rating:{

        type:Number,

        required:true,

        min:1,

        max:5

    },

    comment:{

        type:String,

        required:true,

        trim:true

    },

    status:{

        type:String,

        enum:[
            "pending",
            "approved",
            "hidden"
        ],

        default:"approved"

    },

    reported:{

        type:Boolean,

        default:false

    },

    likes:{

        type:Number,

        default:0

    },

    ownerReply:{

        type:String,

        default:""

    }

},{
    timestamps:true
});

module.exports = mongoose.model("Review",reviewSchema);