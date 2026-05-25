import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/session', async (req: express.Request, res: express.Response) => {
  try {
    const roomName = `room-${Math.random().toString(36).substring(7)}`;
    
    const createToken = (participantName: string, isPublisher: boolean) => {
      const at = new AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        { identity: participantName }
      );
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: isPublisher,
        canSubscribe: true,
      });
      return at.toJwt();
    };

    const expertToken = await createToken('expert', true);
    const clientToken = await createToken('client', true);

    res.json({
      room: roomName,
      expertToken,
      clientToken,
      url: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error('Error generating tokens:', error);
    res.status(500).json({ error: 'Failed to generate tokens' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
