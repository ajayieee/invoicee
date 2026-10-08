import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'SALES' | 'VIEWER';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  title: string;
  role: UserRole;
  organizationId: string;
  avatarColor: string;
  isActive: boolean;
  resetPasswordCode?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    title: { type: String, default: 'Staff Member' },
    role: {
      type: String,
      enum: ['OWNER', 'ADMIN', 'ACCOUNTANT', 'SALES', 'VIEWER'],
      default: 'VIEWER',
    },
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    avatarColor: { type: String, default: 'bg-emerald-600' },
    isActive: { type: Boolean, default: true },
    resetPasswordCode: { type: String },
    resetPasswordExpires: { type: Date },
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
