import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProperty {
  home_id: string;
  property_name: string;
  health_score: number;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  properties: MapProperty[];
  onPropertyClick?: (homeId: string) => void;
}

const healthColor = (score: number) => {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
};

export function PropertyMap({ properties, onPropertyClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
    }

    const map = L.map(mapRef.current).setView([38.85, -104.82], 11);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    const validProps = properties.filter(p => p.latitude && p.longitude);

    // Cluster-like approach: just use circle markers with health color
    validProps.forEach(p => {
      const color = healthColor(p.health_score);
      const marker = L.circleMarker([p.latitude!, p.longitude!], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.85,
      }).addTo(map);

      marker.bindTooltip(
        `<strong>${p.property_name}</strong><br/>Health: ${p.health_score}/100`,
        { direction: 'top', offset: [0, -10] }
      );

      if (onPropertyClick) {
        marker.on('click', () => onPropertyClick(p.home_id));
      }
    });

    if (validProps.length > 0) {
      const bounds = L.latLngBounds(validProps.map(p => [p.latitude!, p.longitude!] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [properties, onPropertyClick]);

  return (
    <div ref={mapRef} className="w-full h-[500px] rounded-lg border border-border" />
  );
}
