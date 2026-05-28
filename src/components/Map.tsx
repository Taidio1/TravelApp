import React, { useEffect, useRef, useState } from 'react';
import { loader, mapOptions } from '../lib/google-maps';

interface MapProps {
  onMapClick?: (lat: number, lng: number) => void;
  places?: any[];
}

const Map: React.FC<MapProps> = ({ onMapClick, places = [] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    loader.load().then(() => {
      if (mapRef.current && !map) {
        const newMap = new google.maps.Map(mapRef.current, mapOptions);
        
        newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng && onMapClick) {
            onMapClick(e.latLng.lat(), e.latLng.lng());
          }
        });

        setMap(newMap);
      }
    });
  }, [onMapClick, map]);

  useEffect(() => {
    if (map && places) {
      // Clear existing markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Add new markers
      places.forEach(place => {
        const marker = new google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map: map,
          title: place.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#FF8C00',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 8
          }
        });
        markersRef.current.push(marker);
      });
    }
  }, [map, places]);

  return (
    <div className="w-full h-full rounded-[24px] overflow-hidden shadow-neu-flat">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default Map;
