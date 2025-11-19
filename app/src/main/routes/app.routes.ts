import { Application } from "express";
import { AppController } from "../controllers/app.controller.ts";

export const registerAppRoutes = (app: Application) => new AppController(app);
