import React, { useEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const supabase = createClient(
  "https://xrnivajbifzjlwpeuisv.supabase.co",
  "sb_publishable_V4qGbrBqw1Dsda_MDfRYpA_g64pktKq"
);


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

        const isMobile = window.innerWidth < 768;
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: isActive ? 10 : (isMobile ? 9 : 6),
          stroke: false,
          fillColor: "#FFFD52",
          fillOpacity: isActive ? 1 : 0.9,
          interactive: true,
        });

        if (!isMobile) {
          marker.bindTooltip(p.title_clean, {
            direction: "right",
            offset: [12, 0],
            opacity: 0.95,
            className: "atlas-tooltip",
          });
        }

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

function ProjectOverlay({ project, onClose }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [project]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay__card">
        {!imgError ? (
          <img
            className="overlay__img"
            src={`/covers/${project.cover_file}`}
            alt={project.title_clean}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="overlay__missing">Cover à ajouter</div>
        )}

        <div className="overlay__caption">
          <span className="overlay__title">{project.title_clean}</span>
          <div className="overlay__caption-right">
            {project.address_clean && <span className="overlay__address">{project.address_clean}</span>}
            {project.city && <span className="overlay__city">{project.city}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [projects, setProjects] = useState([]);
  const [active, setActive] = useState(null);
  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("display_on_map", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("title_clean", { ascending: true });

      if (error) { console.error("Supabase error:", error); return; }
      setProjects(data || []);
    }
    loadProjects();
  }, []);

  const navigate = useCallback((dir) => {
    if (!active || projects.length === 0) return;
    const idx = projects.findIndex((p) => p.id === active.id);
    const next = projects[(idx + dir + projects.length) % projects.length];
    setActive(next);
  }, [active, projects]);

  return (
    <main className={active ? "has-overlay" : ""}>
      <AtlasMap
        projects={projects}
        active={active}
        setActive={setActive}
        filter="all"
      />

      <header className="title">
        <div>STUDIO GIRAUD</div>
        <h1>Grand atlas des projets</h1>
      </header>

      <footer className="contact">
        <a href="https://studiogiraud.com" target="_blank" rel="noreferrer">studiogiraud.com</a>
        <span>·</span>
        <a href="mailto:contact@studiogiraud.com">contact@studiogiraud.com</a>
        <span>·</span>
        <a href="tel:+33622580445">+33 6 22 58 04 45</a>
      </footer>

      {active && (
        <ProjectOverlay
          project={active}
          onClose={() => setActive(null)}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
