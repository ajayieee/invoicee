"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_js_1 = require("../controllers/report.controller.js");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const router = (0, express_1.Router)();
router.get('/dashboard-metrics', auth_middleware_js_1.authenticate, report_controller_js_1.getDashboardMetrics);
router.get('/customer-statement', auth_middleware_js_1.authenticate, report_controller_js_1.getCustomerStatement);
exports.default = router;
