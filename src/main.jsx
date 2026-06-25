import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const supabase = createClient(
  "https://xrnivajbifzjlwpeuisv.supabase.co",
  "sb_publishable_V4qGbrBqw1Dsda_MDfRYpA_g64pktKq"
);

const typeColors = {
  office: "#FFFD52",
  retail: "#f4e8c8",
  hotel: "#d89a1c",
  residential: "#b99a43",
  mixed_use: "#a88f45",
  logistics: "#8f7b3a",
};

function AtlasMap({ projects, active, setActive, filter }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
      center: [48.865, 2.315],
      zoom: 12,
      minZoom: 4,
      maxZoom: 18,
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 520,
      wheelDebounceTime: 120,
      zoomSnap: 1,
      zoomDelta: 1,
      zoomAnimation: false,
      markerZoomAnimation: false,
      fadeAnimation: false,
      inertia: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      detectRetina: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
      crossOrigin: true,
    }).addTo(map);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);

    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    projects
      .filter((p) => filter === "all" || p.type === filter)
      .forEach((p) => {
        const isActive = active?.id === p.id;
        const color = typeColors[p.type] || "#FFFD52";

        const marker = L.circleMarker([p.lat, p.lng], {
          radius: isActive ? 9 : 6,
          stroke: false,
          fillColor: color,
          fillOpacity: isActive ? 1 : 0.9,
          interactive: true,
        });

        marker.bindTooltip(p.title_clean, {
          direction: "right",
          offset: [12, 0],
          opacity: 0.95,
          className: "atlas-tooltip",
        });

        marker.on("click", () => {
          setActive(p);
          map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 14), {
            animate: true,
            duration: 0.45,
          });
        });

        marker.addTo(layer);
      });
  }, [projects, active, filter, setActive]);

  return <div ref={mapEl} className="map" />;
}

function ProjectPanel({ project }) {
  if (!project) return null;

  return (
    <aside className="panel">
      <div className="coverBox">
        <img
          src={`/covers/${project.cover_file}`}
          alt={project.title_clean}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement.classList.add("missing-cover");
          }}
        />
        <div className="missingText">
          Cover à ajouter
          <br />
          {project.cover_file}
        </div>
      </div>

      <div className="meta">{project.city || ""}</div>
      <h2>{project.title_clean}</h2>
      <p>{project.address_clean || ""}</p>
      <div className="tag">{project.type}</div>
    </aside>
  );
}

function App() {
  const [projects, setProjects] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("display_on_map", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("title_clean", { ascending: true });

      if (error) {
        console.error("Supabase error:", error);
        return;
      }

      setProjects(data || []);
      setActive((data && data[0]) || null);
    }

    loadProjects();
  }, []);

  const filters = [
    "all",
    ...Array.from(new Set(projects.map((p) => p.type).filter(Boolean))),
  ];

  return (
    <main>
      <AtlasMap
        projects={projects}
        active={active}
        setActive={setActive}
        filter={filter}
      />

      <header className="title">
        <div>STUDIO GIRAUD</div>
        <h1>Grand atlas des projets</h1>
      </header>

      <nav className="filters">
        {filters.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={filter === item ? "active" : ""}
          >
            {item}
          </button>
        ))}
      </nav>

      <ProjectPanel project={active} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);