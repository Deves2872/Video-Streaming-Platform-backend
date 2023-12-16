import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; //For managing and performing CRUD operations on Cookies

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "16kb",
  })
); //For Managing JSON in request
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
); //For Managing Encoded URL's
app.use(express.static("public")); //Manage Static assets
app.use(cookieParser());

export { app };
