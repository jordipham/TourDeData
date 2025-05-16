// Import Mapbox as an ESM module
import mapboxgl from "https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm";
// Import D3
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Check that Mapbox GL JS is loaded
console.log("Mapbox GL JS Loaded:", mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken =
  "pk.eyJ1Ijoiam9yZGlwaGFtIiwiYSI6ImNtYXB2NXUwMTAydzAya3B1N2N5dXpwZHcifQ.oxgdaI-UtftkxIn-p32hAQ";

// Initialize the map
const map = new mapboxgl.Map({
  container: "map", // ID of the div where the map will render
  style: "mapbox://styles/mapbox/streets-v12", // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

map.on("load", async () => {
  // Add the data source
  map.addSource("boston_route", {
    type: "geojson",
    data: "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson",
  });

  // Add the layer to visualize the data
  map.addLayer({
    id: "bike-lanes",
    type: "line",
    source: "boston_route",
    paint: {
      "line-color": "#32D400", // control color of lines on the map
      "line-width": 3, // control line width
      "line-opacity": 0.4, // control transparency
    },
  });

  // Adding data source for bike routes in Cambridge
  map.addSource("cambridge_route", {
    type: "geojson",
    data: "https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson",
  });

  // Adding layer to visualize the Cambridge data
  map.addLayer({
    id: "cambridge-bike-lanes",
    type: "line",
    source: "cambridge_route",
    paint: {
      "line-color": "#32D400", // control color of lines on the map
      "line-width": 3, // control line width
      "line-opacity": 0.4, // control transparency
    },
  });

  // fetch and parse csv
  let jsonData;
  try {
    const jsonurl =
      "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";

    // Await JSON fetch
    const jsonData = await d3.json(jsonurl);

    console.log("Loaded JSON Data:", jsonData); // Log to verify structure

    if (jsonData && jsonData.data && jsonData.data.stations) {
      // grabbing stations
      let stations = jsonData.data.stations;
      console.log("Stations Array:", stations);

      // create SVG container and load in station markers
      const svg = d3
        .select("#map")
        .append("svg");

      console.log("SVG overlay created.");

      function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point); // Project to pixel coordinates
        return { cx: x, cy: y }; // Return as object for use in SVG attributes
      }

      // Append circles to the SVG for each station
      const circles = svg
        .selectAll("circle")
        .data(stations)
        .enter()
        .append("circle")
        .attr("r", 5) // Radius of the circle
        .attr("fill", "steelblue") // Circle fill color
        .attr("stroke", "white") // Circle border color
        .attr("stroke-width", 1.1) // Circle border thickness
        .attr("opacity", 1.0); // Circle opacity

      // Function to update circle positions when the map moves/zooms
      function updatePositions() {
        circles
          .attr("cx", (d) => getCoords(d).cx) // Set the x-position using projected coordinates
          .attr("cy", (d) => getCoords(d).cy); // Set the y-position using projected coordinates
      }

      // Initial position update when map loads
      updatePositions();

      // Reposition markers on map interactions
      map.on("move", updatePositions); // Update during map movement
      map.on("zoom", updatePositions); // Update during zooming
      map.on("resize", updatePositions); // Update on window resize
      map.on("moveend", updatePositions); // Final adjustment after movement ends
    } else {
      console.error("Data structure not as expected:", jsonData);
    }
  } catch (error) {
    console.error("Error loading JSON:", error); // Handle errors
  }
});
