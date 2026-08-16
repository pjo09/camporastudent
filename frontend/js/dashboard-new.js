const propertyGrid = document.getElementById("propertyGrid");

const demoProperties = [

{
title:"Sunrise Residency",
location:"VIT Vellore",
price:"₹9,500",
image:"/assets/images/property-placeholder.jpg"
},

{
title:"Urban Nest",
location:"Manipal University",
price:"₹12,000",
image:"/assets/images/property-placeholder.jpg"
},

{
title:"Campus Stay",
location:"SRM Chennai",
price:"₹8,500",
image:"/assets/images/property-placeholder.jpg"
}

];

propertyGrid.innerHTML = demoProperties.map(p=>`

<div class="property-card">

<div class="property-image">

<img src="${p.image}">

<span class="property-badge">Verified</span>

<button class="favorite-btn">

<i class="fa-solid fa-heart"></i>

</button>

</div>

<div class="property-body">

<div class="property-title">${p.title}</div>

<div class="property-location">

<i class="fa-solid fa-location-dot"></i>

${p.location}

</div>

<div class="property-features">

<span>🛏 Furnished</span>

<span>📶 WiFi</span>

<span>🍽 Food</span>

</div>

<div class="property-price">

<div class="price">${p.price}</div>

<button class="book-btn">

View

</button>

</div>

</div>

</div>

`).join("");
/* ============================
Bookings
============================ */

const bookings = [

{
title:"Sunrise Residency",
date:"Move in : 25 July"
},

{
title:"Campus Stay",
date:"Visit : Tomorrow"
}

];

document.getElementById("bookingList").innerHTML = bookings.map(b=>`

<div class="booking-item">

<div>

<div class="booking-title">${b.title}</div>

<div class="booking-date">${b.date}</div>

</div>

<div class="booking-status">

Confirmed

</div>

</div>

`).join("");

/* ============================
Notifications
============================ */

const notifications=[

"Your booking has been confirmed.",

"New PG available near your university.",

"Owner replied to your message."

];

document.getElementById("notificationList").innerHTML=

notifications.map(n=>`

<div class="notification">

<div class="notification-icon">

<i class="fa-solid fa-bell"></i>

</div>

<div>

<h4>Campora</h4>

<p>${n}</p>

</div>

</div>

`).join("");

/* ============================
Universities
============================ */

const universities=[

"Delhi University",

"VIT Vellore",

"Manipal University"

];

document.getElementById("universityGrid").innerHTML=

universities.map(u=>`

<div class="university-card">

<h3>${u}</h3>

<p>Verified student accommodation nearby.</p>

<button class="explore-btn">

Explore

</button>

</div>

`).join("");
const activity=[

{
icon:"fa-heart",
title:"Saved Sunrise Residency",
desc:"Added to wishlist",
time:"2 min ago"
},

{
icon:"fa-calendar-check",
title:"Booking Confirmed",
desc:"Urban Nest",
time:"1 hour ago"
},

{
icon:"fa-comments",
title:"Owner Replied",
desc:"New Message",
time:"Yesterday"
}

];

document.getElementById("activityList").innerHTML=

activity.map(a=>`

<div class="activity-card">

<div class="activity-icon">

<i class="fa-solid ${a.icon}"></i>

</div>

<div>

<h3>${a.title}</h3>

<p>${a.desc}</p>

</div>

<div class="activity-time">

${a.time}

</div>

</div>

`).join("");
const ctx = document.getElementById('dashboardChart');
if (ctx) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Saved Properties',
        data: [1, 2, 4, 3, 6, 8],
        borderWidth: 2,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8'
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8'
          }
        }
      }
    }
  });
}
