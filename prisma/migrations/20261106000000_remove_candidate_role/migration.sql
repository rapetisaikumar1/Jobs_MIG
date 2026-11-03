-- Remove the built-in "Candidate" role. Candidates are identified by users.type = 'CANDIDATE';
-- the role carried no permissions. Role permissions are removed by ON DELETE CASCADE.
DELETE FROM "user_roles" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "key" = 'CANDIDATE');
DELETE FROM "roles" WHERE "key" = 'CANDIDATE';
