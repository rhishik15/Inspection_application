export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, reply: any) => {
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
