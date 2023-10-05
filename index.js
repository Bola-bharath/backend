const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "sampledata.db");

let db = null;

const serverStart = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(8000, () => {
      console.log("Server Running");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

serverStart();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dataUser = await db.get(selectUserQuery);
  if (dataUser === undefined) {
    const insertUserQuery = `
        INSERT INTO 
          user (username,password) 
        VALUES 
          (
            '${username}', 
            '${hashedPassword}'
          )`;
    const dbResponse = await db.run(insertUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.json({ message: "User already exists" });
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dataUser = await db.get(selectUserQuery);
  if (dataUser === undefined) {
    response.status(400);
    response.json({ error_msg: "Invalid User" });
  } else {
    const passwordMatched = await bcrypt.compare(password, dataUser.password);
    if (passwordMatched === true) {
      const payload = {
        username: username,
      };
      const jwt_token = jwt.sign(payload, "SECRET");
      response.send({ jwt_token });
    } else {
      response.status(400);
      response.json({ error_msg: "Invalid Password" });
    }
  }
});

app.get("/profile/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  response.send(userDetails);
});
