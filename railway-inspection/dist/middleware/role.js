"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const requireRole = (allowedRoles) => {
    return async (req, reply) => {
        const headerRole = req.headers["role"];
        const role = Array.isArray(headerRole) ? headerRole[0] : headerRole;
        const normalizedRole = typeof role === "string" ? role.toUpperCase() : "";
        if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
            return reply.status(403).send({
                error: "Access denied"
            });
        }
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=role.js.map