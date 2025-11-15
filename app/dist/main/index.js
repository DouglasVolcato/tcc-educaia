"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app_routes_1 = require("./routes/app.routes");
dotenv_1.default.config();
const port = process.env.PORT ?? "3000";
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const viewCandidates = [
    path_1.default.join(__dirname, "views"),
    path_1.default.join(process.cwd(), "app/src/main/views"),
];
const resolvedViewsPath = viewCandidates.find((candidate) => fs_1.default.existsSync(candidate));
if (resolvedViewsPath) {
    app.set("views", resolvedViewsPath);
}
const publicCandidates = [
    path_1.default.join(__dirname, "..", "public"),
    path_1.default.join(process.cwd(), "app/public"),
];
const resolvedPublicPath = publicCandidates.find((candidate) => fs_1.default.existsSync(candidate));
if (resolvedPublicPath) {
    app.use("/static", express_1.default.static(resolvedPublicPath));
}
app.set("view engine", "ejs");
app.disable("x-powered-by");
app.get("/", (_req, res) => {
    res.redirect("/app/login");
});
app.use("/app", app_routes_1.appRouter);
app.listen(port, () => {
    console.log(`Server running on ${process.env.SERVER_DOMAIN}`);
    console.log(`Documentation on ${process.env.SERVER_DOMAIN}/docs`);
    console.log(`Client on ${process.env.SERVER_DOMAIN}/client`);
});
