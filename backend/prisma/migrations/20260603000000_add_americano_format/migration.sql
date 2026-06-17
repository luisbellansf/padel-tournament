-- AlterTable: extend Tournament.format enum to include AMERICANO
ALTER TABLE `Tournament`
  MODIFY COLUMN `format` ENUM('ROUND_ROBIN', 'KNOCKOUT', 'GROUP_KNOCKOUT', 'AMERICANO') NOT NULL;
