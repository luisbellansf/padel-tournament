-- Email is now optional (nullable) — name becomes the unique login identifier
ALTER TABLE `User` MODIFY COLUMN `email` VARCHAR(191) NULL DEFAULT NULL;

-- Make name unique (username / login identifier)
-- If duplicate names exist in dev DB, run: UPDATE User SET name = CONCAT(name, id) to fix first
ALTER TABLE `User` ADD UNIQUE INDEX `User_name_key` (`name`);
