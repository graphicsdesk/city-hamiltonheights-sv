const isMobile = window.innerWidth < 768;
const tooltip = d3.select("#tooltip");

import data from './data.json';

const map = L.map("map", { minZoom: 13, maxZoom: 16, scrollWheelZoom: !isMobile, zoomControl: !isMobile }).setView([40.82, -73.96], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

var pinIcon = L.divIcon({
    html: `
    <svg width="34" height="34" viewBox="0 0 24 24">
      <defs>
        <filter id="outerShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="2" flood-color="#00000055"/>
        </filter>

        <filter id="insetShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feOffset dx="0" dy="0"/>
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="arithmetic"
            k2="-1" k3="1"/>
          <feFlood flood-color="#00000033" result="color"/>
          <feComposite in="color" in2="SourceGraphic" operator="in" result="shadow"/>
          <feComposite in="shadow" in2="SourceGraphic" operator="over"/>
        </filter>
      </defs>

      <g filter="url(#outerShadow)">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill="#B9D9EB"
          stroke="#1D4F91"
          stroke-width="1.2"
          filter="url(#insetShadow)"
        />
        <circle cx="12" cy="9" r="2.5" fill="#1D4F91"/>
      </g>
    </svg>
  `,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 6],
});

const morningsideMarker = L.marker([40.80785, -73.9623], { icon: pinIcon }).addTo(map);
morningsideMarker.bindPopup("<b>Columbia&rsquo;s Morningside campus</b>");

const manhattanvilleMarker = L.marker([40.8179, -73.9564], { icon: pinIcon }).addTo(map);
manhattanvilleMarker.bindPopup("<b>Columbia&rsquo;s Manhattanville campus</b>");

const cuimcMarker = L.marker([40.8417, -73.9415], { icon: pinIcon }).addTo(map);
cuimcMarker.bindPopup("<b>Columbia University Irving Medical Center</b>");

map.dragging.disable();

function featuresAtLatLng(latlng, features) {
    const point = [latlng.lng, latlng.lat];
    return features.filter((f) => d3.geoContains(f, point));
}

function updateTooltip(lines, x, y) {
    const html = lines.map((line) => `<div style="padding: 4px 8px; margin: 0; background:${line.bg}; color:${line.color};">${line.text}</div>`).join("");
    tooltip.html(html).style("background", "transparent").style("position", "fixed").style("display", "block");

    const tooltipNode = tooltip.node();
    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;

    let clampedX = x;
    let clampedY = y;

    if (x + tooltipWidth + 10 > window.innerWidth) clampedX = x - tooltipWidth - 10;
    if (y + tooltipHeight + 10 > window.innerHeight) clampedY = y - tooltipHeight - 10;
    if (clampedX < 0) clampedX = 0;
    if (clampedY < 0) clampedY = 0;

    tooltip.style("left", clampedX + "px").style("top", clampedY + "px");
}

function hideTooltip() {
    tooltip.style("display", "none");
}

(async function () {
    try {
        const svgLayer = L.svg();
        svgLayer.addTo(map);

        const svg = d3.select(map.getPanes().overlayPane).select("svg");
        svg.attr("pointer-events", "none");
        const g = svg.append("g").attr("class", "d3-overlay");

        drawOverlay();

        map.on("mousemove", function (e) {
            const neighborhoods = data.features.filter((d) => d.properties.BoroCode === 1);
            const district = data.features.filter((d) => d.properties.CounDist === 7);

            const hitsA = featuresAtLatLng(e.latlng, neighborhoods);
            const hitsB = featuresAtLatLng(e.latlng, district);

            const lines = [];

            hitsB.forEach((f) => {
                lines.push({
                    text: "City Council District 7",
                    bg: "#003865",
                    color: "white",
                });
            });

            hitsA.forEach((f) => {
                lines.push({
                    text: f.properties.NTAName,
                    bg: "white",
                    color: f.properties.fill || "black",
                });

                g.selectAll("path.area")
                    .filter((d) => d === f)
                    .attr("fill-opacity", (d) => d.properties.opacity || 0.8);
            });

            if (lines.length > 0) {
                updateTooltip(lines, e.originalEvent.clientX + 10, e.originalEvent.clientY - 28);
            } else {
                hideTooltip();
            }
        });

        map.on('mouseout', function(e) {
            hideTooltip();
        });

        map.on("moveend", drawOverlay);

        function drawOverlay() {
            g.selectAll("*").remove();

            const transform = d3.geoTransform({
                point: function (x, y) {
                    const point = map.latLngToLayerPoint(new L.LatLng(y, x));
                    this.stream.point(point.x, point.y);
                },
            });

            const path = d3.geoPath().projection(transform);

            const neighborhoods = data.features.filter((d) => d.properties.BoroCode === 1);

            g.selectAll("path.neighborhoods")
                .data(neighborhoods)
                .enter()
                .append("path")
                .attr("class", "area")
                .attr("d", path)
                .attr("stroke", "#000")
                .attr("fill", (d) => d.properties.fill || "#ccc")
                .attr("fill-opacity", (d) => d.properties.opacity || 0.5)
                .style("pointer-events", "all")
                .style("cursor", "pointer")
                .on("mouseout", function () {
                    d3.selectAll("path.area").attr("fill-opacity", (d) => d.properties.opacity || 0.5);
                });

            const district = data.features.filter((d) => d.properties.CounDist === 7);

            g.selectAll("path.district").data(district).enter().append("path").attr("class", "highlight").attr("d", path).attr("fill", "#003865").attr("fill-opacity", 0.4).style("pointer-events", "all").style("cursor", "pointer");
        }
    } catch (err) {
        console.error("Error loading GeoJSON:", err);
    }
})();
