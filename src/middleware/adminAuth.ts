import { Request, Response, NextFunction } from 'express';

/**
 * Admin Check Middleware
 * 
 * For now, this is a simple placeholder.
 * In production, you should:
 * 1. Verify JWT token from Supabase
 * 2. Check user email against admin list
 * 3. Return 403 if not admin
 */

// List of admin email addresses
const ADMIN_EMAILS = [
    'anuragnarsingoju@gmail.com'
];

/**
 * Middleware to check if user is admin
 * Currently allows all requests (to be implemented with proper auth)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    // TODO: Implement proper JWT verification with Supabase
    // For now, we'll allow all requests since frontend handles the UI restriction

    // Example implementation (commented out):
    /*
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }
  
    // Verify JWT token with Supabase
    // Extract email from token
    // Check if email is in ADMIN_EMAILS
    
    const userEmail = extractEmailFromToken(authHeader);
    if (!ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    */

    next();
};

/**
 * Check if an email is an admin
 */
export const isAdminEmail = (email: string): boolean => {
    return ADMIN_EMAILS.includes(email.toLowerCase());
};
