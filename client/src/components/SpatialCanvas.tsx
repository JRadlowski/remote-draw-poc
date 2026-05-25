import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import * as ZapparThree from '@zappar/zappar-threejs';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { LocalVideoTrack, Track } from 'livekit-client';

interface SpatialCanvasProps {
  isExpert: boolean;
  isFrozen: boolean;
}

const SpatialCanvas: React.FC<SpatialCanvasProps> = ({ isExpert, isFrozen }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scene] = useState(() => new THREE.Scene());
  const [points, setPoints] = useState<THREE.Vector3[][]>([]); // Array of strokes (each stroke is array of points)
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const publishedTrackRef = useRef<LocalVideoTrack | null>(null);

  // Refs for AR objects
  const cameraRef = useRef<ZapparThree.Camera | null>(null);
  const trackerRef = useRef<ZapparThree.InstantWorldTracker | null>(null);
  const strokesGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (isExpert || !containerRef.current) return;

    // 1. Setup Zappar
    const camera = new ZapparThree.Camera();
    cameraRef.current = camera;
    
    ZapparThree.permissionRequestUI().then((granted) => {
      if (granted) {
        camera.start();
        // After camera starts, publish the canvas stream to LiveKit
        setTimeout(async () => {
          const canvas = containerRef.current?.querySelector('canvas');
          if (canvas && localParticipant) {
            const stream = canvas.captureStream(30);
            const [videoTrack] = stream.getVideoTracks();
            const lkTrack = new LocalVideoTrack(videoTrack);
            await localParticipant.publishTrack(lkTrack, { name: 'camera', source: Track.Source.Camera });
            publishedTrackRef.current = lkTrack;
          }
        }, 2000);
      }
    });

    const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // 2. Setup Tracker
    const tracker = new ZapparThree.InstantWorldTracker();
    trackerRef.current = tracker;
    const trackerGroup = new ZapparThree.InstantWorldAnchorGroup(camera, tracker);
    scene.add(trackerGroup);

    const strokesGroup = new THREE.Group();
    trackerGroup.add(strokesGroup);
    strokesGroupRef.current = strokesGroup;

    // 3. Animation Loop
    let animationId: number;
    const animate = () => {
      if (!cameraRef.current) return;
      animationId = requestAnimationFrame(animate);
      cameraRef.current.updateFrame(renderer);
      renderer.render(scene, cameraRef.current);
    };
    animate();

    // 4. Handle incoming draw data
    const handleData = (payload: Uint8Array) => {
      const data = JSON.parse(new TextDecoder().decode(payload));
      if (data.type === 'DRAW_POINT') {
        const point = projectPoint(data.x, data.y);
        if (point) {
          setPoints(prev => {
            if (data.isNew || prev.length === 0) {
              return [...prev, [point]];
            }
            const lastStroke = [...prev[prev.length - 1], point];
            return [...prev.slice(0, -1), lastStroke];
          });
        }
      } else if (data.type === 'CLEAR') {
        setPoints([]);
      }
    };
    room.on('dataReceived', handleData);

    return () => {
      cancelAnimationFrame(animationId);
      room.off('dataReceived', handleData);
      if (publishedTrackRef.current) {
        localParticipant?.unpublishTrack(publishedTrackRef.current);
      }
      renderer.dispose();
      (camera as any).destroy?.();
    };
  }, [isExpert, localParticipant, room, scene]);

  // Use isFrozen to potentially lock the tracker
  useEffect(() => {
    if (isFrozen && trackerRef.current) {
      // In a real SLAM, we might want to pause tracking or save the pose
      // For this PoC, we just use it as a logical flag
      console.log('AR World Frozen');
    }
  }, [isFrozen]);

  const projectPoint = (normX: number, normY: number) => {
    if (!cameraRef.current) return null;

    // Convert normalized screen (0-1) to clip space (-1 to 1)
    const x = (normX * 2) - 1;
    const y = -(normY * 2) + 1;

    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(cameraRef.current);
    
    const dir = vector.sub(cameraRef.current.position).normalize();
    const distance = 1.5; // Draw 1.5m in front of camera
    return cameraRef.current.position.clone().add(dir.multiplyScalar(distance));
  };

  // Update 3D lines when points change
  useEffect(() => {
    if (!strokesGroupRef.current) return;
    
    // Clear existing lines
    while(strokesGroupRef.current.children.length > 0){ 
      const child = strokesGroupRef.current.children[0];
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      strokesGroupRef.current.remove(child); 
    }

    // Create new lines for each stroke
    points.forEach(stroke => {
      const geometry = new THREE.BufferGeometry().setFromPoints(stroke);
      const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 5 });
      const line = new THREE.Line(geometry, material);
      strokesGroupRef.current?.add(line);
    });
  }, [points]);

  if (isExpert) return null;

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20 }}>
      <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '10px', zIndex: 30 }}>
        Tap screen to anchor AR world
      </div>
    </div>
  );
};

export default SpatialCanvas;

