import "dotenv/config";
import http from "http";
import app from "./app";
import { initSockets } from "./sockets";
import { connectDB } from "./config/database";
import { connectRedis } from "./config/redis";
import { initOrderWorker } from "./workers/order.worker";
import { initStockWorker } from "./workers/stock.worker";

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
initSockets(server);

const startServer = async () => {
  try {
    // Await DB and Redis connections here
    await connectDB();
    const redisAvailable = await connectRedis();

    // Start background workers only if Redis is up
    if (redisAvailable) {
      initOrderWorker();
      initStockWorker();
    }

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
