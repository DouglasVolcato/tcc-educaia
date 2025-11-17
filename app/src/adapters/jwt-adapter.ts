import jwt, { JwtPayload } from "jsonwebtoken";

export interface TokenPayload extends JwtPayload {
  userId: string;
}

export class JwtAdapter {
  private readonly secret: string;

  public constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not defined");
    }
    this.secret = secret;
  }

  public generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: "1h" });
  }

  public verifyToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.secret);
    if (typeof decoded === "string" || !("userId" in decoded)) {
      throw new Error("Invalid token payload");
    }
    return decoded as TokenPayload;
  }
}
