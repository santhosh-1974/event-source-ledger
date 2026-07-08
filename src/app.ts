import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";

import { logger } from "./config/logger";
import routes from "./routes";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.disable("x-powered-by");
app.use(
  pinoHttp({
    logger,
  })
);
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1", routes);
app.use(notFound);
app.use(errorHandler);

export default app;