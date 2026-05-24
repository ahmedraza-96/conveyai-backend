import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { errorResponse } from "../../utils/api.utils";
import type { JwtPayload } from "../../utils/auth.utils";
import { CHAT_LIMITS } from "./chat.constants";

// Simple in-memory rate limiter for chat messages
const rateLimitMap = new Map<
	string,
	{ count: number; windowStart: number }
>();

// Clean up expired entries every 5 minutes
setInterval(
	() => {
		const now = Date.now();
		for (const [key, value] of rateLimitMap.entries()) {
			if (now - value.windowStart > 60_000) {
				rateLimitMap.delete(key);
			}
		}
	},
	5 * 60 * 1000,
);

export const chatRateLimit = (
	req: Request,
	res: Response,
	next?: NextFunction,
): void => {
	const userId = (req.user as JwtPayload)?.sub;
	if (!userId) {
		errorResponse(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
		return;
	}

	const now = Date.now();
	const entry = rateLimitMap.get(userId);

	if (!entry || now - entry.windowStart > 60_000) {
		// New window
		rateLimitMap.set(userId, { count: 1, windowStart: now });
		next?.();
		return;
	}

	if (entry.count >= CHAT_LIMITS.RATE_LIMIT_PER_MINUTE) {
		errorResponse(
			res,
			"Too many messages. Please wait a moment before sending another message.",
			StatusCodes.TOO_MANY_REQUESTS,
		);
		return;
	}

	entry.count++;
	next?.();
};
