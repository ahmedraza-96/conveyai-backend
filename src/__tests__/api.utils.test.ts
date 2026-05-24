import { StatusCodes } from "http-status-codes";
import { describe, expect, it, vi } from "vitest";
import { errorResponse, successResponse } from "../utils/api.utils";

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

const makeRes = (): MockRes => {
  const res: MockRes = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe("api.utils", () => {
  describe("successResponse", () => {
    it("returns a 200 envelope with success=true and the payload", () => {
      const res = makeRes();
      successResponse(res as never, "ok", { foo: "bar" });

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "ok",
        data: { foo: "bar" },
      });
    });

    it("respects a custom status code", () => {
      const res = makeRes();
      successResponse(res as never, "created", { id: 1 }, StatusCodes.CREATED);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    });
  });

  describe("errorResponse", () => {
    it("defaults to BAD_REQUEST and emits success=false envelope", () => {
      const res = makeRes();
      errorResponse(res as never, "bad input");

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "bad input",
        }),
      );
    });

    it("uses the provided status and includes the payload", () => {
      const res = makeRes();
      errorResponse(res as never, "not found", StatusCodes.NOT_FOUND, {
        id: "x",
      });

      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "not found",
          data: { id: "x" },
        }),
      );
    });
  });
});
