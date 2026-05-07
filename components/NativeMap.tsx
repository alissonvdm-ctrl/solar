import React, { forwardRef } from 'react';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import Colors from '@/constants/colors';

interface NativeMapProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onPress: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  showsUserLocation: boolean;
  selectedLocation: { latitude: number; longitude: number } | null;
}

export const NativeMapView = forwardRef<any, NativeMapProps>(
  ({ initialRegion, onPress, showsUserLocation, selectedLocation }, ref) => {
    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onPress={onPress as any}
        showsUserLocation={showsUserLocation}
        showsCompass={false}
        mapType="hybrid"
      >
        {selectedLocation && (
          <Marker coordinate={selectedLocation}>
            <View style={styles.markerOuter}>
              <View style={styles.markerInner} />
            </View>
          </Marker>
        )}
      </MapView>
    );
  }
);

const styles = StyleSheet.create({
  markerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(14, 165, 233, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export const MAP_AVAILABLE = true;
