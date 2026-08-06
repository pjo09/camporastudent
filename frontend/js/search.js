const btn = document.getElementById("searchBtn");

btn.addEventListener("click", () => {

    const state = document.getElementById("searchState").value;

    const city = document.getElementById("searchCity").value;

    const college = document.getElementById("searchCollege").value;

    const minRent = document.getElementById("minRent").value;

    const maxRent = document.getElementById("maxRent").value;

    const query = new URLSearchParams({

        state,

        city,

        college,

        minRent,

        maxRent

    });

    window.location.href =
        "properties.html?" + query.toString();

});