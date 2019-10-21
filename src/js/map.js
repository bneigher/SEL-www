import mapboxgl from "mapbox-gl";
// import "mapbox-gl/dist/mapbox-gl.css";

import schools from "../data/schools";

(() => {
  const features = schools.data.map(school => {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [school.location[0], school.location[1]]
      },
      properties: {
        title: school.name
      }
    };
  });

  const geojson = {
    type: "FeatureCollection",
    features: features
  };

  mapboxgl.accessToken =
    "pk.eyJ1IjoiYm5laWdoZXIiLCJhIjoiY2sxdmM3NGV3MHM0eDNobzh2cWxqNmJxbCJ9.H_d4j85_T9QkSci-cAoHsw";
  var map = new mapboxgl.Map({
    container: "map", // container id
    style: "mapbox://styles/mapbox/streets-v9",
    center: [-87.725830078125, 41.77950486590359], // starting position [lng, lat]
    zoom: 8 // starting zoom
  });
  map.on("load", event => {
    map.resize();
    map.addSource("schools", {
      type: "geojson",
      data: geojson
    });
    map.addLayer({
      id: "schools",
      type: "circle",
      source: "schools",
      // layout: {
      //   "icon-image": "{icon}-15",
      //   "text-field": "{title}",
      //   "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      //   "text-offset": [0, 0.6],
      //   "text-anchor": "top"
      // }
      paint: {
        "circle-radius": 8,
        "circle-color": "rgba(55,148,179,1)"
      }
    });
  });

  // disable map zoom when using scroll
  map.scrollZoom.disable();

  window.onresize = function() {
    setTimeout(function() {
      map.resize();
    }, 200);
  };

  map.on("click", "schools", function(e) {
    var coordinates = e.features[0].geometry.coordinates.slice();
    var title = e.features[0].properties.title;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(
        "<div style='background-color: #fff; width: 300px; height: 200px;'><h3>" +
          title +
          "</h3></div>"
      )
      .addTo(map);
  });

  // Change the cursor to a pointer when the mouse is over the places layer.
  map.on("mouseenter", "schools", function() {
    map.getCanvas().style.cursor = "pointer";
  });

  // Change it back to a pointer when it leaves.
  map.on("mouseleave", "schools", function() {
    map.getCanvas().style.cursor = "";
  });

  features.forEach(function(feature) {
    // create a HTML element for each feature
    var el = document.createElement("div");
    el.className = "marker";

    // make a marker for each feature and add to the map
    // new mapboxgl.Marker(el)
    //   .setLngLat(feature.geometry.coordinates)
    //   .setPopup(
    //     new mapboxgl.Popup({
    //       offset: 25
    //     }) // add popups
    //       .setHTML(
    //         "<div style='background-color: #fff; width: 300px; height: 200px;'><h3>" +
    //           feature.properties.title +
    //           "</h3></div>"
    //       )
    //   )
    //   .addTo(map);
  });
})();
