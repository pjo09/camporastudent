let map;
let marker;

function initMap() {

    const defaultLocation = {
        lat: 28.6139,
        lng: 77.2090
    };

    map = new google.maps.Map(document.getElementById("map"), {

        zoom: 12,

        center: defaultLocation

    });

    marker = new google.maps.Marker({

        position: defaultLocation,

        map,

        draggable: true

    });

    document.getElementById("latitude").value = defaultLocation.lat;
    document.getElementById("longitude").value = defaultLocation.lng;

    map.addListener("click", function (event) {

        marker.setPosition(event.latLng);

        document.getElementById("latitude").value = event.latLng.lat();

        document.getElementById("longitude").value = event.latLng.lng();

    });

}

window.initMap = initMap;