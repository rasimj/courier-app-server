import express from "express";
import cors from "cors";
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from "multer";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// --- IN-MEMORY STORAGE ---
let users = [];
let savedTexts = [];
let textIdCounter = 1;

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ msg: 'Username already exists' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = { id: users.length + 1, username, password: hashedPassword };
    users.push(newUser);
    console.log('User registered:', newUser);
    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// --- OCR ROUTES ---
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: "uploads/" });

app.post("/ocr", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file uploaded." });
        }
        const imagePath = path.resolve(req.file.path);
        const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
        
        const newText = {
            _id: textIdCounter++,
            extractedText: text,
            createdAt: new Date().toISOString(),
        };
        savedTexts.unshift(newText);
        fs.unlinkSync(imagePath);
        
        res.json({ message: "Text extracted and saved!", savedText: newText });
        
    } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).json({ error: "OCR failed." });
    }
});

app.get("/texts", async (req, res) => {
    try {
        res.json(savedTexts);
    } catch (error) {
        res.status(500).json({ error: "Could not fetch texts." });
    }
});

// --- START THE SERVER ---
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});