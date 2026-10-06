"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.getMe = getMe;
exports.getUsers = getUsers;
exports.updateUserRole = updateUserRole;
exports.updateUserDetails = updateUserDetails;
exports.deleteUser = deleteUser;
exports.changePassword = changePassword;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.getSetupStatus = getSetupStatus;
exports.setupInitialAdmin = setupInitialAdmin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_js_1 = require("../models/User.js");
const email_service_js_1 = require("../services/email.service.js");
async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, error: 'Email and password are required.' });
            return;
        }
        const user = await User_js_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !user.isActive) {
            res.status(401).json({ success: false, error: 'Invalid email or password.' });
            return;
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ success: false, error: 'Invalid email or password.' });
            return;
        }
        const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_pixelflames_2026_finance';
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        const token = jsonwebtoken_1.default.sign({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            name: user.name,
        }, secret, { expiresIn: expiresIn });
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                title: user.title,
                organizationId: user.organizationId,
                avatarColor: user.avatarColor,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Login failed.' });
    }
}
async function register(req, res) {
    try {
        const { name, email, password, role, title } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
            return;
        }
        const existing = await User_js_1.User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const newUser = await User_js_1.User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role: role || 'VIEWER',
            title: title || 'Staff Member',
            organizationId: 'org_pixelflames_001',
            avatarColor: 'bg-slate-700',
        });
        res.status(201).json({
            success: true,
            data: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                title: newUser.title,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Registration failed.' });
    }
}
async function getMe(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Unauthorized.' });
            return;
        }
        const user = await User_js_1.User.findById(req.user.userId).select('-passwordHash');
        if (!user) {
            res.status(404).json({ success: false, error: 'User not found.' });
            return;
        }
        res.json({ success: true, data: user });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to fetch user.' });
    }
}
async function getUsers(req, res) {
    try {
        const orgId = req.user?.organizationId || 'org_pixelflames_001';
        const users = await User_js_1.User.find({ organizationId: orgId, isActive: true })
            .select('-passwordHash')
            .sort({ createdAt: 1 });
        res.json({ success: true, data: users });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to fetch users.' });
    }
}
async function updateUserRole(req, res) {
    try {
        const { id } = req.params;
        const { role, title } = req.body;
        const VALID_ROLES = ['OWNER', 'ACCOUNTANT', 'SALES', 'VIEWER'];
        if (!role || !VALID_ROLES.includes(role)) {
            res.status(400).json({
                success: false,
                error: `Invalid role specified. Valid roles are: ${VALID_ROLES.join(', ')}.`,
            });
            return;
        }
        const targetUser = await User_js_1.User.findById(id);
        if (!targetUser) {
            res.status(404).json({ success: false, error: 'User not found.' });
            return;
        }
        // Strict protection: An administrator cannot modify their own role
        if (req.user?.userId === id || req.user?.userId === targetUser._id.toString()) {
            res.status(403).json({
                success: false,
                error: 'Administrators cannot modify their own role. Your administrator account is protected.',
            });
            return;
        }
        // Safety check: Prevent sole OWNER from demoting themselves
        if (targetUser.role === 'OWNER' && role !== 'OWNER') {
            const ownerCount = await User_js_1.User.countDocuments({
                organizationId: targetUser.organizationId,
                role: 'OWNER',
                isActive: true,
            });
            if (ownerCount <= 1) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot demote the only administrator. Assign another administrator before changing this role.',
                });
                return;
            }
        }
        targetUser.role = role;
        if (title && typeof title === 'string') {
            targetUser.title = title.trim();
        }
        await targetUser.save();
        res.json({
            success: true,
            message: `User role successfully updated to ${role}.`,
            data: {
                id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                title: targetUser.title,
                avatarColor: targetUser.avatarColor,
                isActive: targetUser.isActive,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to update user role.' });
    }
}
async function updateUserDetails(req, res) {
    try {
        const { id } = req.params;
        const { name, email, role, title, password } = req.body;
        const targetUser = await User_js_1.User.findById(id);
        if (!targetUser) {
            res.status(404).json({ success: false, error: 'User not found.' });
            return;
        }
        const isSelf = req.user?.userId === id || req.user?.userId === targetUser._id.toString();
        // If changing role
        if (role && role !== targetUser.role) {
            if (isSelf) {
                res.status(403).json({
                    success: false,
                    error: 'Administrators cannot modify their own role. Your administrator account is protected.',
                });
                return;
            }
            const VALID_ROLES = ['OWNER', 'ACCOUNTANT', 'SALES', 'VIEWER'];
            if (!VALID_ROLES.includes(role)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid role specified. Valid roles are: ${VALID_ROLES.join(', ')}.`,
                });
                return;
            }
            if (targetUser.role === 'OWNER' && role !== 'OWNER') {
                const ownerCount = await User_js_1.User.countDocuments({
                    organizationId: targetUser.organizationId,
                    role: 'OWNER',
                    isActive: true,
                });
                if (ownerCount <= 1) {
                    res.status(400).json({
                        success: false,
                        error: 'Cannot demote the only administrator. Assign another administrator before changing this role.',
                    });
                    return;
                }
            }
            targetUser.role = role;
        }
        if (name && typeof name === 'string' && name.trim()) {
            targetUser.name = name.trim();
        }
        if (email && typeof email === 'string' && email.trim().toLowerCase() !== targetUser.email) {
            const cleanEmail = email.trim().toLowerCase();
            const existing = await User_js_1.User.findOne({ email: cleanEmail, _id: { $ne: targetUser._id } });
            if (existing) {
                res.status(400).json({ success: false, error: 'Email address is already in use by another team member.' });
                return;
            }
            targetUser.email = cleanEmail;
        }
        if (title !== undefined && typeof title === 'string') {
            targetUser.title = title.trim();
        }
        // Optional admin password reset for team member
        if (password && typeof password === 'string' && password.trim().length > 0) {
            if (password.trim().length < 8) {
                res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
                return;
            }
            const salt = await bcryptjs_1.default.genSalt(12);
            targetUser.passwordHash = await bcryptjs_1.default.hash(password.trim(), salt);
        }
        await targetUser.save();
        res.json({
            success: true,
            message: 'User details successfully updated.',
            data: {
                id: targetUser._id.toString(),
                _id: targetUser._id.toString(),
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                title: targetUser.title,
                avatarColor: targetUser.avatarColor,
                isActive: targetUser.isActive,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to update user details.' });
    }
}
async function deleteUser(req, res) {
    try {
        const { id } = req.params;
        const targetUser = await User_js_1.User.findById(id);
        if (!targetUser) {
            res.status(404).json({ success: false, error: 'User not found.' });
            return;
        }
        // Strict protection: An administrator cannot delete their own account
        if (req.user?.userId === id || req.user?.userId === targetUser._id.toString()) {
            res.status(403).json({
                success: false,
                error: 'Administrators cannot delete their own account.',
            });
            return;
        }
        // Safety check: Prevent deleting sole OWNER
        if (targetUser.role === 'OWNER') {
            const ownerCount = await User_js_1.User.countDocuments({
                organizationId: targetUser.organizationId,
                role: 'OWNER',
                isActive: true,
            });
            if (ownerCount <= 1) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete the only administrator account.',
                });
                return;
            }
        }
        await User_js_1.User.findByIdAndDelete(id);
        res.json({
            success: true,
            message: `User ${targetUser.name} (${targetUser.email}) successfully removed.`,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to delete user.' });
    }
}
async function changePassword(req, res) {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ success: false, error: 'Unauthorized.' });
            return;
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, error: 'Current password and new password are required.' });
            return;
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
            return;
        }
        const user = await User_js_1.User.findById(req.user.userId);
        if (!user) {
            res.status(404).json({ success: false, error: 'User not found.' });
            return;
        }
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(400).json({ success: false, error: 'Incorrect current password.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(12);
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        await user.save();
        res.json({
            success: true,
            message: 'Password successfully changed.',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to change password.' });
    }
}
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            res.status(400).json({ success: false, error: 'A valid email address is required.' });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const user = await User_js_1.User.findOne({ email: cleanEmail, isActive: true });
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'No active user account found with that email address.',
            });
            return;
        }
        // Generate a secure 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryMinutes = 15;
        user.resetPasswordCode = verificationCode;
        user.resetPasswordExpires = new Date(Date.now() + expiryMinutes * 60 * 1000);
        await user.save();
        // Option A: Send branded transactional email via Brevo API
        const emailResult = await (0, email_service_js_1.sendPasswordResetEmail)(user.email, user.name, verificationCode, expiryMinutes);
        // Fallback log to terminal for convenience / testing
        console.log('\n======================================================');
        console.log(' [PASSWORD RESET VERIFICATION CODE]');
        console.log(` Target User:       ${user.name} (${user.email})`);
        console.log(` 6-Digit OTP Code:  ${verificationCode}`);
        console.log(` Validity:          ${expiryMinutes} minutes`);
        console.log(` Brevo Delivery:    ${emailResult.deliveredVia === 'brevo' ? 'SENT via Brevo API (Message ID: ' + emailResult.messageId + ')' : 'Console Fallback (Set BREVO_API_KEY in server/.env)'}`);
        console.log('======================================================\n');
        res.json({
            success: true,
            message: emailResult.deliveredVia === 'brevo'
                ? `A 6-digit verification code has been sent to your email (${user.email}) via Brevo.`
                : `A 6-digit verification code has been generated for ${user.email}.`,
            deliveredVia: emailResult.deliveredVia,
            devCode: emailResult.deliveredVia === 'console_fallback' || process.env.NODE_ENV !== 'production' ? verificationCode : undefined,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to process forgot password request.' });
    }
}
async function resetPassword(req, res) {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            res.status(400).json({
                success: false,
                error: 'Email address, verification code, and new password are required.',
            });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanCode = code.toString().trim();
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            res.status(400).json({
                success: false,
                error: 'New password must be at least 8 characters long.',
            });
            return;
        }
        const user = await User_js_1.User.findOne({ email: cleanEmail, isActive: true });
        if (!user) {
            res.status(404).json({ success: false, error: 'User account not found.' });
            return;
        }
        if (!user.resetPasswordCode || user.resetPasswordCode !== cleanCode) {
            res.status(400).json({ success: false, error: 'Invalid verification code.' });
            return;
        }
        if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
            res.status(400).json({
                success: false,
                error: 'Verification code has expired. Please request a new code.',
            });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(12);
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        console.log(`[AUTH] Password successfully reset for user ${user.email}`);
        res.json({
            success: true,
            message: 'Password has been successfully reset! You can now log in with your new password.',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Failed to reset password.' });
    }
}
async function getSetupStatus(req, res) {
    try {
        const ownerCount = await User_js_1.User.countDocuments({ role: 'OWNER' });
        res.json({
            success: true,
            setupRequired: ownerCount === 0,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function setupInitialAdmin(req, res) {
    try {
        const ownerCount = await User_js_1.User.countDocuments({ role: 'OWNER' });
        if (ownerCount > 0) {
            res.status(403).json({
                success: false,
                error: 'Initial administrator is already configured. This setup endpoint is locked.',
            });
            return;
        }
        const { name, email, password, companyName } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
            return;
        }
        if (typeof password !== 'string' || password.length < 8) {
            res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(12);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const admin = await User_js_1.User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role: 'OWNER',
            title: 'Managing Director & Administrator',
            organizationId: 'org_pixelflames_001',
            avatarColor: 'bg-emerald-600',
        });
        // Auto-initialize standard statutory UAE VAT rates if none exist
        const { VatRate } = await import('../models/VatRate.js');
        const vatCount = await VatRate.countDocuments();
        if (vatCount === 0) {
            await VatRate.create([
                {
                    organizationId: admin.organizationId,
                    name: 'Standard Rate (5%)',
                    ratePercentage: 5.0,
                    treatment: 'STANDARD_RATED',
                    ftaCode: 'SR-5',
                    description: 'Standard rated supplies under Article 3 of UAE VAT Law',
                    isDefault: true,
                    isActive: true,
                },
                {
                    organizationId: admin.organizationId,
                    name: 'Zero Rated (0%)',
                    ratePercentage: 0.0,
                    treatment: 'ZERO_RATED',
                    ftaCode: 'ZR-0',
                    description: 'Zero rated exports and qualifying international transport',
                    isDefault: false,
                    isActive: true,
                },
                {
                    organizationId: admin.organizationId,
                    name: 'Exempt (0%)',
                    ratePercentage: 0.0,
                    treatment: 'EXEMPT',
                    ftaCode: 'EX-0',
                    description: 'Exempt financial services and bare land transactions',
                    isDefault: false,
                    isActive: true,
                },
            ]);
        }
        // Auto-initialize standard payment methods if none exist
        const { PaymentMethod } = await import('../models/PaymentMethod.js');
        const pmtCount = await PaymentMethod.countDocuments();
        if (pmtCount === 0) {
            await PaymentMethod.create([
                {
                    organizationId: admin.organizationId,
                    code: 'BANK_TRANSFER',
                    name: 'Bank Transfer (EFT)',
                    description: 'Direct wire / IBAN transfer',
                    requiresReference: true,
                    isActive: true,
                },
                {
                    organizationId: admin.organizationId,
                    code: 'CASH',
                    name: 'Cash',
                    description: 'Direct cash collection with official receipt',
                    requiresReference: false,
                    isActive: true,
                },
                {
                    organizationId: admin.organizationId,
                    code: 'CREDIT_CARD',
                    name: 'Credit Card',
                    description: 'Visa / MasterCard / AMEX payment gateway',
                    requiresReference: true,
                    isActive: true,
                },
                {
                    organizationId: admin.organizationId,
                    code: 'CHEQUE',
                    name: 'Cheque',
                    description: 'Company cheque deposit',
                    requiresReference: true,
                    isActive: true,
                },
            ]);
        }
        // Auto-initialize clean Company Settings if none exist
        const { CompanySettings } = await import('../models/CompanySettings.js');
        const companyCount = await CompanySettings.countDocuments();
        if (companyCount === 0) {
            await CompanySettings.create({
                organizationId: admin.organizationId,
                companyNameEn: companyName?.trim() || 'My Company LLC',
                trn: '100000000000003',
                tradeLicenseNumber: 'TL-00000',
                email: admin.email,
                phone: '+971 4 000 0000',
                addressEn: {
                    city: 'Dubai',
                    emirate: 'DUBAI',
                    country: 'United Arab Emirates',
                },
                currency: 'AED',
                invoicePrefix: 'INV',
                quotePrefix: 'QUO',
                creditNotePrefix: 'CN',
                paymentPrefix: 'PAY',
                defaultPaymentTermsDays: 30,
            });
        }
        const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_pixelflames_2026_finance';
        const token = jsonwebtoken_1.default.sign({
            userId: admin._id.toString(),
            email: admin.email,
            role: admin.role,
            organizationId: admin.organizationId,
            name: admin.name,
        }, secret, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
        res.status(201).json({
            success: true,
            message: 'Initial administrator account and clean statutory parameters successfully established.',
            token,
            user: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                title: admin.title,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
