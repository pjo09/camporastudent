require("dotenv").config();

const State = require("../../models/State");
const City = require("../../models/City");
const College = require("../../models/College");

const connectDB = require("../../config/db");

async function seedIndia(){

    try{

        await connectDB();

        console.log("Connected");

        await State.deleteMany({});
        await City.deleteMany({});
        await College.deleteMany({});

        console.log("Old Data Deleted");

        // State

        const maharashtra = await State.create({

            name:"Maharashtra"

        });

        // City

        const pune = await City.create({

            name:"Pune",

            state:maharashtra._id

        });

        // Colleges

        await College.insertMany([

            {

                state:maharashtra._id,

                city:pune._id,

                name:"MIT World Peace University"

            },

            {

                state:maharashtra._id,

                city:pune._id,

                name:"COEP Technological University"

            },

            {

                state:maharashtra._id,

                city:pune._id,

                name:"Savitribai Phule Pune University"

            },

            {

                state:maharashtra._id,

                city:pune._id,

                name:"Symbiosis International University"

            }

        ]);

        console.log("Seed Completed");

        process.exit();

    }

    catch(err){

        console.log(err);

        process.exit();

    }

}

seedIndia();