import 'module-alias/register.js';
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({
    path: "./.env"
});
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path_1.default.join(rootDir, "src", "main", "views"));
app.use("/static", express_1.default.static(path_1.default.join(rootDir, "src", "main", "public")));
app.disable("x-powered-by");
app.get("/", (req, res) => {
    res.redirect("/app/login");
});
app.use("/app", app_routes_1.appRouter);
app.listen(port, () => {
    console.log(`Server running on ${process.env.API_URL || "http://localhost:3000"}`);
    console.log(`Documentation on ${process.env.API_URL}/docs`);
    console.log(`Client on ${process.env.API_URL}/client`);
});
