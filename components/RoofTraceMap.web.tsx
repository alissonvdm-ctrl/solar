import React, { useRef, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import Colors from "@/constants/colors";
import type { GeoPoint } from "@/lib/geo-utils";

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    zIndex: 10,
  },
});

interface RoofTraceMapProps {
  latitude: number;
  longitude: number;
  googleMapsKey: string;
  points: GeoPoint[];
  onAddPoint: (point: GeoPoint) => void;
  onMovePoint: (index: number, point: GeoPoint) => void;
  onClosePolygon: () => void;
  isClosed: boolean;
}

export function RoofTraceMap({
  latitude,
  longitude,
  googleMapsKey,
  points,
  onAddPoint,
  onMovePoint,
  onClosePolygon,
  isClosed,
}: RoofTraceMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "mapClick") {
          onAddPoint({ latitude: data.lat, longitude: data.lng });
        } else if (data.type === "mapReady") {
          setLoaded(true);
        } else if (data.type === "markerDrag") {
          onMovePoint(data.index, { latitude: data.lat, longitude: data.lng });
        } else if (data.type === "closePolygon") {
          onClosePolygon();
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onAddPoint, onMovePoint, onClosePolygon]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: "updatePoints", points, isClosed }),
        "*"
      );
    }
  }, [points, isClosed]);

  const html = generateMapHTML(latitude, longitude, googleMapsKey);

  return (
    <View style={styles.container}>
      {!loaded && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </View>
  );
}

function generateMapHTML(lat: number, lng: number, apiKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
html,body,#map{width:100%;height:100%;margin:0;padding:0;background:#0C1220}
.measure-label{background:rgba(14,165,233,0.9);color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;border:1px solid rgba(255,255,255,0.3);pointer-events:none}
.area-label{background:rgba(245,158,11,0.9);color:#fff;padding:4px 8px;border-radius:6px;font-size:13px;font-weight:700;white-space:nowrap;border:1px solid rgba(255,255,255,0.3);pointer-events:none}
#magnifier{position:fixed;width:140px;height:140px;border-radius:50%;border:3px solid #0EA5E9;box-shadow:0 4px 20px rgba(0,0,0,0.6);display:none;pointer-events:none;z-index:9999;overflow:hidden;top:20px;right:20px}
#magnifier canvas{width:100%;height:100%}
#mag-crosshair{position:absolute;top:50%;left:50%;width:20px;height:20px;margin:-10px 0 0 -10px;pointer-events:none;z-index:10000}
#mag-crosshair::before,#mag-crosshair::after{content:'';position:absolute;background:#FF4444}
#mag-crosshair::before{width:2px;height:20px;left:9px;top:0}
#mag-crosshair::after{width:20px;height:2px;top:9px;left:0}
#mag-label{position:fixed;top:165px;right:20px;background:rgba(14,165,233,0.9);color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;display:none;pointer-events:none;z-index:9999;white-space:nowrap}
</style>
</head>
<body>
<div id="map"></div>
<div id="magnifier"><div id="mag-crosshair"></div></div>
<div id="mag-label"></div>
<script>
var map,polygon,polyline,markers=[],labels=[],areaLabel=null;
var points=[],isClosed=false;
var draggingIndex=-1;
var magEl=document.getElementById('magnifier');
var magLabel=document.getElementById('mag-label');

function sendMsg(obj){
  window.parent.postMessage(JSON.stringify(obj),'*');
}

function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:${lat},lng:${lng}},
    zoom:20,
    mapTypeId:'satellite',
    tilt:0,
    disableDefaultUI:true,
    zoomControl:true,
    gestureHandling:'greedy',
    clickableIcons:false
  });
  map.addListener('click',function(e){
    if(isClosed||draggingIndex>=0)return;
    sendMsg({type:'mapClick',lat:e.latLng.lat(),lng:e.latLng.lng()});
  });
  sendMsg({type:'mapReady'});
}

window.addEventListener('message',function(e){
  try{
    var d=JSON.parse(e.data);
    if(d.type==='updatePoints'){
      points=d.points;
      isClosed=d.isClosed;
      if(draggingIndex<0){drawOverlays();}
    }
  }catch(err){}
});

function haversine(p1,p2){
  var R=6371000,dLat=(p2.latitude-p1.latitude)*Math.PI/180,dLng=(p2.longitude-p1.longitude)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(p1.latitude*Math.PI/180)*Math.cos(p2.latitude*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(m){return m<1?(m*100).toFixed(0)+' cm':m<100?m.toFixed(1)+' m':m.toFixed(0)+' m';}
function calcArea(pts){
  if(pts.length<3)return 0;
  var R=6371000,area=0;
  for(var i=0;i<pts.length;i++){
    var j=(i+1)%pts.length;
    var xi=pts[i].longitude*Math.PI/180*R*Math.cos(pts[i].latitude*Math.PI/180);
    var yi=pts[i].latitude*Math.PI/180*R;
    var xj=pts[j].longitude*Math.PI/180*R*Math.cos(pts[j].latitude*Math.PI/180);
    var yj=pts[j].latitude*Math.PI/180*R;
    area+=xi*yj-xj*yi;
  }
  return Math.abs(area/2);
}

function showMagnifier(lat,lng){
  magEl.style.display='block';
  magLabel.style.display='block';
  magLabel.textContent=lat.toFixed(6)+', '+lng.toFixed(6);
  var canvas=magEl.querySelector('canvas');
  if(!canvas){
    canvas=document.createElement('canvas');
    canvas.width=280;canvas.height=280;
    magEl.insertBefore(canvas,magEl.firstChild);
  }
  var proj=map.getProjection();
  if(!proj)return;
  var center=new google.maps.LatLng(lat,lng);
  var zoom=map.getZoom()||20;
  var magZoom=zoom+3;
  var scale=Math.pow(2,magZoom);
  var worldPt=proj.fromLatLngToPoint(center);
  var mapDiv=map.getDiv();
  var mapCanvas=mapDiv.querySelector('canvas')||mapDiv.querySelector('div');
  if(mapDiv){
    try{
      var srcCanvas=mapDiv.querySelector('canvas');
      if(srcCanvas){
        var ctx=canvas.getContext('2d');
        var worldCenter=proj.fromLatLngToPoint(map.getCenter());
        var mapZoomScale=Math.pow(2,zoom);
        var dx=(worldPt.x-worldCenter.x)*mapZoomScale;
        var dy=(worldPt.y-worldCenter.y)*mapZoomScale;
        var cx=mapDiv.offsetWidth/2+dx;
        var cy=mapDiv.offsetHeight/2+dy;
        var magScale=Math.pow(2,3);
        var sw=280/magScale;
        var sh=280/magScale;
        ctx.clearRect(0,0,280,280);
        ctx.imageSmoothingEnabled=true;
        ctx.drawImage(srcCanvas,cx-sw/2,cy-sh/2,sw,sh,0,0,280,280);
      }
    }catch(ex){}
  }
}

function hideMagnifier(){
  magEl.style.display='none';
  magLabel.style.display='none';
}

function drawOverlays(){
  markers.forEach(function(m){m.setMap(null);});
  labels.forEach(function(l){l.setMap(null);});
  if(polygon)polygon.setMap(null);
  if(polyline)polyline.setMap(null);
  if(areaLabel)areaLabel.setMap(null);
  markers=[];labels=[];

  if(points.length===0)return;

  var path=points.map(function(p){return{lat:p.latitude,lng:p.longitude};});

  points.forEach(function(p,i){
    var m=new google.maps.Marker({
      position:{lat:p.latitude,lng:p.longitude},
      map:map,
      draggable:true,
      icon:{
        path:google.maps.SymbolPath.CIRCLE,
        scale:i===0?10:7,
        fillColor:i===0?'#F59E0B':'#0EA5E9',
        fillOpacity:1,
        strokeColor:'#fff',
        strokeWeight:3
      },
      zIndex:100+i,
      cursor:'grab'
    });

    m.addListener('dragstart',function(){
      draggingIndex=i;
      map.setOptions({gestureHandling:'none'});
    });

    (function(marker,idx){
      marker.addListener('drag',function(){
        var pos=marker.getPosition();
        var lt=pos.lat(),ln=pos.lng();
        points[idx]={latitude:lt,longitude:ln};
        updateLinesOnly();
        showMagnifier(lt,ln);
      });
      marker.addListener('dragend',function(){
        draggingIndex=-1;
        map.setOptions({gestureHandling:'greedy'});
        hideMagnifier();
        var pos=marker.getPosition();
        sendMsg({type:'markerDrag',index:idx,lat:pos.lat(),lng:pos.lng()});
      });
    })(m,i);

    if(i===0&&points.length>=3&&!isClosed){
      m.addListener('click',function(){
        sendMsg({type:'closePolygon'});
      });
    }

    markers.push(m);
  });

  if(isClosed&&points.length>=3){
    polygon=new google.maps.Polygon({
      paths:path,
      strokeColor:'#0EA5E9',
      strokeWeight:2,
      fillColor:'#0EA5E9',
      fillOpacity:0.15,
      map:map,
      clickable:false
    });
  }

  var linePath=isClosed?path.concat(path[0]):path;
  polyline=new google.maps.Polyline({
    path:linePath,
    strokeColor:'#0EA5E9',
    strokeWeight:3,
    strokeOpacity:0.9,
    map:map,
    clickable:false
  });

  drawLabels();
}

function updateLinesOnly(){
  var path=points.map(function(p){return{lat:p.latitude,lng:p.longitude};});
  if(polyline){
    var lp=isClosed?path.concat(path[0]):path;
    polyline.setPath(lp);
  }
  if(polygon&&isClosed){
    polygon.setPaths([path]);
  }
  labels.forEach(function(l){l.setMap(null);});
  labels=[];
  if(areaLabel){areaLabel.setMap(null);areaLabel=null;}
  drawLabels();
}

function drawLabels(){
  var segCount=isClosed?points.length:points.length-1;
  for(var i=0;i<segCount;i++){
    var j=(i+1)%points.length;
    var dist=haversine(points[i],points[j]);
    var midLat=(points[i].latitude+points[j].latitude)/2;
    var midLng=(points[i].longitude+points[j].longitude)/2;
    var div=document.createElement('div');
    div.className='measure-label';
    div.textContent=fmtDist(dist);
    var overlay=new MeasureOverlay(midLat,midLng,div);
    overlay.setMap(map);
    labels.push(overlay);
  }
  if(isClosed&&points.length>=3){
    var area=calcArea(points);
    var cLat=points.reduce(function(s,p){return s+p.latitude;},0)/points.length;
    var cLng=points.reduce(function(s,p){return s+p.longitude;},0)/points.length;
    var aDiv=document.createElement('div');
    aDiv.className='area-label';
    aDiv.textContent=area.toFixed(1)+' m\\u00B2';
    areaLabel=new MeasureOverlay(cLat,cLng,aDiv);
    areaLabel.setMap(map);
  }
}

function MeasureOverlay(lat,lng,div){
  this.pos=new google.maps.LatLng(lat,lng);
  this.div=div;
}
MeasureOverlay.prototype=new google.maps.OverlayView();
MeasureOverlay.prototype.onAdd=function(){
  this.getPanes().floatPane.appendChild(this.div);
};
MeasureOverlay.prototype.draw=function(){
  var p=this.getProjection().fromLatLngToDivPixel(this.pos);
  if(p){this.div.style.position='absolute';this.div.style.left=(p.x-30)+'px';this.div.style.top=(p.y-10)+'px';}
};
MeasureOverlay.prototype.onRemove=function(){
  if(this.div.parentNode)this.div.parentNode.removeChild(this.div);
};
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap" async defer></script>
</body>
</html>`;
}
