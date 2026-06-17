-- AlterTable: add per-tournament skill level to registrations (nullable)
ALTER TABLE `Registration` ADD COLUMN `skillLevel` ENUM('ASSOCIATE', 'CONSULTANT', 'EXPERT') NULL DEFAULT NULL;
