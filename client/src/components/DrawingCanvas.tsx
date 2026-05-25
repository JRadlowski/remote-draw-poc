import { useRef, useEffect, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';

interface Point {
  x: number;
  y: number;
  isNew: boolean;
}

interface DrawingCanvasProps {
  isExpert: boolean;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ isExpert }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  // Handle incoming data
  useEffect(() => {
    const handleData = (payload: Uint8Array, _participant: any) => {
      const decoder = new TextDecoder();
      const data = JSON.parse(decoder.decode(payload));
      
      if (data.type === 'DRAW_POINT') {
        setPoints(prev => [...prev, { x: data.x, y: data.y, isNew: data.isNew }]);
      } else if (data.type === 'CLEAR') {
        setPoints([]);
      }
    };

    room.on('dataReceived', handleData);
    return () => {
      room.off('dataReceived', handleData);
    };
  }, [room]);

  // Global listener for CLEAR event (for local expert too)
  useEffect(() => {
    const handleClear = (e: any) => {
      if (e.detail?.type === 'CLEAR_LOCAL') {
        setPoints([]);
      }
    };
    window.addEventListener('canvas-control', handleClear);
    return () => window.removeEventListener('canvas-control', handleClear);
  }, []);

  // Draw points on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    points.forEach((p) => {
      const x = p.x * canvas.width;
      const y = p.y * canvas.height;
      if (p.isNew) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }, [points]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isExpert) return;
    addPoint(e, true);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isExpert) return;
    if (e.type === 'mousemove' && (e as React.MouseEvent).buttons !== 1) return;
    addPoint(e, false);
  };

  const addPoint = (e: any, isNew: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Pobieramy rect canvasa, który dzięki CSS 'object-fit: contain' 
    // jest dokładnie tej samej wielkości co wideo.
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Mapujemy wprost na canvas. Ponieważ canvas wypełnia to samo miejsce co wideo,
    // to zadziała niezależnie od czarnych pasów.
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const point = { type: 'DRAW_POINT', x, y, isNew };
    
    const encoder = new TextEncoder();
    localParticipant.publishData(encoder.encode(JSON.stringify(point)), { reliable: true });

    setPoints(prev => [...prev, { x, y, isNew }]);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        cursor: isExpert ? 'crosshair' : 'default',
        zIndex: 10,
      }}
      // Ustawiamy rozdzielczość canvas na taką samą jak rozmiar CSS, żeby uniknąć skalowania
      width={canvasRef.current?.clientWidth}
      height={canvasRef.current?.clientHeight}
    />
  );
};

export default DrawingCanvas;
