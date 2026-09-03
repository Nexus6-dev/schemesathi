const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SchemeSaathi backend is working"
  });
});

app.listen(PORT, () => {
  console.log(
    `Backend running at http://localhost:${PORT}`
  );
});