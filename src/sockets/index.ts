import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { UserRole } from "../models/User";

let io: Server;

export const initSockets = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"],
    },
  });

  // Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "super_secret",
      ) as { id: string; role: string };

      // Attach user details to socket object
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Connection Handler
  io.on("connection", (socket: Socket) => {
    const { id, role } = socket.data.user;

    // Join regular user room for buyer-specific updates
    socket.join(`user:${id}`);

    // Join role-specific rooms
    if (role === UserRole.SELLER) {
      socket.join(`seller:${id}`);
    } else if (role === UserRole.ADMIN) {
      socket.join("admin");
    }

    console.log(`User ${id} (${role}) connected to sockets`);

    socket.on("disconnect", () => {
      console.log(`User ${id} disconnected from sockets`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};
