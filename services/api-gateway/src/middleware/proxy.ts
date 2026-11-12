import { createProxyMiddleware, Filter, Options } from "http-proxy-middleware";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Create a proxy middleware for routing requests to backend services.
 *
 * @param target - The target service URL
 * @param pathRewrite - Optional path rewrite rules
 * @returns Express middleware for proxying requests
 */
export function createServiceProxy(
  target: string,
  pathRewrite?: Record<string, string>
) {
  const proxyOptions: Options = {
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req, res) => {
      logger.debug({
        msg: "Proxying request",
        method: req.method,
        originalUrl: req.url,
        target: `${target}${proxyReq.path}`,
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.debug({
        msg: "Received response from backend",
        method: req.method,
        originalUrl: req.url,
        statusCode: proxyRes.statusCode,
      });
    },
    onError: (err, req, res) => {
      logger.error({
        msg: "Proxy error",
        error: err.message,
        method: req.method,
        url: req.url,
      });

      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: "Service temporarily unavailable",
        });
      }
    },
  };

  return createProxyMiddleware(proxyOptions);
}

/**
 * Create proxy middleware for Identity Service routes.
 */
export const identityServiceProxy = createServiceProxy(env.IDENTITY_SERVICE_URL);

/**
 * Create proxy middleware for Banking Service routes.
 */
export const bankingServiceProxy = createProxyMiddleware({
  target: env.BANKING_SERVICE_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    logger.debug({
      msg: "Proxying request to banking service",
      method: req.method,
      originalUrl: req.url,
      target: `${env.BANKING_SERVICE_URL}${proxyReq.path}`,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.debug({
      msg: "Received response from banking service",
      method: req.method,
      originalUrl: req.url,
      statusCode: proxyRes.statusCode,
    });
  },
  onError: (err, req, res) => {
    logger.error({
      msg: "Banking service proxy error",
      error: err.message,
      method: req.method,
      url: req.url,
    });

    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: "Banking service temporarily unavailable",
      });
    }
  },
});
