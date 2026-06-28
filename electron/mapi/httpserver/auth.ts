import type { Request, Response, NextFunction } from "express";

export const authMiddleware = (token: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const auth = req.headers["authorization"] || "";
        if (!auth.startsWith("Bearer ") || auth.slice(7) !== token) {
            res.status(401).json({ code: -1, msg: "Unauthorized" });
            return;
        }
        next();
    };
};
