import dotenv from "dotenv";
dotenv.config({ path: "../../../.env" });
import { migrate } from "./database";
migrate().catch((err) => { console.error(err); process.exit(1); });
