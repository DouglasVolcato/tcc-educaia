import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";

import { appRouter } from "./routes/app.routes";

dotenv.config();

const port = process.env.PORT ?? "3000";
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const viewCandidates = [
  path.join(__dirname, "views"),
  path.join(process.cwd(), "app/src/main/views"),
];

const resolvedViewsPath = viewCandidates.find((candidate) =>
  fs.existsSync(candidate),
);

if (resolvedViewsPath) {
  app.set("views", resolvedViewsPath);
}

const publicCandidates = [
  path.join(__dirname, "..", "public"),
  path.join(process.cwd(), "app/public"),
];

const resolvedPublicPath = publicCandidates.find((candidate) =>
  fs.existsSync(candidate),
);

if (resolvedPublicPath) {
  app.use("/static", express.static(resolvedPublicPath));
}

app.set("view engine", "ejs");
app.disable("x-powered-by");

app.get("/", (_req, res) => {
  res.redirect("/app/login");
});

app.use("/app", appRouter);

app.listen(port, () => {
  console.log(`Server running on ${process.env.SERVER_DOMAIN}`);
  console.log(`Documentation on ${process.env.SERVER_DOMAIN}/docs`);
  console.log(`Client on ${process.env.SERVER_DOMAIN}/client`);
});