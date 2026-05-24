import { GetObjectCommand } from "@aws-sdk/client-s3";
import mammoth from "mammoth";
import s3, { BUCKET_NAME } from "../../lib/aws.service";

/**
 * Fetches a resume file from S3 and returns it as a Buffer
 */
export const fetchResumeBuffer = async (s3Url: string): Promise<Buffer> => {
	try {
		// Extract the S3 key from the URL
		// Expected format: https://bucket-name.s3.region.amazonaws.com/key
		// or s3://bucket-name/key
		let key: string;

		if (s3Url.startsWith("s3://")) {
			// Format: s3://bucket-name/key
			key = s3Url.replace(`s3://${BUCKET_NAME}/`, "");
		} else if (s3Url.includes(".s3.")) {
			// Format: https://bucket-name.s3.region.amazonaws.com/key
			const urlParts = s3Url.split(".amazonaws.com/");
			key = urlParts[1] || "";
		} else {
			// Assume it's just the key
			key = s3Url;
		}

		if (!key) {
			throw new Error("Invalid S3 URL format");
		}

		const command = new GetObjectCommand({
			Bucket: BUCKET_NAME,
			Key: key,
		});

		const response = await s3.send(command);

		if (!response.Body) {
			throw new Error("No body in S3 response");
		}

		// Convert the readable stream to a buffer
		const chunks: Uint8Array[] = [];
		const stream = response.Body as AsyncIterable<Uint8Array>;
		for await (const chunk of stream) {
			chunks.push(chunk);
		}

		return Buffer.concat(chunks);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to fetch resume from S3: ${error.message}`);
		}
		throw new Error("Failed to fetch resume from S3");
	}
};

/**
 * Extracts text content from a resume file (PDF or DOCX)
 * For PDF files, uses the S3 URL directly with PDFParse class
 * For DOCX files, requires the buffer
 */
export const extractResumeText = async (
	filename: string,
	buffer: Buffer,
	s3Url?: string,
): Promise<string> => {
	try {
		const extension = filename.toLowerCase().split(".").pop();

		if (extension === "pdf") {
			// pdf-parse v4.x: Use PDFParse class with URL (preferred) or buffer
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { PDFParse } = require("pdf-parse");
			
			let parser;
			if (s3Url) {
				// Use S3 URL directly if available (more efficient)
				parser = new PDFParse({ url: s3Url });
			} else {
				// Fallback to buffer if URL not provided
				parser = new PDFParse({ data: buffer });
			}
			
			const result = await parser.getText();
			return result.text.trim();
		}

		if (extension === "docx" || extension === "doc") {
			const result = await mammoth.extractRawText({ buffer });
			return result.value.trim();
		}

		throw new Error(
			`Unsupported file format: ${extension}. Only PDF, DOC, and DOCX are supported.`,
		);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to extract text from resume: ${error.message}`);
		}
		throw new Error("Failed to extract text from resume");
	}
};
