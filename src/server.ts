import 'dotenv/config';
import http from 'http';
import app from './app';
// import { setupSocket } from './sockets';
import { connectDB } from './config/database';
// import { connectRedis } from './config/redis';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
// const io = setupSocket(server);

const startServer = async () => {
  try {
    // Await DB and Redis connections here
    await connectDB();
    // await connectRedis();

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
