-- Busca sem acentos: nome em minúsculas e sem acento (a próxima atualização da lista grava o valor exato).
ALTER TABLE "Channel" ADD COLUMN "searchName" TEXT NOT NULL DEFAULT '';
UPDATE "Channel" SET "searchName" = translate(lower("name"),
  'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
  'aaaaaaeeeeiiiiooooouuuucnyy');
