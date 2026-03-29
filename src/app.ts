import express, { Application, Request, Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app: Application = express();

// Rate Limiter: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again after a minute.",
  },
});

// Middleware
app.use(cors());
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

import routes from "./routes";
app.use("/api", routes);

export default app;
