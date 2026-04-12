import { Router, type IRouter } from "express";
import { verifyJwt } from "../middleware/auth.js";
import {
  createPaymentRequest,
  checkPayment,
  sendDemoPayment,
  getDemoWalletAddress,
} from "../services/paymentService.js";
import { logger } from "../logger.js";

export const paymentRouter: IRouter = Router();

// GET /api/payment/info — public info about payment options
paymentRouter.get("/info", (_req, res) => {
  res.json({
    options: [
      { currency: "XRP", amount: "10", label: "10 XRP" },
    ],
    demoWalletAddress: getDemoWalletAddress(),
  });
});

// POST /api/payment/create — create a payment request
paymentRouter.post("/create", verifyJwt, async (req, res) => {
  try {
    const currency = "XRP" as const;
    const result = await createPaymentRequest(req.user!.userId, currency);
    res.json(result);
  } catch (err: any) {
    logger.error("[payment] Create failed", { error: err?.message });
    res.status(500).json({ error: "Failed to create payment request" });
  }
});

// GET /api/payment/status/:id — poll payment status
paymentRouter.get("/status/:id", verifyJwt, async (req, res) => {
  try {
    const result = await checkPayment(req.params.id as string);
    res.json(result);
  } catch (err: any) {
    logger.error("[payment] Status check failed", { error: err?.message });
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

// POST /api/payment/demo-pay — server signs + submits from demo wallet
paymentRouter.post("/demo-pay", verifyJwt, async (req, res) => {
  try {
    const { paymentId } = req.body ?? {};
    if (!paymentId) {
      res.status(400).json({ error: "paymentId is required" });
      return;
    }
    const result = await sendDemoPayment(paymentId);
    res.json(result);
  } catch (err: any) {
    logger.error("[payment] Demo pay failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "Demo payment failed" });
  }
});
