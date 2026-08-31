import React, { useEffect, useRef, useState, useCallback, memo } from "react";
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
      attributionControl: true,
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2m15_1_93d4e86d2df587037df92b7e", {
      subdomains: "abcd",
      maxZoom: 19,
      detectRetina: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
      crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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

const FREE_PAGES = 9;

function PdfViewer({ url, onClose }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.6 });

          const wrapper = document.createElement("div");
          wrapper.className = "pdf-page-wrapper" + (i > FREE_PAGES ? " pdf-page--locked" : "");

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          canvas.style.width = "100%";

          wrapper.appendChild(canvas);

          if (i > FREE_PAGES) {
            const veil = document.createElement("div");
            veil.className = "pdf-veil";
            if (i === FREE_PAGES + 1) {
              veil.innerHTML = `<span>Contacter Studio Giraud<br/><a href="mailto:contact@studiogiraud.com">contact@studiogiraud.com</a></span>`;
            }
            wrapper.appendChild(veil);
          }

          containerRef.current?.appendChild(wrapper);

          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
        if (!cancelled) {
          const endCard = document.createElement("div");
          endCard.className = "pdf-end-card";
          endCard.innerHTML = `
            <p class="pdf-end-card__label">Extrait — ${pdf.numPages > 9 ? pdf.numPages + ' pages au total' : 'document complet disponible sur demande'}</p>
            <p class="pdf-end-card__cta">Pour accéder au dossier complet,<br/>contactez <a href="mailto:contact@studiogiraud.com">contact@studiogiraud.com</a></p>
          `;
          containerRef.current?.appendChild(endCard);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pdf-modal" onClick={onClose}>
      <div className="pdf-modal__inner" onClick={(e) => e.stopPropagation()}>
        <button className="pdf-modal__close" onClick={onClose}>✕</button>
        {loading && !error && <div className="pdf-modal__loading">Chargement…</div>}
        {error && <div className="pdf-modal__loading">Erreur de chargement</div>}
        <div ref={containerRef} className="pdf-modal__pages" />
      </div>
    </div>
  );
}

function ProjectOverlay({ project, onClose }) {
  const [imgError, setImgError] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => { setImgError(false); setPdfOpen(false); }, [project]);

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
        {project.pdf_url && (
          <div className="overlay__pdf">
            <button
              onClick={(e) => { e.stopPropagation(); setPdfOpen(true); }}
            >
              Voir le document
            </button>
          </div>
        )}
        {pdfOpen && (
          <PdfViewer url={project.pdf_url} onClose={() => setPdfOpen(false)} />
        )}
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
        .select("id,title_clean,address_clean,city,lat,lng,cover_file,pdf_url,type")
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

      {projects.length >= 300 && (
        <div className="project-counter">{projects.length} projets</div>
      )}

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
