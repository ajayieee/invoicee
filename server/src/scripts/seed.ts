import dns from 'dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Ensure Node.js c-ares uses public DNS resolvers if Windows defaults to loopback (127.0.0.1)
try {
  const currentServers = dns.getServers();
  if (!currentServers.length || currentServers.every((ip) => ip === '127.0.0.1')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

import { User } from '../models/User.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { VatRate } from '../models/VatRate.js';
import { PaymentMethod } from '../models/PaymentMethod.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { CreditNote } from '../models/CreditNote.js';
import { Quote } from '../models/Quote.js';
import { AuditLog } from '../models/AuditLog.js';

dotenv.config();

async function runSeed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/uae_invoicing';
  const maskedUri = uri.replace(/\/\/.*@/, '//<credentials>@');

  console.log(`Connecting to MongoDB at: ${maskedUri}`);

  // Safeguard 1: Block accidental execution in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  const hasForceFlag = process.argv.includes('--force-production-seed');
  if (isProduction && !hasForceFlag) {
    console.error(`
🚨 ==============================================================
❌ SEED ABORTED: Attempting to run demo seed script in PRODUCTION mode!
To prevent catastrophic data loss, seeding is blocked in production.
If you strictly intend to seed this database, provide both:
  --force-production-seed flag
  CONFIRM_DESTRUCTIVE_SEED=true in environment variables
==============================================================
    `);
    process.exit(1);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    dbName: process.env.MONGODB_DB_NAME || 'uae_invoicing',
  });
  console.log('✅ Connected to MongoDB.');

  // Safeguard 2: Guard against destructive overwrite of existing database
  const existingUsers = await User.countDocuments();
  const existingInvoices = await Invoice.countDocuments();

  if (existingUsers > 0 || existingInvoices > 0) {
    const isConfirmed =
      process.env.ALLOW_DESTRUCTIVE_SEED === 'true' ||
      process.argv.includes('--confirm-reset');

    if (!isConfirmed) {
      console.error(`
⚠️ ==============================================================
❌ RESEED ABORTED: Existing Data Detected!
The target database already contains:
  • ${existingUsers} User account(s)
  • ${existingInvoices} Tax Invoice(s)

Destructive resetting is locked by default to prevent accidental data loss.
To confirm that you want to purge all existing records and re-seed with demo data:
  Run: npm run seed -- --confirm-reset
  Or set: ALLOW_DESTRUCTIVE_SEED=true in server/.env
==============================================================
      `);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  console.log('🧹 Purging existing collections per confirmation...');
  await Promise.all([
    User.deleteMany({}),
    CompanySettings.deleteMany({}),
    VatRate.deleteMany({}),
    PaymentMethod.deleteMany({}),
    Customer.deleteMany({}),
    Product.deleteMany({}),
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
    CreditNote.deleteMany({}),
    Quote.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('🧹 Collections cleared.');

  // 1. Resolve Secure Credentials
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@pixelflames.com';
  let adminPassword = process.env.SEED_ADMIN_PASSWORD;
  let isGeneratedAdminPass = false;

  if (!adminPassword || !adminPassword.trim()) {
    // Generate cryptographically secure random 16-character password
    adminPassword = crypto.randomBytes(12).toString('base64url');
    isGeneratedAdminPass = true;
  }

  const staffPassword = process.env.SEED_STAFF_PASSWORD || crypto.randomBytes(12).toString('base64url');

  // Hash all passwords using bcrypt (12 salt rounds for production-grade security)
  const saltRounds = 12;
  const adminHash = await bcrypt.hash(adminPassword, saltRounds);
  const staffHash = await bcrypt.hash(staffPassword, saltRounds);

  // 2. Seed Users
  const [adminUser, accountantUser, salesUser] = await User.create([
    {
      name: 'Tariq Mansour [DEMO ADMIN]',
      email: adminEmail.toLowerCase().trim(),
      passwordHash: adminHash,
      title: 'Managing Director & Administrator',
      role: 'OWNER',
      organizationId: 'org_pixelflames_001',
      avatarColor: 'bg-emerald-600',
    },
    {
      name: 'Sarah Al-Nuaimi [DEMO ACCOUNTANT]',
      email: 'sarah.nuaimi@pixelflames.com',
      passwordHash: staffHash,
      title: 'Senior Financial Controller',
      role: 'ACCOUNTANT',
      organizationId: 'org_pixelflames_001',
      avatarColor: 'bg-sky-600',
    },
    {
      name: 'Khalid Al-Hashimi [DEMO SALES]',
      email: 'khalid.hashimi@pixelflames.com',
      passwordHash: staffHash,
      title: 'Corporate Sales Director',
      role: 'SALES',
      organizationId: 'org_pixelflames_001',
      avatarColor: 'bg-amber-600',
    },
  ]);
  console.log('👤 Created 3 initial development/demo accounts.');

  // 3. Seed Company Settings
  await CompanySettings.create({
    organizationId: 'org_pixelflames_001',
    companyNameEn: 'PixelFlames LLC',
    companyNameAr: 'شركة بكسل فليمز ذ.م.م',
    trn: '100000000000003',
    legalForm: 'Limited Liability Company (LLC)',
    tradeLicenseNumber: 'CN-1029384',
    taxRegistrationDate: '2018-01-01',
    email: 'billing@pixelflames.com',
    phone: '+971 4 388 9000',
    website: 'https://pixelflames.com',
    addressEn: {
      building: 'Level 14, Al Saada Tower',
      street: 'Sheikh Zayed Road, Trade Centre 1',
      city: 'Dubai',
      emirate: 'DUBAI',
      poBox: '94200',
      country: 'United Arab Emirates',
    },
    currency: 'AED',
    bankAccounts: [
      {
        bankName: 'Emirates NBD',
        accountName: 'PixelFlames LLC',
        accountNumber: '1029384756',
        iban: 'AE290260001029384756001',
        swiftBic: 'EBILAEADXXX',
        currency: 'AED',
        isPrimary: true,
      },
      {
        bankName: 'Abu Dhabi Commercial Bank (ADCB)',
        accountName: 'PixelFlames LLC',
        accountNumber: '9948201948',
        iban: 'AE550230009948201948001',
        swiftBic: 'ADCBAEAAXXX',
        currency: 'AED',
        isPrimary: false,
      },
    ],
    invoicePrefix: 'INV',
    quotePrefix: 'QUO',
    creditNotePrefix: 'CN',
    paymentPrefix: 'PAY',
    defaultPaymentTermsDays: 30,
    defaultNotes: 'Thank you for choosing PixelFlames. All fees in AED subject to 5% VAT in accordance with UAE Federal Decree-Law No. (8) of 2017.',
    defaultTerms: 'Payment due within 30 days of invoice date. Remittances must reference the invoice number.',
  });
  console.log('🏢 Seeded Company Settings.');

  // 4. Seed Statutory VAT Rates
  const [vatStandard, vatZero, vatExempt] = await VatRate.create([
    {
      organizationId: 'org_pixelflames_001',
      name: 'Standard Rate (5%)',
      ratePercentage: 5.0,
      treatment: 'STANDARD_RATED',
      ftaCode: 'SR-5',
      description: 'Standard rated supplies under Article 3 of UAE VAT Law',
      isDefault: true,
      isActive: true,
    },
    {
      organizationId: 'org_pixelflames_001',
      name: 'Zero Rated (0%)',
      ratePercentage: 0.0,
      treatment: 'ZERO_RATED',
      ftaCode: 'ZR-0',
      description: 'Zero rated exports and qualifying international transport',
      isDefault: false,
      isActive: true,
    },
    {
      organizationId: 'org_pixelflames_001',
      name: 'Exempt (0%)',
      ratePercentage: 0.0,
      treatment: 'EXEMPT',
      ftaCode: 'EX-0',
      description: 'Exempt financial services and bare land transactions',
      isDefault: false,
      isActive: true,
    },
  ]);
  console.log('🧾 Seeded Statutory VAT Rates.');

  // 5. Seed Payment Methods
  const [bankTransferMethod, cashMethod, cardMethod, chequeMethod] = await PaymentMethod.create([
    {
      organizationId: 'org_pixelflames_001',
      code: 'BANK_TRANSFER',
      name: 'Bank Transfer (EFT)',
      description: 'Direct wire / IBAN transfer',
      requiresReference: true,
      isActive: true,
    },
    {
      organizationId: 'org_pixelflames_001',
      code: 'CASH',
      name: 'Cash',
      description: 'Direct cash collection with official receipt',
      requiresReference: false,
      isActive: true,
    },
    {
      organizationId: 'org_pixelflames_001',
      code: 'CREDIT_CARD',
      name: 'Credit Card',
      description: 'Visa / MasterCard / AMEX payment gateway',
      requiresReference: true,
      isActive: true,
    },
    {
      organizationId: 'org_pixelflames_001',
      code: 'CHEQUE',
      name: 'Cheque',
      description: 'Company cheque deposit',
      requiresReference: true,
      isActive: true,
    },
  ]);
  console.log('💳 Seeded Payment Methods.');

  // 6. Seed Corporate Customers (Marked as DEMO)
  const [emaar, maf, adnoc] = await Customer.create([
    {
      organizationId: 'org_pixelflames_001',
      customerType: 'COMPANY',
      relationType: 'CUSTOMER',
      companyName: '[DEMO] Emaar Hospitality Group LLC',
      contactPerson: 'Zaid Al-Mansoor',
      email: 'finance@emaar.ae',
      phone: '+971 4 367 3333',
      trn: '100456789000003',
      billingEmirate: 'DUBAI',
      billingAddressLine1: 'Downtown Dubai, Burj Plaza',
      billingCity: 'Dubai',
      paymentTermsDays: 30,
      currency: 'AED',
    },
    {
      organizationId: 'org_pixelflames_001',
      customerType: 'COMPANY',
      relationType: 'CUSTOMER',
      companyName: '[DEMO] Majid Al Futtaim Ventures LLC',
      contactPerson: 'Fatima Al-Zahra',
      email: 'invoicing@maf.ae',
      phone: '+971 4 294 2444',
      trn: '100345678900003',
      billingEmirate: 'DUBAI',
      billingAddressLine1: 'MAF Tower, Deira City Centre',
      billingCity: 'Dubai',
      paymentTermsDays: 45,
      currency: 'AED',
    },
    {
      organizationId: 'org_pixelflames_001',
      customerType: 'COMPANY',
      relationType: 'CUSTOMER',
      companyName: '[DEMO] ADNOC Distribution PJSC',
      contactPerson: 'Sultan Al-Nuaimi',
      email: 'vendor.payments@adnoc.ae',
      phone: '+971 2 678 1000',
      trn: '100123456700003',
      billingEmirate: 'ABU_DHABI',
      billingAddressLine1: 'Corniche Road, Sector W5',
      billingCity: 'Abu Dhabi',
      paymentTermsDays: 60,
      currency: 'AED',
    },
  ]);
  console.log('🏢 Seeded Corporate Customers [DEMO].');

  // 7. Seed Products / Services (Marked as DEMO)
  const [p1, p2, p3] = await Product.create([
    {
      organizationId: 'org_pixelflames_001',
      name: '[DEMO] Financial Advisory & Accounting Retainer',
      sku: 'SRV-ADV-001',
      description: 'Monthly statutory accounting, bookkeeping, and management accounts preparation',
      unitPrice: 5000,
      unit: 'Month',
      vatRateId: vatStandard._id,
      vatTreatment: 'STANDARD_RATED',
    },
    {
      organizationId: 'org_pixelflames_001',
      name: '[DEMO] Corporate Tax Compliance & Filing',
      sku: 'SRV-CT-002',
      description: 'UAE Federal Corporate Tax return preparation and filing under Law No. 47 of 2022',
      unitPrice: 8500,
      unit: 'Engagement',
      vatRateId: vatStandard._id,
      vatTreatment: 'STANDARD_RATED',
    },
    {
      organizationId: 'org_pixelflames_001',
      name: '[DEMO] UAE VAT Audit & Assessment Representation',
      sku: 'SRV-AUD-003',
      description: 'FTA compliance review, pre-audit health check, and representation',
      unitPrice: 12000,
      unit: 'Project',
      vatRateId: vatStandard._id,
      vatTreatment: 'STANDARD_RATED',
    },
  ]);
  console.log('📦 Seeded Products and Services [DEMO].');

  // 8. Seed Invoices (Marked as DEMO)
  const inv1 = await Invoice.create({
    organizationId: 'org_pixelflames_001',
    customerId: emaar._id,
    invoiceNumber: 'INV-2026-00001',
    sequenceNumber: 1,
    invoiceDate: '2026-01-10',
    supplyDate: '2026-01-10',
    dueDate: '2026-02-09',
    paymentTermsDays: 30,
    customerSnapshot: {
      companyName: emaar.companyName,
      contactPerson: emaar.contactPerson,
      email: emaar.email,
      phone: emaar.phone,
      trn: emaar.trn,
      billingAddressLine1: emaar.billingAddressLine1,
      billingCity: emaar.billingCity,
      billingEmirate: emaar.billingEmirate,
      billingCountry: 'United Arab Emirates',
    },
    items: [
      {
        productId: p1._id,
        itemOrder: 1,
        description: 'Financial Advisory & Accounting Retainer - Jan 2026 [DEMO]',
        quantity: 1,
        unit: 'Month',
        unitPrice: 5000,
        discountType: 'PERCENTAGE',
        discountValue: 0,
        discountAmount: 0,
        subtotalNet: 5000,
        vatRatePercentage: 5.0,
        vatTreatment: 'STANDARD_RATED',
        vatAmount: 250,
        totalGross: 5250,
      },
    ],
    subtotalNet: 5000,
    discountType: 'PERCENTAGE',
    discountValue: 0,
    discountAmount: 0,
    vatTotal: 250,
    grandTotal: 5250,
    amountPaid: 5250,
    balanceDue: 0,
    status: 'PAID',
    currency: 'AED',
    notes: '[DEMO DATA] Demonstration tax invoice for verification testing only.',
    createdBy: adminUser._id,
  });

  const inv2 = await Invoice.create({
    organizationId: 'org_pixelflames_001',
    customerId: maf._id,
    invoiceNumber: 'INV-2026-00002',
    sequenceNumber: 2,
    invoiceDate: '2026-02-01',
    supplyDate: '2026-02-01',
    dueDate: '2026-03-18',
    paymentTermsDays: 45,
    customerSnapshot: {
      companyName: maf.companyName,
      contactPerson: maf.contactPerson,
      email: maf.email,
      phone: maf.phone,
      trn: maf.trn,
      billingAddressLine1: maf.billingAddressLine1,
      billingCity: maf.billingCity,
      billingEmirate: maf.billingEmirate,
      billingCountry: 'United Arab Emirates',
    },
    items: [
      {
        productId: p2._id,
        itemOrder: 1,
        description: 'Corporate Tax Compliance & Impact Assessment [DEMO]',
        quantity: 1,
        unit: 'Engagement',
        unitPrice: 8500,
        discountType: 'PERCENTAGE',
        discountValue: 0,
        discountAmount: 0,
        subtotalNet: 8500,
        vatRatePercentage: 5.0,
        vatTreatment: 'STANDARD_RATED',
        vatAmount: 425,
        totalGross: 8925,
      },
    ],
    subtotalNet: 8500,
    discountType: 'PERCENTAGE',
    discountValue: 0,
    discountAmount: 0,
    vatTotal: 425,
    grandTotal: 8925,
    amountPaid: 5000,
    balanceDue: 3925,
    status: 'PARTIALLY_PAID',
    currency: 'AED',
    notes: '[DEMO DATA] Demonstration tax invoice for verification testing only.',
    createdBy: accountantUser._id,
  });

  const inv3 = await Invoice.create({
    organizationId: 'org_pixelflames_001',
    customerId: adnoc._id,
    invoiceNumber: 'INV-2026-00003',
    sequenceNumber: 3,
    invoiceDate: '2026-01-15',
    supplyDate: '2026-01-15',
    dueDate: '2026-02-14',
    paymentTermsDays: 30,
    customerSnapshot: {
      companyName: adnoc.companyName,
      contactPerson: adnoc.contactPerson,
      email: adnoc.email,
      phone: adnoc.phone,
      trn: adnoc.trn,
      billingAddressLine1: adnoc.billingAddressLine1,
      billingCity: adnoc.billingCity,
      billingEmirate: adnoc.billingEmirate,
      billingCountry: 'United Arab Emirates',
    },
    items: [
      {
        productId: p3._id,
        itemOrder: 1,
        description: 'UAE VAT Audit & Assessment Representation [DEMO]',
        quantity: 1,
        unit: 'Project',
        unitPrice: 12000,
        discountType: 'PERCENTAGE',
        discountValue: 0,
        discountAmount: 0,
        subtotalNet: 12000,
        vatRatePercentage: 5.0,
        vatTreatment: 'STANDARD_RATED',
        vatAmount: 600,
        totalGross: 12600,
      },
    ],
    subtotalNet: 12000,
    discountType: 'PERCENTAGE',
    discountValue: 0,
    discountAmount: 0,
    vatTotal: 600,
    grandTotal: 12600,
    amountPaid: 0,
    balanceDue: 12600,
    status: 'OVERDUE',
    currency: 'AED',
    notes: '[DEMO DATA] Demonstration tax invoice for verification testing only.',
    createdBy: salesUser._id,
  });

  // 9. Seed Payments
  await Payment.create([
    {
      organizationId: 'org_pixelflames_001',
      invoiceId: inv1._id,
      invoiceNumber: inv1.invoiceNumber,
      customerId: emaar._id,
      customerName: emaar.companyName,
      paymentNumber: 'PAY-2026-00001',
      sequenceNumber: 1,
      paymentDate: '2026-01-20',
      paymentMethodId: bankTransferMethod._id,
      paymentMethodName: bankTransferMethod.name,
      amount: 5250,
      currency: 'AED',
      referenceNumber: 'DEMO-TXN-9021849',
      notes: '[DEMO] Settlement via ENBD direct transfer',
      status: 'RECORDED',
      createdBy: accountantUser._id,
    },
    {
      organizationId: 'org_pixelflames_001',
      invoiceId: inv2._id,
      invoiceNumber: inv2.invoiceNumber,
      customerId: maf._id,
      customerName: maf.companyName,
      paymentNumber: 'PAY-2026-00002',
      sequenceNumber: 2,
      paymentDate: '2026-02-15',
      paymentMethodId: bankTransferMethod._id,
      paymentMethodName: bankTransferMethod.name,
      amount: 5000,
      currency: 'AED',
      referenceNumber: 'DEMO-PAY-449102',
      notes: '[DEMO] First tranche payment',
      status: 'RECORDED',
      createdBy: accountantUser._id,
    },
  ]);
  console.log('💰 Seeded Payment records [DEMO].');

  // Summary Banner - Without exposing persistent secret credentials to application log files
  console.log(`
🎉 ==============================================================
🌱 Database seed completed successfully!
🏢 Organization: PixelFlames LLC
📊 Invoices: INV-2026-00001 (PAID), INV-2026-00002 (PARTIALLY_PAID), INV-2026-00003 (OVERDUE)

🔑 Administrator Account:
   • Email: ${adminEmail}
   • Role: OWNER
   • Password Source: ${isGeneratedAdminPass ? 'Cryptographically generated for this session (see console below)' : 'Loaded from SEED_ADMIN_PASSWORD environment variable'}
`);

  if (isGeneratedAdminPass) {
    console.log(`   • Generated Admin Password: ${adminPassword}`);
    console.log(`   ⚠️  Please save this password securely. It is stored as an irreversible bcrypt hash.`);
  }

  console.log(`==============================================================`);

  await mongoose.disconnect();
}

runSeed().catch((err) => {
  console.error('❌ Database seed error:', err.message);
  process.exit(1);
});
