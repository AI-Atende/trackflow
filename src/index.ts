import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import metaRoutes from "./routes/meta.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/admin", adminRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
