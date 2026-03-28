import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/User';
import { registerSchema, loginSchema } from '../utils/validators';
import { sendSuccess, sendError } from '../utils/response';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'super_secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any,
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const userExists = await User.findOne({ email: validatedData.email });
    if (userExists) {
      return sendError(res, 409, 'User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      role: validatedData.role || UserRole.BUYER
    });

    const token = generateToken(user._id.toString(), user.role);

    // Return profile omitting the password
    sendSuccess(res, 201, 'User registered successfully', {
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return sendError(res, 400, 'Validation error', error.errors);
    }
    sendError(res, 500, 'Server error during registration', error.message);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      return sendError(res, 401, 'Invalid credentials');
    }

    const isMatch = await bcrypt.compare(validatedData.password, user.password!);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid credentials');
    }

    const token = generateToken(user._id.toString(), user.role);

    sendSuccess(res, 200, 'Login successful', {
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return sendError(res, 400, 'Validation error', error.errors);
    }
    sendError(res, 500, 'Server error during login', error.message);
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // req.user is set by the authenticate middleware
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    sendSuccess(res, 200, 'User profile fetched successfully', { user });
  } catch (error: any) {
    sendError(res, 500, 'Error fetching user profile', error.message);
  }
};
