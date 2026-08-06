async function loadFeaturedProperties(){

try{

const response=await fetch(`${API}/properties?featured=true&limit=6`);

const data=await response.json();

const grid=document.getElementById("featuredPropertyGrid");

grid.innerHTML="";

if(!data.success){

grid.innerHTML="<h3>No Properties Found</h3>";

return;

}

data.properties.forEach(property=>{

const card=document.createElement("div");

card.className="property-card";

card.innerHTML=`

<img src="${property.images?.[0] || "./assets/images/property-placeholder.jpg"}">

<div class="property-content">

<div class="property-location">

📍 ${property.city}

</div>

<div class="property-title">

${property.title}

</div>

<div class="property-price">

₹${property.price}/month

</div>

<div class="property-footer">

<span class="property-rating">

⭐ ${property.rating || "4.8"}

</span>

<a href="/pages/property/property.html?id=${property._id}"

class="property-btn">

View

</a>

</div>

</div>

`;

grid.appendChild(card);

});

}catch(err){

console.log(err);

}

}

loadFeaturedProperties();
document.querySelectorAll(".faq-question").forEach(button=>{

button.onclick=()=>{

const answer=button.nextElementSibling;

const isOpen=answer.style.display==="block";

document.querySelectorAll(".faq-answer").forEach(a=>a.style.display="none");

answer.style.display=isOpen?"none":"block";

};

});
document.getElementById("contactForm").addEventListener("submit",async(e)=>{

e.preventDefault();

const body={

name:document.getElementById("name").value,

email:document.getElementById("email").value,

subject:document.getElementById("subject").value,

message:document.getElementById("message").value

};

const res=await fetch(`${API}/contact`,{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify(body)

});

const data=await res.json();

if(data.success){

alert("Message sent successfully.");

e.target.reset();

}else{

alert(data.message);

}

});
const counters = document.querySelectorAll(".stat-number");

const observer = new IntersectionObserver(entries => {

entries.forEach(entry => {

if (!entry.isIntersecting) return;

const counter = entry.target;
const target = counter.dataset.count;

if (target.includes(".")) return;

let count = 0;

const speed = target / 80;

const update = () => {

count += speed;

if (count < target) {

counter.textContent = Math.floor(count).toLocaleString();

requestAnimationFrame(update);

} else {

counter.textContent = Number(target).toLocaleString() + "+";

}

};

update();

observer.unobserve(counter);

});

});

counters.forEach(counter => observer.observe(counter));
/*==================================
PREMIUM FAQ
==================================*/

const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach(item=>{

const button=item.querySelector(".faq-question");

button.addEventListener("click",()=>{

faqItems.forEach(f=>{

if(f!==item){

f.classList.remove("active");

}

});

item.classList.toggle("active");

});

});
/*=========================================
3D CARD EFFECT
=========================================*/

document.querySelectorAll(

".feature-card,.property-card,.testimonial-card"

).forEach(card=>{

card.addEventListener("mousemove",e=>{

const rect=card.getBoundingClientRect();

const x=e.clientX-rect.left;

const y=e.clientY-rect.top;

const rotateX=-(y-rect.height/2)/18;

const rotateY=(x-rect.width/2)/18;

card.style.transform=

`perspective(900px)

rotateX(${rotateX}deg)

rotateY(${rotateY}deg)

translateY(-8px)`;

});

card.addEventListener("mouseleave",()=>{

card.style.transform="";

});

});
async function loadFeaturedProperties(){

    try{

        const response = await fetch("/api/properties?featured=true");

        const properties = await response.json();

        const container = document.getElementById("featuredProperties");

        container.innerHTML = "";

        properties.slice(0,6).forEach(property=>{

            container.innerHTML += `

            <div class="property-card reveal">

                <img src="${property.images[0]}" alt="${property.title}">

                <div class="property-content">

                    <div class="property-location">

                        📍 ${property.city}

                    </div>

                    <h3>${property.title}</h3>

                    <div class="property-price">

                        ₹${property.price}/month

                    </div>

                    <div class="property-footer">

                        <span>⭐ ${property.rating || "New"}</span>

                        <a href="property.html?id=${property._id}" class="property-btn">

                            View

                        </a>

                    </div>

                </div>

            </div>

            `;

        });

    }

    catch(err){

        console.error(err);

    }

}

loadFeaturedProperties();
async function loadStats(){

    const res = await fetch("/api/stats");

    const stats = await res.json();

    document.getElementById("studentCount").innerText = stats.students;

    document.getElementById("propertyCount").innerText = stats.properties;

    document.getElementById("ownerCount").innerText = stats.owners;

    document.getElementById("cityCount").innerText = stats.cities;

}

loadStats();
document.getElementById("searchForm").onsubmit=(e)=>{

e.preventDefault();

const city=document.getElementById("city").value;

const type=document.getElementById("type").value;

window.location=

`properties.html?city=${city}&type=${type}`;

}
contactForm.addEventListener("submit",async e=>{

e.preventDefault();

const form=new FormData(contactForm);

const body=Object.fromEntries(form);

const res=await fetch("/api/contact",{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify(body)

});

if(res.ok){

alert("Message Sent");

contactForm.reset();

}

});
async function loadUniversities(){

    try{

        const response = await fetch("/api/universities");

        const universities = await response.json();

        const grid =
            document.getElementById("universityGrid");

        grid.innerHTML="";

        universities.forEach(university=>{

            grid.innerHTML += `

            <div class="university-card">

                <img
                src="${university.image}"
                alt="${university.name}">

                <div class="overlay"></div>

                <div class="content">

                    <h3>${university.name}</h3>

                    <p>${university.city}</p>

                    <span>${university.properties} Properties</span>

                </div>

            </div>

            `;

        });

    }

    catch(error){

        console.error(error);

    }

}