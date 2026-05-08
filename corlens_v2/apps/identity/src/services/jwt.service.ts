import { identity } from "@corlens/contracts";
import jwt from "jsonwebtoken";

export type JwtServiceOptions = {
  secret: string;
  ttlSeconds: number;
};

export type JwtService = {
  sign(payload: identity.JwtPayload): string;
  verify(token: string): identity.JwtPayload;
};

export function createJwtService(opts: JwtServiceOptions): JwtService {
  return {
    sign(payload) {
      return jwt.sign(payload, opts.secret, {
        algorithm: "HS256",
        expiresIn: opts.ttlSeconds,
      });
    },
    verify(token) {
      const decoded = jwt.verify(token, opts.secret, { algorithms: ["HS256"] });
      const result = identity.JwtPayload.safeParse(decoded);
      if (!result.success) {
        throw new Error(`Invalid JWT payload: ${result.error.message}`);
      }
      return result.data;
    },
  };
}
