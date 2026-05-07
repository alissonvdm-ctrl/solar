import React, { useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import type { BuildingConfig, PanelPosition, SolarApiData } from '@/lib/types';
import { PANEL_WIDTH, PANEL_HEIGHT, PANEL_GAP } from '@/lib/types';
import { getMaxPanelGrid } from '@/lib/solar-utils';

interface ThreeDRoofViewProps {
  building: BuildingConfig;
  panels: PanelPosition[];
  solarData?: SolarApiData | null;
  onCapture?: (base64: string) => void;
  googleMapsKey?: string;
  latitude?: number;
  longitude?: number;
}

function generateThreeJSHTML(
  building: BuildingConfig,
  panels: PanelPosition[],
  solarData: SolarApiData | null | undefined,
  googleMapsKey?: string,
  latitude?: number,
  longitude?: number,
): string {
  const { rows, cols } = getMaxPanelGrid(building);
  const panelSet = new Set(panels.map(p => `${p.row}-${p.col}`));

  const activePanels: { row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (panelSet.has(`${r}-${c}`)) {
        activePanels.push({ row: r, col: c });
      }
    }
  }

  const maxFlux = solarData?.annualFluxKwhPerM2 || 0;
  const avgSunHours = solarData ? (solarData.maxSunshineHoursPerYear / 365).toFixed(1) : null;

  const satUrl = (googleMapsKey && latitude && longitude)
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=20&size=512x512&maptype=satellite&key=${googleMapsKey}`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0C1220; touch-action: none; }
  canvas { display: block; width: 100%; height: 100%; }
  #info {
    position: absolute; bottom: 12px; left: 12px; right: 12px;
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .badge {
    background: rgba(12,18,32,0.85); color: #94A3B8; font-size: 10px;
    padding: 4px 8px; border-radius: 6px; font-family: sans-serif;
    backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.08);
  }
  .badge b { color: #F1F5F9; font-weight: 600; }
  #controls {
    position: absolute; top: 12px; right: 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .ctrl-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: rgba(12,18,32,0.85); border: 1px solid rgba(255,255,255,0.1);
    color: #94A3B8; font-size: 18px; display: flex; align-items: center;
    justify-content: center; cursor: pointer; font-family: sans-serif;
    backdrop-filter: blur(4px);
  }
  .ctrl-btn:active { background: rgba(14,165,233,0.3); }
</style>
</head>
<body>
<div id="controls">
  <div class="ctrl-btn" onclick="resetCamera()">&#8634;</div>
  <div class="ctrl-btn" onclick="captureImage()">&#128247;</div>
</div>
<div id="info">
  ${avgSunHours ? `<span class="badge"><b>${avgSunHours}h</b> sol/dia (Google)</span>` : ''}
  ${maxFlux ? `<span class="badge"><b>${maxFlux.toFixed(0)}</b> kWh/m2/ano</span>` : ''}
  <span class="badge"><b>${building.roofTilt}&deg;</b> inclinacao</span>
  <span class="badge"><b>${activePanels.length}</b> paineis</span>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function() {
  const W = ${building.width}, L = ${building.length}, TILT = ${building.roofTilt};
  const PW = ${PANEL_WIDTH}, PH = ${PANEL_HEIGHT}, PG = ${PANEL_GAP};
  const COLS = ${cols}, ROWS = ${rows};
  const panels = ${JSON.stringify(activePanels)};
  const satUrl = "${satUrl}";

  let scene, camera, renderer, group;
  let isDragging = false, prevX = 0, prevY = 0;
  let rotX = -0.6, rotY = 0.4;
  let pinchDist = 0, camDist = Math.max(W, L) * 1.8;

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0C1220);
    scene.fog = new THREE.FogExp2(0x0C1220, 0.015);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0x4488cc, 0.4);
    scene.add(amb);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-5, 8, -4);
    scene.add(fill);

    group = new THREE.Group();
    scene.add(group);

    createGround();
    createBuilding();
    createPanels();

    updateCamera();
    animate();
    setupTouch();
  }

  function createGround() {
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a2636,
      roughness: 0.9,
      metalness: 0.1,
    });

    if (satUrl) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      loader.load(satUrl, function(tex) {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        groundMat.map = tex;
        groundMat.color.set(0xffffff);
        groundMat.needsUpdate = true;
      });
    }

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    group.add(ground);

    const gridHelper = new THREE.GridHelper(60, 30, 0x253650, 0x1C2B42);
    gridHelper.position.y = 0;
    group.add(gridHelper);
  }

  function createBuilding() {
    const wallH = 3;
    const tiltRad = TILT * Math.PI / 180;
    const ridgeH = wallH + (L / 2) * Math.tan(tiltRad);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.2,
    });

    const frontGeo = new THREE.BufferGeometry();
    const fv = new Float32Array([
      -W/2, 0, L/2,   W/2, 0, L/2,   W/2, wallH, L/2,
      -W/2, 0, L/2,   W/2, wallH, L/2,   -W/2, wallH, L/2,
    ]);
    frontGeo.setAttribute('position', new THREE.BufferAttribute(fv, 3));
    frontGeo.computeVertexNormals();
    const frontWall = new THREE.Mesh(frontGeo, wallMat);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    group.add(frontWall);

    const backGeo = new THREE.BufferGeometry();
    const bv = new Float32Array([
      W/2, 0, -L/2,   -W/2, 0, -L/2,   -W/2, wallH, -L/2,
      W/2, 0, -L/2,   -W/2, wallH, -L/2,   W/2, wallH, -L/2,
    ]);
    backGeo.setAttribute('position', new THREE.BufferAttribute(bv, 3));
    backGeo.computeVertexNormals();
    const backWall = new THREE.Mesh(backGeo, wallMat);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    const leftGeo = new THREE.BufferGeometry();
    const lv = new Float32Array([
      -W/2, 0, -L/2,   -W/2, 0, L/2,   -W/2, wallH, L/2,
      -W/2, 0, -L/2,   -W/2, wallH, L/2,   -W/2, wallH, -L/2,
      -W/2, wallH, L/2,   -W/2, wallH, -L/2,   -W/2, ridgeH, 0,
    ]);
    leftGeo.setAttribute('position', new THREE.BufferAttribute(lv, 3));
    leftGeo.computeVertexNormals();
    const leftWall = new THREE.Mesh(leftGeo, wallMat);
    leftWall.castShadow = true;
    group.add(leftWall);

    const rightGeo = new THREE.BufferGeometry();
    const rv = new Float32Array([
      W/2, 0, L/2,   W/2, 0, -L/2,   W/2, wallH, -L/2,
      W/2, 0, L/2,   W/2, wallH, -L/2,   W/2, wallH, L/2,
      W/2, wallH, -L/2,   W/2, wallH, L/2,   W/2, ridgeH, 0,
    ]);
    rightGeo.setAttribute('position', new THREE.BufferAttribute(rv, 3));
    rightGeo.computeVertexNormals();
    const rightWall = new THREE.Mesh(rightGeo, wallMat);
    rightWall.castShadow = true;
    group.add(rightWall);

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.5,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });

    const roof1Geo = new THREE.BufferGeometry();
    const r1v = new Float32Array([
      -W/2, wallH, L/2,   W/2, wallH, L/2,   W/2, ridgeH, 0,
      -W/2, wallH, L/2,   W/2, ridgeH, 0,   -W/2, ridgeH, 0,
    ]);
    roof1Geo.setAttribute('position', new THREE.BufferAttribute(r1v, 3));
    roof1Geo.computeVertexNormals();
    const roof1 = new THREE.Mesh(roof1Geo, roofMat);
    roof1.castShadow = true;
    roof1.receiveShadow = true;
    group.add(roof1);

    const roof2Geo = new THREE.BufferGeometry();
    const r2v = new Float32Array([
      W/2, wallH, -L/2,   -W/2, wallH, -L/2,   -W/2, ridgeH, 0,
      W/2, wallH, -L/2,   -W/2, ridgeH, 0,   W/2, ridgeH, 0,
    ]);
    roof2Geo.setAttribute('position', new THREE.BufferAttribute(r2v, 3));
    roof2Geo.computeVertexNormals();
    const roof2 = new THREE.Mesh(roof2Geo, roofMat);
    roof2.castShadow = true;
    roof2.receiveShadow = true;
    group.add(roof2);

    const edgeMat = new THREE.LineBasicMaterial({ color: 0x64748B, linewidth: 1 });
    const edgePoints = [
      new THREE.Vector3(-W/2, wallH, L/2), new THREE.Vector3(-W/2, ridgeH, 0),
      new THREE.Vector3(-W/2, ridgeH, 0), new THREE.Vector3(-W/2, wallH, -L/2),
      new THREE.Vector3(W/2, wallH, L/2), new THREE.Vector3(W/2, ridgeH, 0),
      new THREE.Vector3(W/2, ridgeH, 0), new THREE.Vector3(W/2, wallH, -L/2),
      new THREE.Vector3(-W/2, ridgeH, 0), new THREE.Vector3(W/2, ridgeH, 0),
    ];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    group.add(edges);
  }

  function createPanels() {
    const wallH = 3;
    const tiltRad = TILT * Math.PI / 180;

    const gridW = COLS > 0 ? COLS * (PW + PG) - PG : 0;
    const gridL = ROWS > 0 ? ROWS * (PH + PG) - PG : 0;

    const startX = -gridW / 2 + PW / 2;
    const startZ = -gridL / 2 + PH / 2;

    const roofSlope = L / 2;
    const panelOffsetZ = roofSlope * 0.25;

    panels.forEach(function(p) {
      const px = startX + p.col * (PW + PG);
      const pz = panelOffsetZ + startZ + p.row * (PH + PG);

      const t = (pz + L / 2) / L;
      const roofY = wallH + Math.sin(tiltRad) * (roofSlope - Math.abs(pz));
      const roofZ = pz;

      const panelGeo = new THREE.BoxGeometry(PW * 0.95, 0.04, PH * 0.95);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x2563EB,
        roughness: 0.2,
        metalness: 0.7,
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);

      panel.position.set(px, roofY + 0.08, roofZ);
      panel.rotation.x = -tiltRad * (pz > 0 ? 1 : -1) * (pz > 0 ? 1 : 1);

      if (pz > 0) {
        panel.rotation.x = -tiltRad;
      } else {
        panel.rotation.x = tiltRad;
      }

      panel.castShadow = true;
      panel.receiveShadow = true;
      group.add(panel);

      const frameGeo = new THREE.EdgesGeometry(panelGeo);
      const frameMat = new THREE.LineBasicMaterial({ color: 0x93C5FD, linewidth: 1 });
      const frame = new THREE.LineSegments(frameGeo, frameMat);
      frame.position.copy(panel.position);
      frame.rotation.copy(panel.rotation);
      group.add(frame);

      const div1Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-PW * 0.95 / 2, 0.025, 0),
        new THREE.Vector3(PW * 0.95 / 2, 0.025, 0),
      ]);
      const div1 = new THREE.Line(div1Geo, new THREE.LineBasicMaterial({ color: 0x1D4ED8 }));
      div1.position.copy(panel.position);
      div1.rotation.copy(panel.rotation);
      group.add(div1);

      const div2Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.025, -PH * 0.95 / 2),
        new THREE.Vector3(0, 0.025, PH * 0.95 / 2),
      ]);
      const div2 = new THREE.Line(div2Geo, new THREE.LineBasicMaterial({ color: 0x1D4ED8 }));
      div2.position.copy(panel.position);
      div2.rotation.copy(panel.rotation);
      group.add(div2);
    });
  }

  function updateCamera() {
    camera.position.x = camDist * Math.sin(rotY) * Math.cos(rotX);
    camera.position.y = camDist * Math.sin(-rotX);
    camera.position.z = camDist * Math.cos(rotY) * Math.cos(rotX);
    camera.position.y = Math.max(1, camera.position.y);
    camera.lookAt(0, 2, 0);
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  function setupTouch() {
    const el = renderer.domElement;

    el.addEventListener('pointerdown', function(e) {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });

    el.addEventListener('pointermove', function(e) {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      rotY += dx * 0.008;
      rotX += dy * 0.008;
      rotX = Math.max(-1.4, Math.min(-0.1, rotX));
      prevX = e.clientX;
      prevY = e.clientY;
      updateCamera();
    });

    el.addEventListener('pointerup', function() { isDragging = false; });
    el.addEventListener('pointercancel', function() { isDragging = false; });

    el.addEventListener('wheel', function(e) {
      e.preventDefault();
      camDist += e.deltaY * 0.01;
      camDist = Math.max(5, Math.min(40, camDist));
      updateCamera();
    }, { passive: false });

    el.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    });

    el.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = pinchDist - dist;
        camDist += delta * 0.05;
        camDist = Math.max(5, Math.min(40, camDist));
        pinchDist = dist;
        updateCamera();
      }
    });
  }

  window.resetCamera = function() {
    rotX = -0.6;
    rotY = 0.4;
    camDist = Math.max(W, L) * 1.8;
    updateCamera();
  };

  window.captureImage = function() {
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture', data: dataUrl }));
  };

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  init();
})();
</script>
</body>
</html>`;
}

export function ThreeDRoofView({
  building,
  panels,
  solarData,
  onCapture,
  googleMapsKey,
  latitude,
  longitude,
}: ThreeDRoofViewProps) {
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(
    () => generateThreeJSHTML(building, panels, solarData, googleMapsKey, latitude, longitude),
    [building, panels, solarData, googleMapsKey, latitude, longitude]
  );

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'capture' && onCapture) {
        onCapture(msg.data);
      }
    } catch {}
  }, [onCapture]);

  const handleCapture = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.captureImage(); true;');
  }, []);

  const handleReset = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.resetCamera(); true;');
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.container, { height: 350 }]}>
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 } as any}
            sandbox="allow-scripts allow-same-origin"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
        />
      </View>
      <View style={styles.buttonsRow}>
        <Pressable onPress={handleReset} style={styles.controlBtn}>
          <Ionicons name="refresh" size={16} color={Colors.textSecondary} />
          <Text style={styles.controlBtnText}>Resetar</Text>
        </Pressable>
        {onCapture && (
          <Pressable onPress={handleCapture} style={styles.controlBtn}>
            <Ionicons name="camera" size={16} color={Colors.primary} />
            <Text style={[styles.controlBtnText, { color: Colors.primary }]}>Capturar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 10,
  },
  container: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
});
