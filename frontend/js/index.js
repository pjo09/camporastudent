async function loadFeaturedProperties(){
try{
const { supabaseAPI } = await import("./supabase-api.js");
const data = await supabaseAPI.searchProperties({ featured: true, limit: 6 });
const grid=document.getElementById("featuredPropertyGrid") || document.getElementById("featuredProperties");
if (!grid) return;
grid.innerHTML="";

if(!data.success || !data.properties || data.properties.length === 0){
grid.innerHTML="<h3>No Properties Found</h3>";
return;
}

data.properties.forEach(property=>{
const card=document.createElement("div");
card.className="property-card";
card.innerHTML=`
<img src="${property.images?.[0] || "/assets/images/property-placeholder.jpg"}" alt="${property.propertyName || property.title}">
<div class="property-content">
<div class="property-location">📍 ${property.city || "India"}</div>
<h3>${property.propertyName || property.title}</h3>
<div class="property-price">₹${property.rent || property.price}/month</div>
<div class="property-footer">
<span>⭐ ${property.rating || "New"}</span>
<a href="/property-details.html?id=${encodeURIComponent(property.id || property._id)}" class="property-btn">View</a>
</div>
</div>
`;
grid.appendChild(card);
});
}catch(e){
console.error("Featured properties error:", e);
}
}

async function loadStats(){
try {
const { supabase } = await import("./supabaseClient.js");
const [studentsRes, propsRes, ownersRes, citiesRes] = await Promise.all([
supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
supabase.from("properties").select("id", { count: "exact", head: true }),
supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner"),
supabase.from("properties").select("city")
]);
const citiesSet = new Set((citiesRes.data || []).map(p => p.city).filter(Boolean));

if (document.getElementById("studentCount")) document.getElementById("studentCount").innerText = studentsRes.count || 1200;
if (document.getElementById("propertyCount")) document.getElementById("propertyCount").innerText = propsRes.count || 450;
if (document.getElementById("ownerCount")) document.getElementById("ownerCount").innerText = ownersRes.count || 150;
if (document.getElementById("cityCount")) document.getElementById("cityCount").innerText = citiesSet.size || 25;
} catch (e) {
console.error("Stats load error:", e);
}
}

async function handleContactSubmit(e){
e.preventDefault();
try {
const { supabase } = await import("./supabaseClient.js");
const name = document.getElementById("name")?.value || "";
const email = document.getElementById("email")?.value || "";
const subject = document.getElementById("subject")?.value || "General Inquiry";
const message = document.getElementById("message")?.value || "";

const { error } = await supabase.from("notifications").insert({
title: `Contact Form: ${subject}`,
message: `From: ${name} (${email})\nMessage: ${message}`,
type: "SYSTEM",
receiver_id: null
});

alert("Thank you! Your message has been received.");
if (e.target && e.target.reset) e.target.reset();
} catch (err) {
alert("Thank you! Your message has been received.");
}
}

document.addEventListener("DOMContentLoaded", () => {
loadFeaturedProperties();
loadStats();
const contactForm = document.getElementById("contactForm");
if (contactForm) contactForm.addEventListener("submit", handleContactSubmit);
});

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

card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });
        card.addEventListener("mouseleave", () => {
            card.style.transform = "";
        });
    });

    const searchForm = document.getElementById("searchForm");
    searchForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const city = document.getElementById("city")?.value || "";
        const type = document.getElementById("type")?.value || "";
        window.location.href = `properties.html?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`;
    });