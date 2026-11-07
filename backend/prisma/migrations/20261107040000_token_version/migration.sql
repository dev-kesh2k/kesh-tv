-- Versão do token de login: trocar a senha invalida os logins antigos.
-- Começa em 1 para encerrar uma vez todas as sessões existentes (a senha do admin chegou a ficar pública).
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "User" SET "tokenVersion" = 1;
