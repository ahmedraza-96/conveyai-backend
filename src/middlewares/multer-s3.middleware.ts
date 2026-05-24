import type { NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import multer from "multer";
import multerS3 from "multer-s3";
import s3, { BUCKET_NAME } from "../lib/aws.service";
import { errorResponse } from "../utils/api.utils";
import { checkFiletype, checkResumeFiletype } from "../utils/common.utils";
import type { RequestAny, ResponseAny } from "../openapi/magic-router";

const storageEngineProfile: multer.StorageEngine = multerS3({
	s3: s3,
	bucket: BUCKET_NAME,
	metadata: (_, file, cb) => {
		cb(null, { fieldName: file.fieldname });
	},
	key: (req: RequestAny, file, cb) => {
		const key = `user-${req.user.id}/profile/${file.originalname}`;

		if (checkFiletype(file)) {
			cb(null, key);
		} else {
			cb("File format is not valid", key);
		}
	},
});

export const uploadProfile = (
	req: RequestAny,
	res: ResponseAny,
	next: NextFunction,
) => {
	const upload = multer({
		storage: storageEngineProfile,
		limits: { fileSize: 1000000 * 10 },
	}).single("avatar");

	upload(req, res, (err) => {
		if (err) {
			return errorResponse(
				res,
				(err as Error).message,
				StatusCodes.BAD_REQUEST,
				err,
			);
		}

		next();
	});
};

const storageEngineResume: multer.StorageEngine = multerS3({
	s3: s3,
	bucket: BUCKET_NAME,
	metadata: (_, file, cb) => {
		cb(null, { fieldName: file.fieldname });
	},
	key: (_req, file, cb) => {
		const timestamp = Date.now();
		const key = `resumes/${timestamp}-${file.originalname}`;

		if (checkResumeFiletype(file)) {
			cb(null, key);
		} else {
			cb("File format is not valid. Only PDF, DOC, and DOCX files are allowed", key);
		}
	},
});

export const uploadResume = (
	req: RequestAny | Express.Request,
	res: ResponseAny | Express.Response,
	next: NextFunction,
) => {
	const upload = multer({
		storage: storageEngineResume,
		limits: { fileSize: 1000000 * 10 }, // 10MB
	}).single("resume");

	upload(req, res, (err) => {
		if (err) {
			return errorResponse(
				res,
				(err as Error).message,
				StatusCodes.BAD_REQUEST,
				err,
			);
		}

		// After multer processes the file, the form fields are in req.body
		// We need to ensure the file location is available
		if ((req as Express.Request).file && (req as Express.Request).file.location) {
			// The S3 URL is available in req.file.location
			next();
		} else {
			// File is optional, so continue even if no file was uploaded
			next();
		}
	});
};
