import { S3Client } from "@aws-sdk/client-s3";
import config from "../config/config.service";

export const BUCKET_NAME = config.AWS_S3_BUCKET_NAME;

const s3 = new S3Client({
	region: config.AWS_REGION,
	credentials: {
		accessKeyId: config.AWS_ACCESS_KEY_ID,
		secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
	},
});

export default s3;
