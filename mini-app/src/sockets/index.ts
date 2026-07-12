import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { applyAuthMiddleware } from "./authMiddleware";
import { handleNotifications } from "./handlers/notificationHandler";
import helmet from "helmet";
import { allowedOrigins } from "@/sockets/constants";
import { applyRateLimiting } from "@/sockets/rateLimiter";
import { logger } from "@/server/utils/logger";

const IP_REDIS = process.env.IP_REDIS;
const REDIS_PORT = Number(process.env.REDIS_PORT);
const SOCKET_PORT = Number(process.env.SOCKET_PORT);

(async () => {
  try {
    logger.log("Starting socket server");

    if (!IP_REDIS || !REDIS_PORT) {
      throw new Error("Missing IP_REDIS or REDIS_PORT environment variable.");

    }

    if (!SOCKET_PORT) {
      throw new Error("Missing SOCKET_PORT environment variable.");
    }

    // Redis clients for the adapter
    const redisPassword = process.env.REDIS_PASSWORD;
    const authString = redisPassword ? `:${redisPassword}@` : "";
    const pubClient = createClient({ url: `redis://${authString}${IP_REDIS}:${REDIS_PORT}` });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    const httpServer = createServer();
    // Apply Helmet middleware
    httpServer.on("request", helmet());
    const io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          logger.log("Origin:", origin);
          if (!origin) return callback(null, false); // Disallow requests without origin
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          } else {
            return callback(new Error("CORS policy violation: Origin not allowed"), false);
          }
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      allowEIO3: false, // Disallow old Socket.IO clients
    });



    // Apply Redis adapter
    io.adapter(createAdapter(pubClient, subClient));

    // Apply rate limiting middleware
    applyRateLimiting(io);

    // Apply authentication middleware
    applyAuthMiddleware(io);

    // Handle user connections and manage notifications
    await handleNotifications(io);
    // Global error handling
    io.on("error", (error) => {
      logger.error("Socket.IO Server Error:", error.message);
    });

    httpServer.listen(SOCKET_PORT, () => {
      logger.log(`Socket.IO server listening on port ${SOCKET_PORT}`);
    });


  } catch (error) {
    logger.error("Error starting the socket server:", error);
    process.exit(1);
  }
})();
