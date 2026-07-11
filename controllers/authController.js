const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/generateTokens");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Send User Data
const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  skills: user.skills,
  githubLink: user.githubLink,
  createdAt: user.createdAt,
});

// Generate Tokens
const createTokens = async (user, res) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("refreshToken", refreshToken, cookieOptions);

  return accessToken;
};

// ================= Register =================

const register = async (req, res, next) => {
  try {
    let { name, email, password } = req.body;

    email = email.toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    const accessToken = await createTokens(user, res);

    res.status(201).json({
      accessToken,
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// ================= Login =================

const login = async (req, res, next) => {
  try {
    let { email, password } = req.body;

    email = email.toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and Password are required",
      });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        message: "Invalid Credentials",
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid Credentials",
      });
    }

    const accessToken = await createTokens(user, res);

    res.json({
      accessToken,
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// ================= Refresh Token =================

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        message: "Refresh Token Missing",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(decoded.userId).select("+refreshToken");

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({
        message: "Invalid Refresh Token",
      });
    }

    const accessToken = generateAccessToken(user._id);

    res.json({
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// ================= Logout =================

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await User.updateOne(
        { refreshToken: token },
        {
          $set: {
            refreshToken: null,
          },
        }
      );
    }

    res.clearCookie("refreshToken", cookieOptions);

    res.json({
      message: "Logout Successful",
    });
  } catch (error) {
    next(error);
  }
};

// ================= Current User =================

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User Not Found",
      });
    }

    res.json({
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
};