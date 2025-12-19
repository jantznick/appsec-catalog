#!/bin/bash
# Simple SQL-based admin password reset
# Usage: ./reset-admin-sql.sh <admin-email>

EMAIL=$1

if [ -z "$EMAIL" ]; then
  echo "Usage: ./reset-admin-sql.sh <admin-email>"
  exit 1
fi

echo "Resetting password for admin: $EMAIL"
echo "This will clear the password, allowing you to use an invitation link."

docker-compose exec -T postgres psql -U appsec -d appsec_catalog <<EOF
UPDATE "User" 
SET password = NULL 
WHERE email = '$EMAIL' AND "isAdmin" = true;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM "User" WHERE email = '$EMAIL' AND "isAdmin" = true) 
    THEN '✅ Password cleared for admin: $EMAIL'
    ELSE '❌ No admin user found with email: $EMAIL'
  END as result;
EOF

echo ""
echo "📝 Next steps:"
echo "   1. Make sure $EMAIL is in your ADMIN_EMAILS environment variable"
echo "   2. Restart your backend: docker-compose restart backend"
echo "   3. Check backend logs for the invitation link: docker-compose logs backend | grep 'Admin Invitation Link'"

