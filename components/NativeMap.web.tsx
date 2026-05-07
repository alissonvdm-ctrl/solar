import React, { forwardRef } from 'react';

interface NativeMapProps {
  initialRegion: any;
  onPress: any;
  showsUserLocation: boolean;
  selectedLocation: { latitude: number; longitude: number } | null;
}

export const NativeMapView = forwardRef<any, NativeMapProps>(() => null);

export const MAP_AVAILABLE = false;
