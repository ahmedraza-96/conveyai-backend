import { describe, expect, it } from "vitest";
import {
  checkFiletype,
  checkResumeFiletype,
} from "../utils/common.utils";

const makeFile = (
  originalname: string,
  mimetype: string,
): Express.Multer.File =>
  ({
    originalname,
    mimetype,
  }) as Express.Multer.File;

describe("common.utils", () => {
  describe("checkFiletype (image uploads)", () => {
    it("accepts a .jpg / image/jpeg file", () => {
      expect(checkFiletype(makeFile("avatar.jpg", "image/jpeg"))).toBe(true);
    });

    it("accepts a .png / image/png file", () => {
      expect(checkFiletype(makeFile("avatar.png", "image/png"))).toBe(true);
    });

    it("rejects a PDF", () => {
      expect(checkFiletype(makeFile("doc.pdf", "application/pdf"))).toBe(false);
    });

    it("rejects mime/extension mismatch", () => {
      expect(checkFiletype(makeFile("avatar.jpg", "application/pdf"))).toBe(
        false,
      );
    });
  });

  describe("checkResumeFiletype", () => {
    it("accepts a .pdf / application/pdf file", () => {
      expect(checkResumeFiletype(makeFile("cv.pdf", "application/pdf"))).toBe(
        true,
      );
    });

    it("accepts a .docx / officedocument file", () => {
      expect(
        checkResumeFiletype(
          makeFile(
            "cv.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ),
        ),
      ).toBe(true);
    });

    it("accepts a .doc / application/msword file", () => {
      expect(
        checkResumeFiletype(makeFile("cv.doc", "application/msword")),
      ).toBe(true);
    });

    it("rejects an image", () => {
      expect(checkResumeFiletype(makeFile("photo.jpg", "image/jpeg"))).toBe(
        false,
      );
    });

    it("rejects mime/extension mismatch", () => {
      expect(
        checkResumeFiletype(makeFile("cv.pdf", "image/jpeg")),
      ).toBe(false);
    });
  });
});
