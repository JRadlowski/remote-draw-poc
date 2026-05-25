import { useState, useEffect, useRef } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import DrawingCanvas from './components/DrawingCanvas';

const App = () => {
  const [sessionData, setSessionData] = useState<{
    room: string;
    expertToken: string;
    clientToken: string;
    url: string;
  } | null>(null);

  const [role, setRole] = useState<'expert' | 'client' | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    const t = params.get('token');
    
    if (r && t && (r === 'expert' || r === 'client')) {
      setRole(r as 'expert' | 'client');
      setToken(t);
    }
  }, []);

  const createSession = async () => {
    try {
      const response = await fetch('https://remote-draw-server-maun.onrender.com/api/session', {
        method: 'POST',
      });
      const data = await response.json();
      setSessionData(data);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  if (role && token) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: '#000', color: '#fff' }}>
        <LiveKitRoom
          video={role === 'client'}
          audio={true}
          token={token}
          serverUrl={new URLSearchParams(window.location.search).get('url') || ''}
          connect={true}
        >
          <SessionView role={role} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Remote Draw Support PoC</h1>
      {!sessionData ? (
        <button onClick={createSession} style={{ padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer' }}>
          Generate Support Session
        </button>
      ) : (
        <div style={{ marginTop: '20px', textAlign: 'left', maxWidth: '600px', margin: '20px auto' }}>
          <h3>Session Created!</h3>
          <div style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '15px' }}>
            <p><strong>Expert Link:</strong></p>
            <input 
              readOnly 
              value={`${window.location.origin}?role=expert&token=${sessionData.expertToken}&url=${sessionData.url}`}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <button onClick={() => window.open(`${window.location.origin}?role=expert&token=${sessionData.expertToken}&url=${sessionData.url}`)}>
              Open Expert View
            </button>
          </div>
          <div style={{ border: '1px solid #ccc', padding: '15px' }}>
            <p><strong>Client Link (Mobile):</strong></p>
            <input 
              readOnly 
              value={`${window.location.origin}?role=client&token=${sessionData.clientToken}&url=${sessionData.url}`}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}?role=client&token=${sessionData.clientToken}&url=${sessionData.url}`)}>
              Copy Client Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SessionView = ({ role }: { role: 'expert' | 'client' }) => {
  const tracks = useTracks([Track.Source.Camera]);
  const remoteTrack = tracks.find(t => t.participant.identity === 'client' && t.source === Track.Source.Camera);
  const localTrack = tracks.find(t => t.participant.identity === 'client' && t.source === Track.Source.Camera);
  
  const snapshotCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const activeTrack = role === 'expert' ? remoteTrack : localTrack;

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const data = JSON.parse(decoder.decode(payload));
      if (data.type === 'FREEZE') {
        if (data.active) {
          freeze();
        } else {
          setIsFrozen(false);
        }
      }
    };
    room.on('dataReceived', handleData);
    return () => {
      room.off('dataReceived', handleData);
    };
  }, [room]);

  const freeze = () => {
    const video = document.querySelector('video');
    const canvas = snapshotCanvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setIsFrozen(true);
    }
  };

  const handleFreezeToggle = () => {
    const newState = !isFrozen;
    if (newState) {
      freeze();
    } else {
      setIsFrozen(false);
    }
    
    const encoder = new TextEncoder();
    localParticipant.publishData(
      encoder.encode(JSON.stringify({ type: 'FREEZE', active: newState })),
      { reliable: true }
    );
  };

  const handleClear = () => {
    const encoder = new TextEncoder();
    localParticipant.publishData(
      encoder.encode(JSON.stringify({ type: 'CLEAR' })),
      { reliable: true }
    );
    window.dispatchEvent(new CustomEvent('canvas-control', { detail: { type: 'CLEAR_LOCAL' } }));
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px' }}>
        Role: {role.toUpperCase()} {isFrozen && '(FROZEN)'}
      </div>

      <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {activeTrack ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <VideoTrack 
              trackRef={activeTrack} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                display: isFrozen ? 'none' : 'block'
              }} 
            />
            <canvas 
              ref={snapshotCanvasRef} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                display: isFrozen ? 'block' : 'none'
              }} 
            />
            <DrawingCanvas isExpert={role === 'expert'} />
          </div>
        ) : (
          <p>Waiting for camera stream...</p>
        )}
      </div>

      {role === 'expert' && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: '10px' }}>
          <button style={{ padding: '10px 20px', cursor: 'pointer' }} onClick={handleClear}>Clear Canvas</button>
          <button 
            style={{ padding: '10px 20px', cursor: 'pointer', background: isFrozen ? '#f00' : '#fff' }} 
            onClick={handleFreezeToggle}
          >
            {isFrozen ? 'Unfreeze' : 'Freeze Frame'}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
