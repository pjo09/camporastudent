// =====================================================
// CAMPORA PROPERTY PAGE
// =====================================================

import { getToken, getUser, isLoggedIn } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;
const IMAGE_BASE_URL = API;

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

// =====================================================
// HELPERS
// =====================================================

function $(id){
    return document.getElementById(id);
}

let currentProperty = null;
let isSavedState = false;

// =====================================================
// LOAD PAGE
// =====================================================

window.addEventListener("DOMContentLoaded", () => {

    if (!propertyId) {

        alert("Property not found.");

        window.location.href = "dashboard.html";

        return;

    }

    loadProperty();
    loadSimilar();
    checkSavedStatus();

});

// =====================================================
// LOAD PROPERTY
// =====================================================

async function loadProperty(){

    try{

        const response = await fetch(
            `${API}/properties/${propertyId}`
        );

        const data = await response.json();

        if(!response.ok){

            throw new Error(data.message || "Unable to load property.");

        }

        currentProperty = data.property || data;

        renderProperty(currentProperty);

    }

    catch(error){

        console.error("Property Error:", error);

        alert("Unable to load property.");

    }

}

// =====================================================
// RENDER PROPERTY
// =====================================================

function renderProperty(property){

    $("propertyTitle").textContent =
        property.title || "Campora Property";

    $("propertyLocation").innerHTML = `
        <i class="fa-solid fa-location-dot"></i>
        ${property.city || ""}, ${property.state || ""}
    `;

    $("propertyPrice").textContent =
        property.price || 0;

    $("propertyDescription").textContent =
        property.description || "No description available.";

    // Owner

    $("ownerName").textContent =
        property.owner?.name || "Campora Owner";

    $("ownerAvatar").textContent =
        (property.owner?.name || "C")
        .charAt(0)
        .toUpperCase();

    // Rating

    if($("propertyRating")){

        $("propertyRating").textContent =
            property.rating || "4.8";

    }

    if($("reviewCount")){

        $("reviewCount").textContent =
            `${property.reviewCount || 0} Reviews`;

    }

    loadImages(property.images || []);

    loadAmenities(property);

    loadRoomInfo(property);

    loadNearby(property);

    loadMap(property);

}
// =====================================================
// IMAGE GALLERY
// =====================================================

function loadImages(images){

    const main = $("mainImage");
    const thumbs = $("thumbnailContainer");

    thumbs.innerHTML = "";

    if(!images || images.length === 0){

        main.src = "./images/property-placeholder.jpg";

        return;

    }

    const firstImage = images[0].startsWith("http")

        ? images[0]

        : IMAGE_BASE_URL + images[0];

    main.src = firstImage;

    images.forEach(img=>{

        const image = document.createElement("img");

        image.className = "thumbnail";

        image.src = img.startsWith("http")

            ? img

            : IMAGE_BASE_URL + img;

        image.alt = "Property Image";

        image.loading = "lazy";

        image.addEventListener("click",()=>{

            main.src = image.src;

            document
            .querySelectorAll(".thumbnail")
            .forEach(t=>t.classList.remove("active"));

            image.classList.add("active");

        });

        thumbs.appendChild(image);

    });

    const firstThumb = thumbs.querySelector(".thumbnail");

    if(firstThumb){

        firstThumb.classList.add("active");

    }

}

// =====================================================
// AMENITIES
// =====================================================

function loadAmenities(property){

    const container = $("amenities");

    container.innerHTML = "";

    const amenities = property.amenities || [

        "High Speed WiFi",

        "Food Included",

        "Laundry",

        "Parking",

        "Air Conditioning",

        "24x7 Security",

        "Gym",

        "Smart TV"

    ];

    const icons = {

        "High Speed WiFi":"fa-wifi",

        "Food Included":"fa-utensils",

        "Laundry":"fa-shirt",

        "Parking":"fa-car",

        "Air Conditioning":"fa-fan",

        "24x7 Security":"fa-shield",

        "Gym":"fa-dumbbell",

        "Smart TV":"fa-tv"

    };

    amenities.forEach(item=>{

        const card = document.createElement("div");

        card.className = "amenity";

        card.innerHTML = `

            <i class="fa-solid ${icons[item] || "fa-circle-check"}"></i>

            <span>${item}</span>

        `;

        container.appendChild(card);

    });

}

// =====================================================
// ROOM INFORMATION
// =====================================================

function loadRoomInfo(property){

    $("roomInfo").innerHTML = `

        <div class="room-card">

            <h3>Room Type</h3>

            <p>${property.roomType || "Single Sharing"}</p>

        </div>

        <div class="room-card">

            <h3>Available Rooms</h3>

            <p>${property.availableRooms || 0}</p>

        </div>

        <div class="room-card">

            <h3>Gender</h3>

            <p>${property.gender || "Boys & Girls"}</p>

        </div>

        <div class="room-card">

            <h3>Security Deposit</h3>

            <p>₹${property.deposit || 0}</p>

        </div>

    `;

}

// =====================================================
// NEARBY UNIVERSITIES
// =====================================================

function loadNearby(property){

    const container = $("nearbyUniversities");

    container.innerHTML = "";

    const universities = property.nearbyUniversities || [];

    if(universities.length === 0){

        container.innerHTML = "<p>No nearby universities available.</p>";

        return;

    }

    universities.forEach(name=>{

        const div = document.createElement("div");

        div.className = "university";

        div.innerHTML = `

            <h3>${name}</h3>

            <p>Nearby Campus</p>

        `;

        container.appendChild(div);

    });

}

// =====================================================
// GOOGLE MAP
// =====================================================

function loadMap(property){

    const map = $("map");

    if(!map) return;

    const address = encodeURIComponent(

        `${property.address || ""} ${property.city || ""} ${property.state || ""}`

    );

    map.innerHTML = `

        <iframe

            src="https://www.google.com/maps?q=${address}&output=embed"

            width="100%"

            height="100%"

            style="border:0;border-radius:18px"

            loading="lazy"

            allowfullscreen>

        </iframe>

    `;

}
// =====================================================
// CHECK SAVED STATUS
// =====================================================

async function checkSavedStatus() {
    const saveBtn = $("saveProperty");
    if (!saveBtn) return;

    if (!isLoggedIn()) {
        saveBtn.innerHTML = `<i class="fa-regular fa-heart"></i> <span>Save</span>`;
        return;
    }

    try {
        const token = getToken();
        const res = await fetch(`${API}/properties/save/${propertyId}/check`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.saved) {
            isSavedState = true;
            saveBtn.innerHTML = `<i class="fa-solid fa-heart"></i> <span>Saved</span>`;
            saveBtn.classList.add("saved");
        } else {
            isSavedState = false;
            saveBtn.innerHTML = `<i class="fa-regular fa-heart"></i> <span>Save</span>`;
            saveBtn.classList.remove("saved");
        }
    } catch (err) {
        console.error("Check saved error:", err);
    }
}

// =====================================================
// SAVE / UNSAVE PROPERTY
// =====================================================

const saveBtn = $("saveProperty");

if(saveBtn){
    saveBtn.addEventListener("click", async () => {
        if (!isLoggedIn()) {
            alert("Please login to save properties.");
            window.location.href = "login.html";
            return;
        }

        const token = getToken();

        try {
            if (isSavedState) {
                // Unsave
                const res = await fetch(`${API}/properties/save/${propertyId}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    isSavedState = false;
                    saveBtn.innerHTML = `<i class="fa-regular fa-heart"></i> <span>Save</span>`;
                    saveBtn.classList.remove("saved");
                }
            } else {
                // Save
                const res = await fetch(`${API}/properties/save/${propertyId}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    isSavedState = true;
                    saveBtn.innerHTML = `<i class="fa-solid fa-heart"></i> <span>Saved</span>`;
                    saveBtn.classList.add("saved");
                }
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("Unable to save property. Please try again.");
        }
    });
}

// =====================================================
// BOOK NOW
// =====================================================

const bookBtn = $("bookNowBtn");

if(bookBtn){

    bookBtn.addEventListener("click",()=>{

        window.location.href =

        `booking.html?id=${propertyId}`;

    });

}

// =====================================================
// CONTACT OWNER
// =====================================================

const contactBtn = $("contactOwner");

if(contactBtn){

    contactBtn.addEventListener("click",()=>{

        if(!currentProperty) return;

        const email =

        currentProperty.owner?.email;

        if(email){

            window.location.href =

            `mailto:${email}`;

        }

        else{

            alert("Owner email not available.");

        }

    });

}

// =====================================================
// CHAT OWNER
// =====================================================

const chatBtn = $("chatOwner");

if(chatBtn){

    chatBtn.addEventListener("click",()=>{

        alert(

            "Live chat will be connected with your backend."

        );

    });

}

// =====================================================
// SIMILAR PROPERTIES
// =====================================================

async function loadSimilar(){

    const container = $("similarProperties");

    if(!container) return;

    try{

        const response = await fetch(

            `${API}/properties`

        );

        const data = await response.json();

        const properties =

            data.properties || data || [];

        container.innerHTML = "";

        properties

        .filter(item => item._id !== propertyId)

        .slice(0,4)

        .forEach(property=>{

            const image =

                property.images?.length

                ? (

                    property.images[0].startsWith("http")

                    ? property.images[0]

                    : IMAGE_BASE_URL + property.images[0]

                )

                : "./images/property-placeholder.jpg";

            const card = document.createElement("div");

            card.className = "similar-card";

            card.innerHTML = `

                <img src="${image}" alt="${property.title}">

                <div class="similar-content">

                    <h3>${property.title}</h3>

                    <p>

                        <i class="fa-solid fa-location-dot"></i>

                        ${property.city}, ${property.state}

                    </p>

                    <h4>₹${property.price}/month</h4>

                    <button class="view-btn">

                        View Property

                    </button>

                </div>

            `;

            card

            .querySelector(".view-btn")

            .addEventListener("click",()=>{

                window.location.href =

                `properties.html?id=${property._id}`;

            });

            container.appendChild(card);

        });

    }

    catch(error){

        console.error(error);

    }

}

// =====================================================
// REVIEW PLACEHOLDER
// =====================================================

const reviewContainer = $("reviewContainer");

if(reviewContainer){

    reviewContainer.innerHTML = `

        <div class="review">

            <h4>⭐⭐⭐⭐⭐</h4>

            <p>

                Great accommodation with clean rooms,

                fast WiFi and friendly owner.

            </p>

            <small>

                — Campora Student

            </small>

        </div>

    `;

}

// =====================================================
// PAGE READY
// =====================================================

console.log("✅ Campora Property Page Loaded");