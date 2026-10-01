"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.getMe = getMe;
exports.getSetupStatus = getSetupStatus;
exports.setupInitialAdmin = setupInitialAdmin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_js_1 = require("../models/User.js");
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
