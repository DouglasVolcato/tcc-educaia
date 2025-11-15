import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

import { appRouter } from "./routes/app.routes";

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
const rootDir = path.resolve(__dirname, "..", "..");

app.locals.brand = "EducaIA";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "src", "main", "views"));
app.use("/static", express.static(path.join(rootDir, "src", "main", "public")));
app.disable("x-powered-by");

app.get("/", (req, res) => {
  res.redirect("/app/login");
});

app.use("/app", appRouter);

app.listen(port, () => {
  console.log(`Server running on ${process.env.SERVER_DOMAIN}`);
  console.log(`Documentation on ${process.env.SERVER_DOMAIN}/docs`);
  console.log(`Client on ${process.env.SERVER_DOMAIN}/client`);
});
