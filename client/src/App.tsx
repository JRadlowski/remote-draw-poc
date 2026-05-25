import { useState, useEffect, useRef } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  DisconnectButton,
  ControlBar,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import './App.css';
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
    );
  }

  return (
    <div className="home-container">
      <div className="bg-glow"></div>
      <div className="home-card">
        <h1>Remote Draw</h1>
        {!sessionData ? (
          <>
            <p className="hero-subtitle">
              Instant visual support with real-time AR drawing. <br/>
              No apps. No downloads. Just support.
            </p>
            <button className="btn btn-primary" onClick={createSession}>
              Generate Session
            </button>
          </>
        ) : (
          <div className="session-links">
            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Session Ready</h3>
            
            <div className="link-box">
              <span className="link-label">Expert Dashboard</span>
              <div className="input-row">
                <input 
                  readOnly 
                  className="input-field"
                  value={`${window.location.origin}?role=expert&token=${sessionData.expertToken}&url=${sessionData.url}`}
                />
                <button className="btn btn-secondary" style={{ height: 'auto', padding: '0 1rem' }} onClick={() => window.open(`${window.location.origin}?role=expert&token=${sessionData.expertToken}&url=${sessionData.url}`)}>
                  Open
                </button>
              </div>
            </div>

            <div className="link-box">
              <span className="link-label">Client Mobile View</span>
              <div className="input-row">
                <input 
                  readOnly 
                  className="input-field"
                  value={`${window.location.origin}?role=client&token=${sessionData.clientToken}&url=${sessionData.url}`}
                />
                <button className="btn btn-secondary" style={{ height: 'auto', padding: '0 1rem' }} onClick={() => navigator.clipboard.writeText(`${window.location.origin}?role=client&token=${sessionData.clientToken}&url=${sessionData.url}`)}>
                  Copy
                </button>
              </div>
            </div>
            
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setSessionData(null)}>
              Start Over
            </button>
          </div>
        )}
      </div>
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
  const dimensions = activeTrack?.publication?.dimensions;
  const aspectRatio = dimensions ? dimensions.width / dimensions.height : undefined;

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
    <div className="session-view">
      <div className="glass-header">
        <div className="status-indicator">
          <div className={`dot ${isFrozen ? 'frozen' : ''}`}></div>
          {role.toUpperCase()} {isFrozen && '• FROZEN'}
        </div>
        <DisconnectButton className="btn btn-danger" style={{ height: '2.5rem', padding: '0 1rem' }}>
          End Session
        </DisconnectButton>
      </div>

      <div className="video-stage">
        {activeTrack ? (
          <div className="canvas-wrapper" style={{ 
            maxWidth: aspectRatio ? `calc(100vh * ${aspectRatio})` : '100%',
            maxHeight: aspectRatio ? `calc(100vw / ${aspectRatio})` : '100%',
            aspectRatio: aspectRatio ? `${aspectRatio}` : 'auto'
          }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Establishing connection...</p>
          </div>
        )}
      </div>

      <div className="bottom-bar">
        <ControlBar variation="minimal" controls={{ leave: false }} />
        {role === 'expert' && (
          <div className="tool-group">
            <button className="btn btn-secondary" style={{ height: '3rem' }} onClick={handleClear}>
              Clear
            </button>
            <button 
              className={`btn ${isFrozen ? 'btn-danger' : 'btn-primary'} freeze-btn`}
              style={{ height: '3rem' }}
              onClick={handleFreezeToggle}
            >
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
