const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema({

    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    propertyName:{
        type:String,
        required:true,
        trim:true
    },

propertyType:{
        type:String,
        enum:["PG","Hostel","Apartment","Flat","Coliving"],
        required:true
    },

    state:{
        type:String,
        required:true
    },

    city:{
        type:String,
        required:true
    },

    college:{
        type:String,
        default:""
    },

    address:{
        type:String,
        required:true
    },

    latitude:Number,

    longitude:Number,

    rent:{
        type:Number,
        required:true
    },

    deposit:{
        type:Number,
        default:0
    },

gender:{
        type:String,
        enum:["Boys","Girls","Co-ed","Unisex"]
    },

    sharing:{
        type:String,
        enum:["Single","Double","Triple","Four Sharing"]
    },

    amenities:[String],

    description:String,

    images:[String],

    availableBeds:{
        type:Number,
        default:0
    },

    totalBeds:{
        type:Number,
        default:0
    },

    featured:{
        type:Boolean,
        default:false
    },

    verified:{
        type:Boolean,
        default:false
    },

    status:{
        type:String,
        enum:["pending","approved","rejected"],
        default:"pending"
    },

    averageRating:{
        type:Number,
        default:0
    },

    totalReviews:{
        type:Number,
        default:0
    },

    views: {
    type: Number,
    default: 0
},

// ==========================================
// PROPERTY RULES
// ==========================================

houseRules:{

    smoking:{
        type:Boolean,
        default:false
    },

    drinking:{
        type:Boolean,
        default:false
    },

    pets:{
        type:Boolean,
        default:false
    },

    visitors:{
        type:Boolean,
        default:true
    },

    gateClosingTime:{
        type:String,
        default:""
    }

},

// ==========================================
// EXTRA CHARGES
// ==========================================

maintenanceCharge:{
    type:Number,
    default:0
},

electricityCharge:{
    type:Number,
    default:0
},

foodCharge:{
    type:Number,
    default:0
},

// ==========================================
// PROPERTY STATUS
// ==========================================

available:{
    type:Boolean,
    default:true
},

published:{
    type:Boolean,
    default:false
},

blacklisted:{
    type:Boolean,
    default:false
},

// ==========================================
// NEARBY
// ==========================================

nearby:[{

    title:String,

    distance:String

}]

}, {
    timestamps: true
});
PropertySchema.index({ city: 1 });

PropertySchema.index({ state: 1 });

PropertySchema.index({ college: 1 });

PropertySchema.index({ rent: 1 });

PropertySchema.index({ propertyType: 1 });

PropertySchema.index({ status: 1 });

PropertySchema.index({ featured: 1 });

PropertySchema.index({ owner: 1 });

PropertySchema.index({ averageRating: -1 });

PropertySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Property", PropertySchema);