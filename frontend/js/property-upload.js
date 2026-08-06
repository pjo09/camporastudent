import { API } from "./config.js";

const API_BASE = API;

const form = document.getElementById("propertyForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        // Collect amenities
        const amenities = [];

        document
            .querySelectorAll(".amenities input:checked")
            .forEach(item => amenities.push(item.value));

        // Upload Images
        const imageData = new FormData();

        const files = document.getElementById("images").files;

        for (let i = 0; i < files.length; i++) {

            imageData.append("images", files[i]);

        }

        const uploadResponse = await fetch(`${API}/upload`, {

            method: "POST",

            body: imageData

        });

        const upload = await uploadResponse.json();

        if (!upload.success) {

            alert("Image upload failed.");

            return;

        }

        // Save Property
        const property = {

            propertyName: document.getElementById("propertyName").value,

            propertyType: document.getElementById("propertyType").value,

            state: document.getElementById("stateSelect").value,

            city: document.getElementById("citySelect").value,

            college: document.getElementById("collegeSelect").value,

            address: document.getElementById("address").value,

            rent: Number(document.getElementById("rent").value),

            deposit: Number(document.getElementById("deposit").value),

            gender: document.getElementById("gender").value,

            sharing: document.getElementById("sharing").value,

            amenities,

            description: document.getElementById("description").value,

            images: upload.images

        };

        const saveResponse = await fetch(`${API}/property`, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(property)

        });

        const saved = await saveResponse.json();

        if (!saved.success) {

            alert("Property could not be saved.");

            return;

        }

        alert("🎉 Property Published Successfully!");

        form.reset();

    } catch (err) {

        console.log(err);

        alert("Something went wrong.");

    }

});