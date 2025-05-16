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

// Global variable to store the time filter
let timeFilter = -1; // Initialize to -1 for "any time"

// Global helper function to format time
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
  return date.toLocaleString("en-US", { timeStyle: "short" }); // Format as HH:MM AM/PM
}

// Global function to compute station traffic
function computeStationTraffic(stations, trips) {
  // Compute departures
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // Compute arrivals
  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Update each station
  return stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

// Helper function to get minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Helper function to filter trips by time
function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips // If no filter is applied (-1), return all trips
    : trips.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);

        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

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
      "line-color": "#06402B", // control color of lines on the map
      "line-width": 2.5, // control line width
      "line-opacity": 0.6, // control transparency
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
      "line-color": "#06402B", // control color of lines on the map
      "line-width": 2.5, // control line width
      "line-opacity": 0.6, // control transparency
    },
  });

  // fetch and parse csv
  let jsonData;
  try {
    const jsonurl =
      "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";

    // Await JSON fetch
    jsonData = await d3.json(jsonurl);

    // console.log("Loaded JSON Data:", jsonData); // Log to verify structure

    if (jsonData && jsonData.data && jsonData.data.stations) {
      // grabbing stations
      let stations = jsonData.data.stations;
      // console.log("Stations Array:", stations);

      // create SVG container and load in station markers
      const svg = d3.select("#map").append("svg");

      console.log("SVG overlay created.");

      function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point); // Project to pixel coordinates
        return { cx: x, cy: y }; // Return as object for use in SVG attributes
      }

      // parsing csv data for traffic flow calculation
      let trips;
      try {
        const trafficUrl =
          "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";

        // store and log for verification
        trips = await d3.csv(trafficUrl, (trip) => {
          trip.started_at = new Date(trip.started_at);
          trip.ended_at = new Date(trip.ended_at);
          return trip;
        });
        // console.log("Bluebikes traffic data fetched successfully:", trips);
        // console.log("Number of trips loaded:", trips.length);

        // calculate the traffic at each station
        // const departures = d3.rollup(
        //   trips,
        //   (v) => v.length,
        //   (d) => d.start_station_id
        // );
        // const arrivals = d3.rollup(
        //   trips,
        //   (v) => v.length,
        //   (d) => d.end_station_id
        // );
        // stations = stations.map((station) => {
        //   let id = station.short_name;
        //   station.arrivals = arrivals.get(id) ?? 0;
        //   station.departures = departures.get(id) ?? 0;
        //   station.totalTraffic = station.arrivals + station.departures;
        //   return station;
        // });

        // Replace the previous stations variable with the result of computeStationTraffic
        stations = computeStationTraffic(jsonData.data.stations, trips);

        // console.log("Stations with traffic data:", stations);
      } catch (error) {
        console.error("Error loading traffic data:", error);
        trips = []; // Initialize trips to an empty array in case of error
      }

      // **1. Create the quantize scale**
      let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

      // size markers by traffic
      const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);

      // Append circles to the SVG for each station
      const circles = svg
        .selectAll("circle")
        .data(stations, (d) => d.short_name) // Use station short_name as the key
        .enter()
        .append("circle")
        .attr("r", (d) => radiusScale(d.totalTraffic)) // Radius of the circle
        .attr("fill", "steelblue") // Circle fill color - REMOVED: Now handled by CSS
        .attr("stroke", "white") // Circle border color
        .attr("stroke-width", 1.1) // Circle border thickness
        .attr("opacity", 1.0) // Circle opacity
        .each(function (d) {
          // Add <title> for browser tooltips
          d3.select(this)
            .append("title")
            .text(
              `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
            );
        })
        .style("--departure-ratio", (d) =>
          stationFlow(d.departures / d.totalTraffic)
        );

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

      // Select the slider and display elements
      const timeSlider = document.getElementById("time-slider");
      const selectedTime = document.getElementById("selected-time");
      const anyTimeLabel = document.getElementById("any-time");

      // Function to update the scatterplot
      function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter
        const filteredTrips = filterTripsbyTime(trips, timeFilter);

        // Recompute station traffic based on the filtered trips
        const filteredStations = computeStationTraffic(stations, filteredTrips);

        // Adjust the radiusScale range based on timeFilter
        timeFilter === -1
          ? radiusScale.range([0, 25])
          : radiusScale.range([3, 50]);

        // Update the scatterplot by adjusting the radius of circles
        circles
          .data(filteredStations, (d) => d.short_name) // Ensure D3 tracks elements correctly
          .join("circle") // Ensure the data is bound correctly
          .attr("r", (d) => radiusScale(d.totalTraffic)) // Update circle sizes

          // **3. Update --departure-ratio in updateScatterPlot**
          .style("--departure-ratio", (d) =>
            stationFlow(d.departures / d.totalTraffic)
          );
      }

      // Function to update the UI when the slider moves
      function updateTimeDisplay() {
        timeFilter = Number(timeSlider.value); // Get slider value

        if (timeFilter === -1) {
          selectedTime.textContent = ""; // Clear time display
          anyTimeLabel.style.display = "block"; // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter); // Display formatted time
          anyTimeLabel.style.display = "none"; // Hide "(any time)"
        }

        // Call updateScatterPlot to reflect the changes on the map
        updateScatterPlot(timeFilter);
      }

      // Bind the slider's input event to our function
      timeSlider.addEventListener("input", updateTimeDisplay);
      updateTimeDisplay(); // Initial update
    } else {
      console.error("Data structure not as expected:", jsonData);
    }
  } catch (error) {
    console.error("Error loading JSON:", error); // Handle errors
  }
});
